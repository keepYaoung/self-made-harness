# CLAUDE.md — Clipdoggy 디자인 하네스

**목적:** 버전 × 업무 실행 1회의 모든 게이트가 통과(exit 0)하고, ★A·B 위반이 0건이며, md 정본과 노션 파생본의 항목 수가 같다.

@AGENTS.md

## Claude Code 전용
- 트리거("1.1.2 QA 시트 하네스 돌려줘", "1.1.2 이벤트 시트 하네스 돌려줘" 등) → `.claude/skills/run-harness/SKILL.md` 절차를 따른다
- 서브에이전트는 `.claude/agents/`의 collector · planner · maker · publisher · judge. 결과는 블록으로 받아 `save-blocks.mjs`로만 저장한다
- hook(`guard-write` · `guard-judge`)에 막히면 우회하지 않고 사람에게 보고한다

## 파일마다 쓰는 쪽
| 파일 | 쓰는 쪽 |
|---|---|
| `docs/*` | 사람 (인터뷰로 확정) |
| `harness/rules.yaml` · `defaults.yaml` | 사람 승인 뒤 메인 세션 |
| `runs/{slug}/p1~p3, p5/*` | save-blocks.mjs · qa-tools.mjs · event-tools.mjs (PNG는 maker 렌더 스크립트) |
| `runs/{slug}/approval.md` · `unblock.md` | 사람만 |
| `runs/{slug}/state.json` · `p4-check/report.json` | verify.mjs만 |
| 앱 리포 `{app_repo}/docs/qa/` · `{app_repo}/docs/events/` · `{app_repo}/design-resource/` · 노션 | publisher 결과를 받아 메인 세션 |

## 판정 결과별 행동
0 다음 단계 · 1 실패는 `on_fail` 단계로 / 승인 대기는 멈추고 안내 · 2 멈추고 보고 · 3 멈추고 보고, 스스로 풀지 않음 · `(보고만)` 경고는 사용자에게 전달하고 진행

## 첫 실행에 묻기
버전 · (ux) 화면 주제와 Figma 링크 · 앱 리포 경로(`../clipdoggy`)

## 절대 금지
approval·unblock 대신 쓰기 · 차단 풀기 · 실행 중 rules.yaml 수치 변경 · 앱 리포 코드 수정 (이벤트 삽입 포함) · PRD·릴리즈 노트에 없는 기능 지어내기

## 명령
```bash
cd harness && npm ci                   # 최초 1회 (yaml)
node --test harness/tests/*.test.mjs   # 게이트 회귀
node harness/scripts/score.mjs         # 하네스 점수
```
