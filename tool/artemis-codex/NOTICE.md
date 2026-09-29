# Origin and scope

Artemis: Copyright 2026 Google LLC, Apache-2.0.
Source: https://github.com/google/artemis
Pinned reference: e983180b5bb228e6edb482214a70f533048a523f

`store.py::atomic_write` adapts `_atomic_write_json` from
`artemis/runtime/trace_store.py`, retaining temp-file + fsync + atomic replacement.
Changes: pathlib interface, POSIX replacement, local result directory. The original
license is included in LICENSE. No upstream NOTICE file was present at this pin.

The plan/checkpoint/report workflow is adapted conceptually from Artemis Pro.
The bridge, tools, evidence checks, and documents are ClipDoggy integration code.
This is not an official Google or OpenAI product, nor a full Artemis Pro port.
It does not import Artemis agents, provider routing, Gemini ER, cloud OCR, or SDK clients.
Device operations reuse the separately installed Apache-2.0 Mobile MCP package.
