"""Android observations without injecting a native agent into the target app."""
import asyncio
import json
import re
import xml.etree.ElementTree as ET
from mcp.types import CallToolResult, TextContent

class AndroidADB:
    def __init__(self):
        self.refs = {}

    async def command(self, *args):
        proc = await asyncio.create_subprocess_exec(
            'adb', *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        try:
            async with asyncio.timeout(30):
                out, err = await proc.communicate()
        except BaseException:
            if proc.returncode is None:
                proc.kill()
            await proc.wait()
            raise
        if proc.returncode:
            raise RuntimeError(f'ADB exited {proc.returncode}: ' + (err or out).decode(errors='replace')[:1000])
        return out.decode(errors='replace')

    async def serial(self, device):
        devices = await self.command('devices')
        online = [line.split()[0] for line in devices.splitlines()[1:]
                  if len(line.split()) >= 2 and line.split()[1] == 'device']
        if device in online:
            return device
        matches = []
        for serial in online:
            if serial.startswith('emulator-'):
                name = await self.command('-s', serial, 'emu', 'avd', 'name')
                if name.splitlines() and name.splitlines()[0].strip() == device:
                    matches.append(serial)
        if len(matches) != 1:
            raise ValueError('Target is offline or AVD name is ambiguous; refusing another device.')
        return matches[0]

    async def elements(self, serial):
        # Never return XML left by a previous successful observation.
        await self.command('-s', serial, 'shell', 'rm', '-f', '/data/local/tmp/artemis-ui.xml')
        await self.command('-s', serial, 'shell', 'uiautomator', 'dump', '/data/local/tmp/artemis-ui.xml')
        xml = await self.command('-s', serial, 'shell', 'cat', '/data/local/tmp/artemis-ui.xml')
        root = ET.fromstring(xml)
        rows = []
        for node in root.iter('node'):
            a = node.attrib
            bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', a.get('bounds', ''))
            if not bounds:
                continue
            x1,y1,x2,y2 = map(int,bounds.groups())
            if x2 <= x1 or y2 <= y1:
                continue
            rows.append({'ref': f'@e{len(rows)+1}', 'text': a.get('text',''),
                         'label': a.get('content-desc',''), 'id': a.get('resource-id',''),
                         'class':a.get('class',''), 'bounds':[x1,y1,x2,y2],
                         'checked':a.get('checked')=='true', 'enabled':a.get('enabled')=='true'})
        return rows

    async def execute(self, state, tool, arguments):
        key = state['run_id']
        if tool == 'mobile_list_elements_on_screen':
            self.refs.pop(key, None)
        serial = await self.serial(state['device'])
        if tool == 'mobile_list_elements_on_screen':
            rows = await self.elements(serial)
            self.refs[key] = {r['ref']: r for r in rows}
            return CallToolResult(content=[TextContent(type='text',text=json.dumps(rows,ensure_ascii=False))])
        if tool == 'mobile_click_on_screen_at_coordinates':
            if 'ref' in arguments:
                old = self.refs.get(key,{}).get(arguments['ref'])
                if not old:
                    raise ValueError('Observe UI before using a ref.')
                current = await self.elements(serial)
                if old not in current:
                    self.refs.pop(key,None)
                    raise ValueError('UI changed; observe again before tapping.')
                x1,y1,x2,y2 = old['bounds']; x,y = (x1+x2)//2,(y1+y2)//2
            else:
                x,y = arguments.get('x'),arguments.get('y')
                if not all(isinstance(v,(int,float)) and v >= 0 for v in (x,y)):
                    raise ValueError('Nonnegative x and y required.')
            self.refs.pop(key,None)
            await self.command('-s',serial,'shell','input','tap',str(int(x)),str(int(y)))
            return CallToolResult(content=[TextContent(type='text',text='Tapped through ADB; observe result.')])
        raise ValueError('Unsupported ADB operation.')
