**목적: 버전 × 업무 실행 1회의 모든 게이트가 통과(exit 0)하고, ★A·B 위반이 0건이며, md 정본과 노션 파생본의 항목 수가 같다.**

# CLAUDE.md — Clipdoggy 디자인 하네스

@AGENTS.md

## 자연어 요청 라우팅 (필수)
아래 요청은 슬래시 명령이 없어도 **`run-harness` 스킬을 불러 그 절차대로** 진행한다.
- "1.1.2 메뉴바 화면 하네스 돌려줘" · "1.1.2 스크린샷 / QA 시트 / 이벤트 시트 하네스 돌려줘"
- "이어서 해줘" · "하네스 상태 알려줘"
- "승인했어" · "진행해" · "노션 동기화해줘"

## Claude Code 전용
- 서브에이전트는 `.claude/agents/`의 collector · planner · maker · publisher · judge. 결과는 블록으로 받아 `save-blocks.mjs`로만 저장한다
- hook(`guard-write` · `guard-judge` · `guard-review`)에 막히면 우회하지 않고 사람에게 보고한다

## 파일마다 쓰는 쪽
| 파일 | 쓰는 쪽 |
|---|---|
| `docs/*` | 사람 (인터뷰로 확정) |
| `harness/rules.yaml` · `defaults.yaml` | 사람 승인 뒤 메인 세션 (실행 중에는 고치지 않음) |
| `runs/{slug}/p1~p3, p5/*` | save-blocks.mjs · qa-tools.mjs · event-tools.mjs — 지금 단계 폴더에만 (PNG는 maker 렌더 스크립트) |
| `runs/{slug}/approval.md` · `unblock.md` | 사람만 |
| `runs/{slug}/state.json` · `p4-check/report.json` · `approval-stale-*.md` | verify.mjs만 |
| 앱 리포 `{app_repo}/docs/qa/` · `{app_repo}/docs/events/` · `{app_repo}/design-resource/` · 노션 | publisher 결과를 받아 메인 세션 |

## 판정 결과별 행동
0 다음 단계 · 1 실패는 `on_fail` 단계로 / 승인 대기는 멈추고 안내 · 2 멈추고 보고 · 3 멈추고 보고, 스스로 풀지 않음 · 4 사용자 확인 대기 — 진행 지시 전에는 멈춤 · `(보고만)` 경고는 사용자에게 전달하고 진행

## 첫 실행에 묻기
버전 · (ux) 화면 주제와 Figma URL · 앱 리포 경로(`../clipdoggy`) · `rules.yaml` `sources` 의 `임의` 값을 그대로 쓸지

## 절대 금지
approval·unblock 대신 쓰기 · 차단 풀기 · 사용자 지시 없이 `--proceed` · 실행 중 rules.yaml 수치 변경 · 앱 리포 코드 수정 (이벤트 삽입 포함) · PRD·릴리즈 노트에 없는 기능 지어내기

## 명령
```bash
cd harness && npm ci                                       # 최초 1회 (yaml)
node harness/scripts/verify.mjs <slug> --init [--figma=<URL>]   # 실행 시작
node harness/scripts/verify.mjs <slug> [--stage=<P1…P5|HUMAN>]  # 판정 (단계 생략 = 다음 단계)
node harness/scripts/verify.mjs <slug> --status              # 상태 (exit 3 차단 · 4 확인 대기)
node harness/scripts/verify.mjs <slug> --figma-code          # judge 가 돌릴 Figma 지문 코드
node harness/scripts/verify.mjs <slug> --proceed             # 사용자 확인 대기 해제 (사용자 지시로만)
node harness/scripts/verify.mjs <slug> --reopen=<단계>       # 그 단계부터 다시 (산출물 유지)
node --test harness/tests/*.test.mjs                         # 게이트 회귀
node harness/scripts/score.mjs                               # 하네스 점수
```
