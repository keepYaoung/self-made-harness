import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from ios_simulator import IOSSimulator, command, elements


def tree(label="Settings", x=10):
    return [{"frame": {"x": 0, "y": 0, "width": 402, "height": 874}, "children": [
        {"AXLabel": label, "AXUniqueId": "settings", "type": "Button", "enabled": True,
         "frame": {"x": x, "y": 20, "width": 80, "height": 40}},
        {"AXLabel": "Offscreen", "frame": {"x": 0, "y": 0, "width": 0, "height": 0}}]}]


class IOSAdapterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.adapter = IOSSimulator()
        self.state = {"device": "sim-123", "run_id": "run-123"}

    async def observe(self):
        with patch.object(self.adapter, "snapshot", AsyncMock(return_value=tree())):
            result = await self.adapter.execute(self.state, "mobile_list_elements_on_screen", {})
        return json.loads(result.content[0].text)[0]["ref"]

    async def test_visible_elements_and_ref_tap(self):
        ref = await self.observe()
        self.assertEqual(len(elements(tree())), 1)
        with patch.object(self.adapter, "snapshot", AsyncMock(return_value=tree())), \
             patch("ios_simulator.command", AsyncMock(return_value=b"ok")) as run:
            await self.adapter.execute(self.state, "mobile_click_on_screen_at_coordinates", {"ref": ref})
        self.assertEqual(run.call_args.args[0][1:], ["tap", "-x", 50, "-y", 40, "--udid", "sim-123"])
        with self.assertRaises(ValueError):
            await self.adapter.execute(self.state, "mobile_click_on_screen_at_coordinates", {"ref": ref})

    async def test_changed_layout_rejects_stale_ref(self):
        ref = await self.observe()
        with patch.object(self.adapter, "snapshot", AsyncMock(return_value=tree(x=100))), \
             patch("ios_simulator.command", AsyncMock()) as run:
            with self.assertRaises(ValueError):
                await self.adapter.execute(self.state, "mobile_click_on_screen_at_coordinates", {"ref": ref})
        run.assert_not_called()

    async def test_ref_bound_to_run(self):
        ref = await self.observe()
        with self.assertRaises(ValueError):
            await self.adapter.execute({**self.state, "run_id": "other"},
                                       "mobile_click_on_screen_at_coordinates", {"ref": ref})

    async def test_launch_uses_simctl(self):
        with patch("ios_simulator.command", AsyncMock(return_value=b"started")) as run:
            await self.adapter.execute(self.state, "mobile_launch_app", {"packageName": "com.test.app"})
        self.assertEqual(run.call_args.args[0], ["xcrun", "simctl", "launch", "sim-123", "com.test.app"])
        self.assertEqual(run.call_args_list[0].args[0],
                         ["open", "-a", "Simulator", "--args", "-CurrentDeviceUDID", "sim-123"])

    async def test_unsupported_options_fail_explicitly(self):
        for tool, args in [("mobile_press_button", {"button": "VOLUME_UP"}),
                           ("mobile_type_keys", {"text": "한글", "submit": False}),
                           ("mobile_get_foreground_app", {}),
                           ("mobile_launch_app", {"packageName": "com.test", "locale": "ko"})]:
            with self.assertRaises(ValueError):
                await self.adapter.execute(self.state, tool, args)

    async def test_typing_uses_stdin(self):
        with patch("ios_simulator.command", AsyncMock(return_value=b"")) as run:
            await self.adapter.execute(self.state, "mobile_type_keys", {"text": "test!", "submit": True})
        self.assertEqual(run.call_args_list[0].args[1], b"test!")
        self.assertIn("--stdin", run.call_args_list[0].args[0])
        self.assertEqual(run.call_args_list[1].args[0][1:3], ["key", "40"])

    async def test_timeout_kills_and_reaps_process(self):
        process = AsyncMock()
        process.returncode = None
        from unittest.mock import Mock
        process.kill = Mock()
        process.communicate.side_effect = TimeoutError()
        with patch("ios_simulator.asyncio.create_subprocess_exec", AsyncMock(return_value=process)):
            with self.assertRaises(TimeoutError):
                await command(["axe", "describe-ui"])
        process.kill.assert_called_once()
        process.wait.assert_awaited_once()
