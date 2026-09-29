# self-made-harness

반복되는 디자인/프로덕트 작업을 Claude Code가 **같은 품질 기준으로** 수행하도록 만드는 디자인 하네스.
(Hurdle Club 워크숍 · 2026-09-29 21:00 KST)

## 구조

| 파일 | 역할 |
|---|---|
| `docs/PRD.md` | 서비스 컨텍스트 — 5블록 PRD |
| `docs/design.md` | 디자인 기준 — 철학 · 컬러 · 타이포 · 레이아웃 · 컴포넌트 · Do/Don't |
| `docs/work-domains.md` | 하네스로 자동화할 반복 업무 (스크린샷 · QA 시트 · 이벤트 시트) |
| `docs/story-service.md` · `docs/story-work.md` | 서비스 맥락(★ 어기면 안 되는 것) · 손작업 흐름 |
| `CLAUDE.md` · `AGENTS.md` | 하네스 입구 — Claude 전용 / 모든 에이전트 공용 |
| `harness/rules.yaml` | 규칙 SSOT — 파이프라인 · 게이트 · 사전 · 토큰 수치 |
| `harness/scripts/` | 판정(`verify.mjs`) · 저장(`save-blocks.mjs`) · QA/이벤트 도구 · Figma 지문(`figma-export.figma.js`) · 점수(`score.mjs`) · guard hook 3개 |
| `harness/templates/` · `harness/guides/` | 단계별 산출물 양식 · 업무별 가이드 |
| `harness/tests/` | 게이트별 통과·실패 테스트 (`node --test harness/tests/*.test.mjs`) |
| `.claude/` | 에이전트 5개 · `run-harness` 스킬 · hook 설정 |
| `tool/` | 하네스가 부르는 외부 도구 — 역할은 [tool/README.md](tool/README.md) |
| `.mcp.json` | 프로젝트 MCP — UI Bowl · Mobbin · artemis-codex · Scrapling |
| `COPYRIGHT.md` | 저작권 · 서드파티 라이선스 고지 |

### 도구 한눈에

| 도구 | 역할 |
|---|---|
| artemis-codex | 에뮬레이터·시뮬레이터 조작 MCP — 앱 실행·탭·캡처, 작업 근거·보고서 기록 |
| Scrapling | 웹 스크래핑 + MCP — 스토어 페이지·리뷰·레퍼런스 문구 수집 |
| self-made-design-ops | 디자인시스템 실측 코퍼스·검수 절차·i18n 린터 — 필요한 폴더만 호출 |
| UI Bowl MCP | 국내 앱 화면·플로우·문구 레퍼런스 검색 |
| Mobbin MCP | 글로벌 앱 화면·플로우 레퍼런스 검색 |

설치: `bash tool/setup.sh`

워크숍에서 여기에 Claude 프롬프트와 프로세스 게이트가 추가됩니다.

## 사전 준비 체크리스트

- [x] Claude Code 설치 (Pro+)
- [x] GitHub 계정 · 빈 작업 리포 (이 리포)
- [x] Figma MCP 연결 (Figma Pro+)
- [x] UI Bowl MCP 연결 (무료) — `https://uibowl.io/api/mcp`
- [x] Mobbin MCP 연결 (claude.ai 커넥터)
- [x] `docs/PRD.md` 5블록 — Clipdoggy
- [x] `docs/design.md` 초안 — Clipdoggy 코드 토큰 기반 (확인 필요 항목 있음)
- [x] `docs/work-domains.md` — 스토어 스크린샷 · QA 시트
