# harness/templates

단계별 산출물의 빈 양식. 열 이름은 `harness/rules.yaml` 의 `formats` 와 같고, verify.mjs 가 이 열 이름으로 읽는다.
수치·허용 목록은 넣지 않는다 — 값은 `rules.yaml` 에만 있다. `{…}` 는 채울 자리.

| 파일 | 단계 | 저장 위치 (`runs/{slug}/` 기준) | 읽는 게이트 |
|---|---|---|---|
| `ux/scope.md` · `screenshots/scope.md` | P1 | `p1-collect/scope.md` | U2 |
| `qa/scope.md` | P1 | `p1-collect/scope.md` | (P3 범위 표로 복사 → Q1) |
| `events/scope.md` | P1 | `p1-collect/scope.md` | E2 |
| `ux/references.md` | P2 | `p2-design/references.md` | U1 |
| `ux/screens.md` | P2 | `p2-design/screens.md` | U2 · A1 · A2 · B1 · B2 · U6 |
| `ux/spec.md` | P2 | `p2-design/spec.md` | A1 · U6 |
| `screenshots/copy.csv` | P2 | `p2-design/copy.csv` | A2 · B1 · S3–S6 · S8 |
| `qa/items.md` | P2 | `p2-design/items.md` | — |
| `events/changes.md` | P2 | `p2-design/changes.md` | E2 (→ `event-tools.mjs apply`) |
| `ux/figma.json` | P3 | `p3-make/figma.json` · judge 는 같은 형식으로 `p4-check/figma-live.json` | U3–U7 |
| `qa/qa-sheet.md` | P3 | `p3-make/qa-{version}.md` | Q1–Q4 · A1 |
| `events/delivery.md` | P3 | `p3-make/events-{version}.md` | E7 |
| `events/amplitude-live.json` | P4 (judge) | `p4-check/amplitude-live.json` | E9 |
| `common/approval.md` | HUMAN (사람만) | `approval.md` | APPROVAL |
| `common/unblock.md` | 차단 해제 (사람만) | `unblock.md` | — |
| `common/sync-log.md` · `common/publish.json` | P5 | `p5-derive/` | Q5 · ART |

에이전트는 이 양식을 채워 `<<<FILE 경로 … >>>` 블록으로 돌려주고, 저장은 `save-blocks.mjs` 가 한다.
