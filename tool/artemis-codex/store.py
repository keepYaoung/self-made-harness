# Copyright 2026 Google LLC (atomic_write adaptation)
# Copyright 2026 ClipDoggy contributors
# Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.md.
"""Persistent plans and evidence. No AI/provider code is imported here."""
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import uuid


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_write(path, data):
    """Adapted from Artemis trace_store._atomic_write_json; POSIX-only replace."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temp.open("w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


class Store:
    def __init__(self, root):
        self.root = Path(root)

    def folder(self, run_id):
        if uuid.UUID(run_id).hex != run_id:
            raise ValueError("Use a run_id returned by ac_start.")
        return self.root / run_id

    def read(self, run_id):
        return json.loads((self.folder(run_id) / "status.json").read_text())

    @contextmanager
    def edit(self, run_id):
        folder = self.folder(run_id)
        with (folder / "status.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError("This run is busy; retry after the current operation.")
            state = self.read(run_id)
            yield state
            state["updated_at"] = now()
            atomic_write(folder / "status.json", state)

    def start(self, goal, device, checkpoints):
        if not goal.strip() or not device.strip() or not checkpoints or any(
            not item.strip() for item in checkpoints
        ):
            raise ValueError("Goal, explicit device ID, and nonempty checkpoints are required.")
        run_id = uuid.uuid4().hex
        state = {"run_id": run_id, "goal": goal, "device": device,
                 "status": "running", "created_at": now(), "updated_at": now(),
                 "checkpoints": [{"description": item, "status": "pending"}
                                 for item in checkpoints], "events": []}
        atomic_write(self.folder(run_id) / "status.json", state)
        return state

    @staticmethod
    def require_running(state):
        if state["status"] != "running":
            raise ValueError("Run is closed. Start a new run for further actions.")

    def checkpoint(self, run_id, index, passed, reason, evidence):
        with self.edit(run_id) as state:
            self.require_running(state)
            if not 0 <= index < len(state["checkpoints"]):
                raise ValueError("Invalid zero-based checkpoint index.")
            if not reason.strip() or not evidence:
                raise ValueError("Describe the observed result and supply evidence event IDs.")
            last_action = max((i for i, event in enumerate(state["events"])
                               if event["kind"] == "action"), default=-1)
            for event_id in evidence:
                matches = [(i, e) for i, e in enumerate(state["events"]) if e["id"] == event_id]
                if not matches:
                    raise ValueError("Evidence must belong to this run.")
                position, event = matches[0]
                if event["kind"] != "observation" or event["status"] != "ok" or position <= last_action:
                    raise ValueError("Use successful observation evidence collected after the latest action.")
            state["checkpoints"][index].update(
                status="passed" if passed else "failed", reason=reason,
                evidence=evidence, checked_at=now(), evaluator="Codex/operator")
        return self.read(run_id)

    def finish(self, run_id, outcome, summary):
        with self.edit(run_id) as state:
            self.require_running(state)
            if outcome not in ("passed", "failed", "blocked") or not summary.strip():
                raise ValueError("Use passed/failed/blocked and a nonempty summary.")
            if outcome == "passed" and any(c["status"] != "passed" for c in state["checkpoints"]):
                raise ValueError("Every checkpoint needs evidence-backed verification first.")
            if outcome == "passed" and any(e["status"] == "pending" for e in state["events"]):
                raise ValueError("An interrupted operation has unknown outcome; start a new run.")
            if outcome == "passed":
                evidence = {item for c in state["checkpoints"] for item in c.get("evidence", [])}
                last_action = max((i for i, e in enumerate(state["events"])
                                   if e["kind"] == "action"), default=-1)
                if not any(i > last_action and e["id"] in evidence
                           for i, e in enumerate(state["events"])):
                    raise ValueError("Verify the final state after the latest action before passing.")
            state.update(status=outcome, summary=summary)
        self.report(run_id)
        return self.read(run_id)

    def report(self, run_id):
        state = self.read(run_id)
        lines = ["# Mobile test report", "", f"Goal: {state['goal']}",
                 f"Device: {state['device']}", f"Status: {state['status']}", "",
                 "Verification is recorded by Codex/operator, not an independent AI checker.",
                 "", state.get("summary", ""), "", "## Checkpoints", ""]
        for i, item in enumerate(state["checkpoints"]):
            lines.extend([f"{i}. [{item['status']}] {item['description']}",
                          f"   {item.get('reason', '')}"])
            for evidence in item.get("evidence", []):
                lines.append(f"   Evidence: [event {evidence}](./{evidence}.json)")
        lines.extend(["", "## Execution log", ""])
        for event in state["events"]:
            lines.append(f"- {event['time']} {event['tool']} [{event['status']}] "
                         f"[evidence](./{event['id']}.json)")
        target = self.folder(run_id) / "report.md"
        target.write_text("\n".join(lines) + "\n")
        return str(target)
