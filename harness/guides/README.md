# harness/guides

업무별 진행 가이드. 사람·에이전트가 "이 업무는 어떻게 흘러가고 어디서 걸리는가"를 한 장으로 본다.
**수치는 적지 않는다** — 게이트 ID 와 `rules.yaml` 키만 가리킨다. 절차의 정본은 `.claude/skills/run-harness/SKILL.md`, 역할 지시는 `.claude/agents/`.

| 가이드 | 트리거 | slug |
|---|---|---|
| [ux.md](ux.md) | `{version} {주제} 화면 하네스 돌려줘` | `{version}-ux-{topic}` |
| [screenshots.md](screenshots.md) | `{version} 스크린샷 하네스 돌려줘` | `{version}-screenshots` |
| [qa.md](qa.md) | `{version} QA 시트 하네스 돌려줘` | `{version}-qa` |
| [events.md](events.md) | `{version} 이벤트 시트 하네스 돌려줘` | `{version}-events` |

공통: P1 수집 → P2 설계 → P3 제작 → 👤 보강·승인(`approval.md`) → P4 대조 → P5 파생. 같은 게이트 연속 실패가 `retry.max_same_gate_fail` 에 닿으면 차단(exit 3) — 사람이 `unblock.md` 를 쓸 때까지 멈춘다.
★ 게이트(A·B)는 `docs/story-service.md` 의 "어기면 안 되는 것"에서 왔다.
