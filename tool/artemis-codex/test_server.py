import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from mcp.types import CallToolResult, TextContent, ImageContent
import server
from store import Store


class FakeDevice:
    def __init__(self):
        self.calls = []
        self.fail = False

    async def call_tool(self, name, args):
        self.calls.append((name, args))
        if self.fail:
            return CallToolResult(isError=True, content=[TextContent(type="text", text="Device offline")])
        if name == "mobile_list_available_devices":
            return CallToolResult(content=[TextContent(type="text", text='{"devices":[{"id":"test-phone"}]}')])
        if name == "mobile_take_screenshot":
            return CallToolResult(content=[ImageContent(type="image", mimeType="image/png", data="cG5n")])
        return CallToolResult(content=[TextContent(type="text", text="Observed test screen")])


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_store, self.original_bridge = server.store, server.bridge
        server.store = Store(self.temp.name)
        server.bridge = server.Bridge()
        server.bridge.session = FakeDevice()
        server.bridge.schemas = {name: None for name in server.OBSERVATIONS | server.ACTIONS}
        self.run = server.store.start("Check test screen", "test-phone", ["Test screen appears"])["run_id"]

    def tearDown(self):
        server.store, server.bridge = self.original_store, self.original_bridge
        self.temp.cleanup()

    async def observe(self, name="mobile_list_elements_on_screen"):
        result = await server.ac_device(self.run, name, {})
        return json.loads(result.content[0].text)["event_id"]

    async def test_end_to_end_evidence_and_restart(self):
        await server.ac_device(self.run, "mobile_press_button", {"button": "HOME"})
        evidence = await self.observe("mobile_take_screenshot")
        state = server.ac_checkpoint(self.run, 0, True, "Expected screen is visible", [evidence])
        self.assertEqual(state["checkpoints"][0]["status"], "passed")
        result = server.ac_finish(self.run, "passed", "Checked screenshot")
        self.assertIn(evidence, Path(result["report"]).read_text())
        self.assertTrue(list(server.store.folder(self.run).glob("*.png")))
        self.assertEqual(Store(self.temp.name).read(self.run)["status"], "passed")
        self.assertEqual(server.bridge.session.calls[0][1]["device"], "test-phone")

    async def test_no_pass_without_verification(self):
        with self.assertRaises(ValueError):
            server.ac_finish(self.run, "passed", "It worked")
        with self.assertRaises(ValueError):
            server.ac_checkpoint(self.run, 0, True, "It worked", [])

    async def test_stale_and_foreign_evidence_rejected(self):
        evidence = await self.observe()
        await server.ac_device(self.run, "mobile_press_button", {"button": "HOME"})
        with self.assertRaises(ValueError):
            server.ac_checkpoint(self.run, 0, True, "Stale", [evidence])
        with self.assertRaises(ValueError):
            server.ac_checkpoint(self.run, 0, True, "Invented", ["fake-id"])

    async def test_error_is_logged_and_not_evidence(self):
        server.bridge.session.fail = True
        result = await server.ac_device(self.run, "mobile_take_screenshot", {})
        self.assertTrue(result.isError)
        evidence = json.loads(result.content[0].text)["event_id"]
        with self.assertRaises(ValueError):
            server.ac_checkpoint(self.run, 0, True, "Offline", [evidence])
        self.assertEqual(server.store.read(self.run)["events"][0]["status"], "error")
        self.assertEqual(server.ac_finish(self.run, "blocked", "Offline")["state"]["status"], "blocked")

    async def test_device_override_and_cloud_rejected(self):
        for tool, args in [("mobile_take_screenshot", {"device": "another"}),
                           ("mobile_get_device_logs", {"saveTo": "/tmp/outside.log"}),
                           ("mobile_allocate_remote_device", {}),
                           ("mobile_batch_commands", {})]:
            with self.assertRaises(ValueError):
                await server.ac_device(self.run, tool, args)
        self.assertEqual(server.bridge.session.calls, [])

    async def test_new_action_requires_final_verification(self):
        evidence = await self.observe()
        server.ac_checkpoint(self.run, 0, True, "Visible", [evidence])
        await server.ac_device(self.run, "mobile_press_button", {"button": "HOME"})
        with self.assertRaises(ValueError):
            server.ac_finish(self.run, "passed", "Unchecked final action")

    async def test_closed_run_and_path_traversal_rejected(self):
        server.ac_finish(self.run, "blocked", "Stopped")
        with self.assertRaises(ValueError):
            await self.observe()
        with self.assertRaises(ValueError):
            server.ac_status("../../elsewhere")

    async def test_start_requires_local_online_device(self):
        result = await server.ac_start("Goal", "test-phone", ["Expected state"])
        self.assertEqual(result["device"], "test-phone")
        with self.assertRaises(ValueError):
            await server.ac_start("Goal", "remote-phone", ["Expected state"])

    async def test_cancelled_action_remains_pending(self):
        async def cancelled(*_):
            raise asyncio.CancelledError()
        server.bridge.session.call_tool = cancelled
        server.bridge.android.refs[self.run] = {"@e1": {}}
        with self.assertRaises(asyncio.CancelledError):
            await server.ac_device(self.run, "mobile_press_button", {"button": "HOME"})
        self.assertEqual(server.store.read(self.run)["events"][0]["status"], "pending")
        self.assertNotIn(self.run, server.bridge.android.refs)

    async def test_mutation_result_not_observation(self):
        result = await server.ac_device(self.run, "mobile_press_button", {"button": "HOME"})
        evidence = json.loads(result.content[0].text)["event_id"]
        with self.assertRaises(ValueError):
            server.ac_checkpoint(self.run, 0, True, "Command succeeded", [evidence])


    async def test_android_ui_bypasses_injected_backend(self):
        with server.store.edit(self.run) as state:
            state.update(platform="android", device_type="emulator")
        response = CallToolResult(content=[TextContent(type="text", text="[]")])
        with patch.object(server.bridge.android, "execute", AsyncMock(return_value=response)) as execute:
            await server.ac_device(self.run, "mobile_list_elements_on_screen", {})
            server.bridge.android.refs[self.run] = {"@e1": {}}
            await server.ac_device(self.run, "mobile_click_on_screen_at_coordinates", {"x": 1, "y": 2})
        self.assertEqual(execute.await_count, 2)
        self.assertEqual(server.bridge.session.calls, [])
        self.assertNotIn(self.run, server.bridge.android.refs)

    async def test_native_android_capture_without_mobile_backend(self):
        with server.store.edit(self.run) as state:
            state.update(platform="android", device_type="emulator")
        process = AsyncMock()
        process.returncode = 0
        process.communicate.return_value = (b"\x89PNG\r\n\x1a\ntest", b"")
        with patch.object(server.bridge.android, "serial", AsyncMock(return_value="test-phone")), patch("server.asyncio.create_subprocess_exec", return_value=process) as spawn:
            result = await server.ac_device(self.run, "mobile_take_screenshot", {})
        self.assertFalse(result.isError)
        self.assertEqual(server.bridge.session.calls, [])
        self.assertEqual(spawn.call_args.args[:5], ("adb", "-s", "test-phone", "exec-out", "screencap"))

    async def test_invalid_native_image_is_failure(self):
        with server.store.edit(self.run) as state:
            state.update(platform="android", device_type="emulator")
        process = AsyncMock()
        process.returncode = 0
        process.communicate.return_value = (b"not an image", b"")
        with patch.object(server.bridge.android, "serial", AsyncMock(return_value="test-phone")), patch("server.asyncio.create_subprocess_exec", return_value=process):
            result = await server.ac_device(self.run, "mobile_take_screenshot", {})
        self.assertTrue(result.isError)

    async def test_ios_backend_failure_never_falls_back_to_wda(self):
        with server.store.edit(self.run) as state:
            state.update(platform="ios", device_type="simulator")
        with patch.object(server.bridge.ios, "execute", AsyncMock(side_effect=RuntimeError("AXe failed"))):
            result = await server.ac_device(self.run, "mobile_list_elements_on_screen", {})
        self.assertTrue(result.isError)
        self.assertEqual(server.bridge.session.calls, [])
        self.assertEqual(server.store.read(self.run)["events"][0]["backend"], "axe-simctl")


if __name__ == "__main__":
    unittest.main()
