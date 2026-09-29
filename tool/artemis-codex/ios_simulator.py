"""WDA-free iOS simulator operations using XcodeBuildMCP's bundled AXe and simctl."""
import asyncio
import json
import math
import plistlib
from pathlib import Path
import uuid

from mcp.types import CallToolResult, TextContent

SUPPORTED = {
    "mobile_list_apps", "mobile_get_screen_size", "mobile_list_elements_on_screen",
    "mobile_take_screenshot", "mobile_launch_app", "mobile_terminate_app",
    "mobile_click_on_screen_at_coordinates", "mobile_press_button",
    "mobile_swipe_on_screen", "mobile_type_keys",
}


async def command(args, stdin=None):
    process = await asyncio.create_subprocess_exec(*map(str, args),
        stdin=asyncio.subprocess.PIPE if stdin is not None else asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        async with asyncio.timeout(30):
            out, err = await process.communicate(stdin)
    except BaseException:
        if process.returncode is None:
            process.kill()
        await process.wait()
        raise
    if process.returncode:
        raise RuntimeError(err.decode(errors="replace")[:2000])
    return out


def elements(tree):
    """Flatten visible accessibility elements without returning huge private AX trees."""
    output = []
    def walk(node):
        if isinstance(node, list):
            for child in node:
                walk(child)
        elif isinstance(node, dict):
            frame = node.get("frame", {})
            label, identifier = node.get("AXLabel"), node.get("AXUniqueId")
            if (label or identifier) and frame.get("width", 0) > 0 and frame.get("height", 0) > 0:
                item = {"label": label, "identifier": identifier,
                        "value": node.get("AXValue"), "type": node.get("type"),
                        "enabled": node.get("enabled", True), "frame": frame}
                if item not in output:
                    output.append(item)
            walk(node.get("children", []))
    walk(tree)
    return output


class IOSSimulator:
    def __init__(self):
        self.axe = Path(__file__).resolve().parent.parent / "node_modules/xcodebuildmcp/bundled/axe"
        self.refs = {}

    async def snapshot(self, device):
        return json.loads(await command([self.axe, "describe-ui", "--udid", device]))

    async def size(self, device):
        tree = await self.snapshot(device)
        root = tree[0] if isinstance(tree, list) else tree
        frame = root.get("frame")
        if not frame:
            frame = next((c.get("frame") for c in root.get("children", []) if c.get("frame")), None)
        if not frame or frame["width"] <= 0 or frame["height"] <= 0:
            raise ValueError("Cannot determine simulator bounds from accessibility tree.")
        return frame["width"], frame["height"]

    async def execute(self, state, tool, args):
        device, run_id = state["device"], state["run_id"]
        if tool not in SUPPORTED:
            raise ValueError("Unsupported on iOS simulator. Read ac_catalog(run_id); no WDA fallback.")
        if tool == "mobile_list_elements_on_screen":
            rows = elements(await self.snapshot(device))
            prefix = uuid.uuid4().hex[:10]
            self.refs[run_id] = {f"@{prefix}-{i}": item for i, item in enumerate(rows)}
            data = [{"ref": ref, **item} for ref, item in self.refs[run_id].items()]
            return CallToolResult(content=[TextContent(type="text", text=json.dumps(data, ensure_ascii=False))])
        if tool == "mobile_get_screen_size":
            width, height = await self.size(device)
            text = f"Screen size is {width}x{height} logical points; native PNG uses device pixels."
        elif tool == "mobile_list_apps":
            apps = plistlib.loads(await command(["xcrun", "simctl", "listapps", device]))
            text = json.dumps([{"packageName": key, "name": value.get("CFBundleDisplayName", value.get("CFBundleName", key))}
                               for key, value in apps.items()], ensure_ascii=False)
        else:
            # References are invalidated even when an action fails or times out.
            refs = self.refs.pop(run_id, {})
            if tool in {"mobile_launch_app", "mobile_terminate_app"}:
                if set(args) != {"packageName"}:
                    raise ValueError("iOS simulator app commands require only packageName; locale is unsupported.")
                operation = "launch" if tool == "mobile_launch_app" else "terminate"
                if operation == "launch":
                    # A booted headless simulator can retain stale rendered frames and
                    # stall app launch. Attach Simulator before requesting the app.
                    await command(["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", device])
                argv = ["xcrun", "simctl", operation, device, args["packageName"]]
            elif tool == "mobile_click_on_screen_at_coordinates":
                if args.get("ref"):
                    item = refs.get(args["ref"])
                    if not item or not item["enabled"]:
                        raise ValueError("Unknown, expired or disabled ref. Refresh UI first.")
                    if item not in elements(await self.snapshot(device)):
                        raise ValueError("UI changed since observation. Refresh before tapping.")
                    frame = item["frame"]
                    x, y = frame["x"] + frame["width"] / 2, frame["y"] + frame["height"] / 2
                else:
                    x, y = args.get("x"), args.get("y")
                if not all(isinstance(n, (int, float)) and math.isfinite(n) and n >= 0 for n in (x, y)):
                    raise ValueError("Provide a fresh ref or finite nonnegative x/y in logical points.")
                argv = [self.axe, "tap", "-x", x, "-y", y, "--udid", device]
            elif tool == "mobile_press_button":
                if args.get("button") != "HOME":
                    raise ValueError("Only HOME is supported by this iOS adapter.")
                argv = [self.axe, "button", "home", "--udid", device]
            elif tool == "mobile_swipe_on_screen":
                width, height = await self.size(device)
                x, y = args.get("x", width / 2), args.get("y", height / 2)
                distance = args.get("distance", min(width, height) * 0.3)
                if not all(isinstance(n, (int, float)) and math.isfinite(n) for n in (x, y, distance)) or distance <= 0:
                    raise ValueError("Swipe coordinates/distance must be finite, distance positive.")
                direction = args.get("direction")
                if direction not in ("up", "down", "left", "right"):
                    raise ValueError("Invalid swipe direction.")
                dx, dy = {"up": (0, -distance), "down": (0, distance),
                          "left": (-distance, 0), "right": (distance, 0)}[direction]
                end_x, end_y = max(1, min(width - 1, x + dx)), max(1, min(height - 1, y + dy))
                argv = [self.axe, "swipe", "--start-x", x, "--start-y", y,
                        "--end-x", end_x, "--end-y", end_y, "--duration", 0.3, "--udid", device]
            elif tool == "mobile_type_keys":
                text = args.get("text", "")
                if any(ord(c) < 32 or ord(c) > 126 for c in text):
                    raise ValueError("AXe typing supports printable ASCII only; Unicode input is not supported.")
                await command([self.axe, "type", "--stdin", "--udid", device], text.encode())
                if args.get("submit", False):
                    await command([self.axe, "key", "40", "--udid", device])
                return CallToolResult(content=[TextContent(type="text", text="Text typed; verify the field contents.")])
            else:
                raise ValueError("Native screenshot is handled by the capture path.")
            text = (await command(argv)).decode(errors="replace") or "Command completed; observe the resulting UI."
        return CallToolResult(content=[TextContent(type="text", text=text)])
