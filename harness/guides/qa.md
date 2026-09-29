# 릴리즈 QA 시트

손작업 흐름: `docs/story-work.md` W3 · 멈칫 G-f(통계를 손으로 세다 틀림) · G-g(파생본 직접 수정)

| 단계 | 누가 | 양식 | 통과 게이트 | 실패 시 |
|---|---|---|---|---|
| P1 수집 | collector (TODO · 릴리즈 노트 · git log) | `templates/qa/scope.md` | ART | P1 |
| P2 설계 | planner | `templates/qa/items.md` | ART | P1 |
| P3 제작 | maker → 저장 뒤 `qa-tools.mjs fill-stats` | `templates/qa/qa-sheet.md` | ART | — |
| 👤 | 사람 | `templates/common/approval.md` | APPROVAL | P2 |
| P4 대조 | judge | — | ★A1 · Q1 범위↔섹션 · Q2 빈 칸·우선 값 · Q3 통계(G-f) · Q4 직전 버전 중복 | P3 |
| P5 파생 | `qa-tools.mjs merge-results` → `derive` → publisher 노션 | `templates/common/sync-log.md` | Q5 파생본 수(G-g) | P5 |

## 자주 걸리는 곳
- **Q3** — 머리 통계는 사람도 에이전트도 세지 않는다. `{{STATS}}` 자리만 두고 `fill-stats` 로 채운다
- **Q1** — 범위 표에 `섹션` 열이 없으면 영역별 항목 수를 셀 수 없어 실패 (1.1.1 손작업 시트가 이 경우)
- **Q4** — 1.1.1 손작업 시트에도 1.1.0 과 같은 항목 제목이 있었다. 회귀 항목은 제목을 바꿔 "이번에 바뀐 것"을 드러낸다
- **Q5** — 노션에서 결과를 적었으면 다음 동기화 전에 `merge-results` 로 정본에 먼저 가져온다 (체크 유실 방지). 결과가 정본에 들어가면 승인 해시가 바뀌어 다음 P4 는 재승인이 필요하다
