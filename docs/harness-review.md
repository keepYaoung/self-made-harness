# 하네스 리뷰 — 참고 저장소 보강 (2026-09-29)

> 점수는 `node harness/scripts/score.mjs` 출력 그대로다 (AGENTS.md "리뷰 · 점수" 규칙). 에이전트가 따로 매긴 점수는 없다.
> 참고: 플레이북("하네스 인터뷰 플레이북")의 실제 구현 저장소 `figmatutor2/harness` (커밋 `aed12d0`).

## 1. 점수

같은 채점 기준(보강 뒤의 `score.mjs`)으로 보강 전 커밋 `8cf11db` 과 지금을 비교했다.

| 항목 | 만점 | 보강 전 `8cf11db` | 지금 | 달라진 이유 |
|---|---:|---:|---:|---|
| 판정 스크립트 · 테스트 통과 | 10 | 10 | 10 | 테스트 62 → 76 |
| 게이트별 실패 테스트 | 15 | 15 | 15 | 36개 전부 |
| ★ 서비스 금지 조건 게이트화 | 10 | 10 | 10 | ★A 3 · ★B 3 |
| 규칙 SSOT · 값 출처(임의 표시) | 10 | 5 | 10 | `rules.yaml` `sources` 27개 (임의 13) |
| 사람 승인 (파일 1개 · 무효화) | 10 | 10 | 10 | + 무효 승인 `approval-stale-<n>.md` 보관 |
| 편집 범위 강제 | 10 | 7 | 10 | `runs/` 는 지금 단계 폴더에만 |
| 도구 결과 대조 (Figma 지문 · OCR) | 10 | 4 | 10 | Figma 지문을 파일 없이 코드 고정으로 |
| 실패 복귀 · 재시도 한도 | 10 | 10 | 10 | |
| 문서 경로 일관성 | 10 | 10 | 10 | 62개 경로 |
| 실제 실행 1회 이상 완주 | 5 | 0 | 0 | 아직 트리거로 끝까지 돌린 실행 없음 |
| **합계** | **100** | **81** | **95** | |

- 보강 전 커밋은 임시 작업 폴더에서 채점해 테스트 61/62 였다 (실패 1건의 원인은 확인하지 않았다 — 앱 리포 상대 경로 영향으로 추정).
- 남은 5점은 실제 실행 기록이다. 새 세션에서 트리거로 한 번 끝까지 돌리면 채워진다.

## 2. 참고 저장소에서 가져온 것

| # | 참고 저장소 | 우리 하네스 반영 | 위치 |
|---|---|---|---|
| 1 | judge 가 `figma-ids` 출력 코드를 그대로 `use_figma` 로 돌리고 지문을 CLI 인자로 넘김 | 전: judge 가 `figma-live.json` 블록 → 메인 세션 저장 (중간에 고칠 수 있는 틈). 후: `verify.mjs <slug> --figma-code` → judge 가 그 코드 그대로 실행 → `--figma-digest=`. hook 이 코드가 한 글자라도 다르면 차단 | `harness/scripts/figma-export.figma.js` · `lib/digest.mjs` · `guard-judge.mjs` · U7 |
| 2 | `init` · `status` · `reopen --from` · `proceed` · 종료 코드 4 | `verify.mjs <slug> --init --figma=` (Figma file_key 기록 → U7 이 다른 파일 export 를 잡음) · `--status` · `--reopen=` · `--proceed` · exit 4 | `verify.mjs` |
| 3 | 무효가 된 컨펌을 `approval-stale-<n>.md` 로 보관 | 승인 해시 불일치 시 보관 후 승인 대기 | `verify.mjs` APPROVAL |
| 4 | guard-write: runs/ 는 state.json 의 다음 게이트 폴더에만 | 같은 규칙. `save-blocks.mjs` 도 지금 단계 역할만 저장. `init` 전에는 저장 불가 | `guard-write.mjs` · `save-blocks.mjs` · `lib/stage.mjs` |
| 5 | `defaults.yaml` 의 `source: 임의` (원칙 9) | `rules.yaml` `sources` — 인터뷰 · 문서 · 앱 시트 · 임의. 첫 실행에 임의 목록을 보여 주고 확인 | `rules.yaml` · `tests/sources.test.mjs` · SKILL 1번 |
| 6 | 단계별 사용자 확인 + guard-review hook | 장치는 넣고 **기본은 끔** (`review_after: []`) — 인터뷰 R3 에서 "사람 개입은 P3 뒤 한 곳"으로 정했기 때문. 켜려면 `review_after: [P1, P2]` | `rules.yaml` · `guard-review.mjs` · SKILL 4번 |
| 7 | CLAUDE.md 자연어 라우팅 절 · 명령 목록 · 🛑 차단 보고 형식 · 재개 시 산출물 있으면 judge 먼저 | 목적 문장을 첫 줄로(플레이북 R2) · 라우팅 · 명령 · 첫 실행 질문에 임의 값 확인 추가 | `CLAUDE.md` · `run-harness/SKILL.md` |
| 8 | hook `statusMessage` · `runs/.gitkeep` | 반영 | `.claude/settings.json` · `runs/.gitkeep` |

## 3. 가져오지 않은 것

| 참고 저장소 | 이유 |
|---|---|
| `save-export.mjs` — 에이전트 대화 기록에서 `use_figma` 조각을 꺼내 바이트 그대로 저장 | Claude Code 기록 형식에 묶여 Codex · Multica 에서 같은 동작을 보장할 수 없다 (요구사항: 모든 에이전트 동일 동작). 대신 maker 가 이어 붙인 `figma.json` 을 judge 지문이 대조하므로, 옮겨 적다 틀리면 U7 에서 걸린다 |
| P1 리서치 → … → P5 플로우 화면의 5단계 · 390×844 화면 골격 · 컴포넌트 변수 검사 | 허들링 앱 화면 제작 전용. 우리는 버전 × 업무(ux · screenshots · qa · events) 구조 |
| judge frontmatter hook | 같은 효과를 `settings.json` 전역 hook + `agent_type` 판별로 이미 낸다 (Codex 쪽 문서에도 한 곳에서 보이게) |
| `unblock` CLI 명령 | 우리는 사람이 `unblock.md` 를 쓰는 방식 — 에이전트가 명령 한 줄로 풀 수 없게 |

## 4. 플레이북 "마지막 점검" 7개

| 점검 | 상태 | 근거 |
|---|---|---|
| 예전 승인이 그대로 통과하지 않나 | ✅ | 입력 해시 · 무효 시 `approval-stale-<n>.md` (flow.test) |
| export 를 실제 도구 상태와 대조하나 | ✅ (모의) | Figma: 코드 고정 지문 · mock figma 로 export ↔ digest 일치 확인 (digest.test). **실제 Figma 파일에서는 아직 안 돌림** |
| 가이드 규칙이 전부 스크립트로 검사되나 | ⚠️ | 색·간격·라운드·글자·CTA·표기는 게이트. `docs/design.md` 접근성(대비·터치 영역)은 게이트 없음 |
| "하지 않는다" 문장까지 키워드 검사가 잡지 않나 | ✅ | `text_scope` 를 카피 열로 한정 (gates.test ★A1 통과 사례) |
| 옛 경로가 남은 문서 없나 | ✅ | score 문서 경로 62개 전부 존재 |
| hook · guard 가 git 에 있나 | ✅ | `.claude/settings.json` · `harness/scripts/guard-*.mjs` 커밋 |
| 게이트 판정을 테스트로 다시 돌릴 수 있나 | ✅ | `node --test harness/tests/*.test.mjs` 76개 |

## 5. 남은 일

1. **실제 실행 1회** — 새 세션에서 `1.1.2 QA 시트 하네스 돌려줘` (가장 가벼움) 또는 이벤트 시트. 점수 +5
2. **Figma 지문 실물 확인** — ux 실행 때 judge 가 `--figma-code` 코드를 실제 파일에서 돌려 export ↔ digest 가 맞는지
3. **임의 값 13개 확인** — `rules.yaml` `sources` 에서 `임의` 인 것: ★A·★B 사전 · 개인정보 정규식 · 결제 화면 정규식 · 동기화 흐름 이름 · 언어 혼입 기준(3자 · 60%) · 이벤트 이름 형식 · 개인정보 · 클립 원문 프로퍼티 · 동기화 카테고리 · fakedoor 값
4. **접근성 게이트** — `docs/design.md` Accessibility 절(흰 글씨 대비 · 터치 48dp · CTA 52dp) 을 셀 수 있는 조건으로

## 재현

```bash
cd harness && npm ci && cd ..
node --test harness/tests/*.test.mjs   # 76 pass
node harness/scripts/score.mjs         # 95 / 100
```
