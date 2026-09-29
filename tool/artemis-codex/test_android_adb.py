import unittest
from unittest.mock import AsyncMock
from android_adb import AndroidADB

class AndroidADBTests(unittest.IsolatedAsyncioTestCase):
    async def test_avd_resolves_to_online_serial(self):
        a=AndroidADB(); a.command=AsyncMock(side_effect=['List of devices attached\nemulator-5554\tdevice\n','Pixel_API35\nOK\n'])
        self.assertEqual(await a.serial('Pixel_API35'),'emulator-5554')

    async def test_offline_target_does_not_fall_back(self):
        a=AndroidADB(); a.command=AsyncMock(return_value='List of devices attached\nother-phone\tdevice\n')
        with self.assertRaises(ValueError): await a.serial('missing-phone')

    async def test_ui_uses_uiautomator_not_agent(self):
        a=AndroidADB(); a.command=AsyncMock(side_effect=['', 'dumped','<hierarchy><node text="Login" bounds="[0,0][100,50]" enabled="true"/></hierarchy>'])
        rows=await a.elements('emulator-5554')
        self.assertEqual(rows[0]['text'],'Login')
        self.assertIn('uiautomator',a.command.call_args_list[1].args)

    async def test_stale_ref_refuses_tap(self):
        a=AndroidADB(); a.serial=AsyncMock(return_value='emulator-5554'); a.elements=AsyncMock(return_value=[]); a.command=AsyncMock()
        a.refs['r']={'@e1':{'ref':'@e1','bounds':[0,0,100,50]}}
        with self.assertRaises(ValueError): await a.execute({'run_id':'r','device':'avd'},'mobile_click_on_screen_at_coordinates',{'ref':'@e1'})
        a.command.assert_not_called()

    async def test_ref_tap_uses_adb_and_expires(self):
        a=AndroidADB(); a.serial=AsyncMock(return_value='emulator-5554'); a.command=AsyncMock()
        row={'ref':'@e1','bounds':[0,0,100,50]}; a.refs['r']={'@e1':row}; a.elements=AsyncMock(return_value=[row])
        await a.execute({'run_id':'r','device':'avd'},'mobile_click_on_screen_at_coordinates',{'ref':'@e1'})
        a.command.assert_awaited_once_with('-s','emulator-5554','shell','input','tap','50','25')
        self.assertNotIn('r',a.refs)
