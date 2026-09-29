# AGENTS.md — Clipdoggy 디자인 하네스 (모든 에이전트 공용)

Claude Code · Codex · Multica 어느 에이전트든 이 파일로 들어와 같은 규칙으로 일한다.

## 먼저 읽을 것
| 파일 | 내용 |
|---|---|
| `docs/story-service.md` | 서비스 맥락 · ★ 어기면 안 되는 것 A·B |
| `docs/story-work.md` | 손작업 흐름 (UX · 스크린샷 · QA) |
| `harness/rules.yaml` | **규칙 SSOT** — 파이프라인 · 게이트 · 사전 · 토큰 수치 |
| `.claude/skills/run-harness/SKILL.md` | 오케스트레이터 절차 |
| `.claude/agents/<역할>.md` | 역할별 작업 지시 — 도구에 상관없이 이 본문을 그대로 따른다 |
| `harness/guides/<업무>.md` | 업무별 흐름 한 장 — 단계 · 양식 · 게이트 · 자주 걸리는 곳 |
| `harness/templates/` | 단계별 산출물 빈 양식 (열 이름 = verify.mjs 가 읽는 열) |

## 역할 (`.claude/agents/`)
| 역할 | 단계 | 편집 범위 |
|---|---|---|
| collector | P1 수집 | `runs/{slug}/p1-collect/` |
| planner | P2 설계 | `runs/{slug}/p2-design/` |
| maker | P3 제작 (ux는 Multica 가능) | `runs/{slug}/p3-make/` |
| publisher | P5 파생 | `runs/{slug}/p5-derive/` · 노션 |
| judge | 판정 (읽기 전용) | 없음 |
| Codex 교차 리뷰 | 리뷰 | `runs/{slug}/review/` |

frontmatter의 `tools`·`disallowedTools`는 Claude Code 전용 표기다. 다른 에이전트는 본문 규칙과 위 편집 범위를 지킨다.

## 모두가 지킬 것
- 통과·실패는 `node harness/scripts/verify.mjs <slug> [--stage=Pn]` 종료 코드로만 정한다 (0 통과 · 1 실패/승인 대기 · 2 오류 · 3 차단).
- `runs/{slug}/approval.md`는 사람만 쓴다. `state.json`·`p4-check/report.json`은 verify.mjs만 쓴다.
- 자기 편집 범위 밖에 쓰지 않는다. Claude Code에서는 hook(`.claude/settings.json`)이 강제하고, 그 밖의 에이전트 결과는 judge가 대조한다.
- md가 정본, 노션은 파생. 앱 리포 코드는 읽기만 한다.
- 규칙 수치는 `rules.yaml`에서 읽는다. 이 파일이나 역할 파일에 수치를 복사하지 않는다.
- 저장·계산은 공용 스크립트로만 한다 — 에이전트마다 결과가 달라지지 않게:
  - 결과 블록 저장: `node harness/scripts/save-blocks.mjs <slug> <P1|P2|P3|P5|JUDGE|REVIEW> < 출력`
  - QA 통계·파생본·노션 결과 반영: `node harness/scripts/qa-tools.mjs <fill-stats|derive|merge-results> <slug>`
  - 이벤트 드리프트·시트 적용: `node harness/scripts/event-tools.mjs <drift|apply> <version>-events`
  - Figma 노드 내보내기·지문: `harness/scripts/figma-export.figma.js` (export 모드 = maker, digest 모드 = judge — 코드 본문을 고치지 않는다)
- 실행은 `verify.mjs <slug> --init` 으로 시작한다. `runs/<slug>/` 에는 지금 단계 폴더에만 쓴다 (`--status` 로 확인)
- `rules.yaml` `sources` 에서 `임의` 인 값은 하네스가 정한 값 — 사용자 확인 대상이다

## 리뷰 · 점수
- 하네스 점수는 `node harness/scripts/score.mjs` 출력 **그대로** 쓴다 (100점, 항목별 근거 포함). 에이전트가 따로 점수를 매기지 않는다.
- 리뷰 의견은 점수 아래에 "점수 밖 의견"으로 따로 적고, 심각한 순서로 · 코드로 확인한 것만 적는다.
- 교차 리뷰 결과는 `runs/{slug}/review/<에이전트>.md` (실행 리뷰) 또는 대화로 낸다.
