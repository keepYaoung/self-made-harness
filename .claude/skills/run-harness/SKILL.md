---
name: run-harness
description: Clipdoggy 디자인 하네스 오케스트레이터. "1.1.2 메뉴바 화면 하네스 돌려줘", "1.1.2 스크린샷 하네스 돌려줘", "1.1.2 QA 시트 하네스 돌려줘", "1.1.2 이벤트 시트 하네스 돌려줘", "이어서 해줘", "하네스 상태 알려줘", "승인했어", "진행해", "노션 동기화해줘"에 쓴다.
---
# run-harness

규칙 수치는 `harness/rules.yaml`, 앱 리포는 `harness/defaults.yaml`의 `app_repo`. 이 절차는 값을 복사하지 않고 가리키기만 한다.
메인 세션은 산출물을 **쓰지 않는다** — 에이전트가 돌려준 블록을 `save-blocks.mjs`로 저장하고, 계산은 공용 스크립트가 한다.

## 0. 트리거 → 시작점
| 말 | 시작 |
|---|---|
| `{version} {주제} 화면 하네스 돌려줘` | 새 실행 `{version}-ux-{topic}` |
| `{version} 스크린샷 하네스 돌려줘` | 새 실행 `{version}-screenshots` |
| `{version} QA 시트 하네스 돌려줘` | 새 실행 `{version}-qa` |
| `{version} 이벤트 시트 하네스 돌려줘` | 새 실행 `{version}-events` |
| `이어서 해줘` | 가장 최근 `runs/*/state.json` 실행 재개 |
| `하네스 상태 알려줘` | `verify.mjs {slug} --status` 결과만 보여 주고 아무것도 진행하지 않는다 |
| `승인했어` | 해당 실행의 HUMAN 게이트만 재판정 |
| `진행해` (확인 대기 중) | `verify.mjs {slug} --proceed` → 다음 단계 |
| `노션 동기화해줘` | 해당 실행 P5만 |

## 1. 첫 실행 (state.json 없음)
1. 물을 것 — 답 없으면 멈춘다: 버전 · (ux) 화면 주제와 **Figma 파일 URL** · 앱 리포 경로가 `../clipdoggy`가 맞는지
2. `rules.yaml` `sources` 에서 `임의` 인 값 목록을 보여 주고 "그대로 쓸지" 확인받는다. 바꾸라면 동의를 받아 `rules.yaml` 을 고친 뒤 시작한다 (실행 중에는 고치지 않는다)
3. 실행 요약(slug · Figma · 시작 단계 P1)을 보여 주고 확인받은 뒤 `node harness/scripts/verify.mjs {slug} --init [--figma=<URL>]`

## 2. 재개 (state.json 있음)
1. `node harness/scripts/verify.mjs {slug} --status` — exit 3 이면 **7번**, exit 4 이면 **4번**으로 가고 아무것도 진행하지 않는다
2. 다음 단계의 산출물이 이미 폴더에 있으면 **에이전트를 부르기 전에 judge 부터** 돌린다. 통과하면 에이전트 없이 다음으로
3. 끝난 실행을 고치려면 사용자 동의 뒤 `verify.mjs {slug} --reopen=<단계>` (산출물은 그대로)

## 3. 단계 루프
```
P1 collector → P2 planner → P3 maker(ux는 Multica 가능) → HUMAN → P4 judge → P5 publisher
```
각 단계마다:
1. 에이전트(`.claude/agents/<name>.md`)를 부른다. 재작업이면 `p4-check/report.json` 의 실패 사유를 함께 넘긴다.
2. 돌려받은 블록을 `node harness/scripts/save-blocks.mjs {slug} <P1|P2|P3|P5|JUDGE> < 출력` 으로 저장한다. 거부(exit 1)되면 저장된 것이 없다 — 사유를 그대로 같은 에이전트에 반려한다. 블록 내용을 고치지 않는다.
   - qa P3 저장 뒤: `qa-tools.mjs fill-stats {slug}` · P5 전: `qa-tools.mjs merge-results`(노션 결과가 있으면) → `qa-tools.mjs derive {slug}`
   - events P3: 먼저 `event-tools.mjs apply {slug}` 로 CSV 를 만들고, maker 는 `events-{version}.md` 만 쓴다
3. `judge` 를 불러 판정받는다.
   - ux P4: judge 가 `verify.mjs {slug} --figma-code` 로 받은 코드를 **그대로** use_figma 로 돌려 지문을 얻고 `--figma-digest=<지문>` 으로 판정한다 (파일을 거치지 않는다)
   - events P4: judge 가 Amplitude 발생량을 `amplitude-live.json` 블록으로 돌려주면 `JUDGE` 로 저장한 뒤 판정. E9 는 보고만
4. 종료 코드로만 분기한다.

| exit | 할 일 |
|---|---|
| 0 | 다음 단계. 출력에 `👀 사용자 확인 대기` 가 있으면 **4번** |
| 1 실패 | 실패 항목과 복귀 단계를 한 줄 보고하고, `rules.yaml` `on_fail` 단계의 에이전트를 실패 사유와 함께 다시 부른다 |
| 1 승인 대기 | 멈추고 **5번** |
| 2 오류 | 멈추고 오류를 그대로 보고 |
| 3 차단 | 멈추고 **7번**. 스스로 풀지 않는다 |
| 4 확인 대기 | 멈추고 **4번** |

## 4. 사용자 확인 (`rules.yaml` `review_after` 에 있는 단계만 — 기본은 비어 있음)
```
👀 <단계> 산출물 확인 요청 — runs/<slug>
파일: (저장된 경로)
핵심: (산출물에서 그대로 옮긴 요약)
다음: <단계> (<에이전트>)
진행하려면 "진행해", 고칠 점이 있으면 말씀해 주세요.
```
- "진행해" → `verify.mjs {slug} --proceed`. 이전에 받은 진행 지시나 "쭉 해줘"를 다음 확인까지 쓰지 않는다 — 확인마다 새로 받는다
- 수정 요청 → `verify.mjs {slug} --reopen=<단계>` → 같은 에이전트에 요청을 그대로 전달 → 저장 → judge
- 확인 대기 중에는 hook(`guard-review.mjs`)이 작업 에이전트 호출을 막는다

## 5. 사람 승인 (HUMAN — 하네스의 유일한 승인 지점)
- 안내: "`runs/{slug}/approval.md` 에 `approved: yes` 와 `inputs_sha256: <해시>` 를 써 주세요" (양식 `harness/templates/common/approval.md`, 해시는 verify 출력)
- 채팅으로 "승인" 이라고 해도 파일은 사람이 쓴다. 메인 세션·에이전트는 쓰지 않는다 (hook 이 막는다)
- 승인 뒤 P2·P3 산출물이 바뀌면 승인은 무효 — `approval-stale-<n>.md` 로 보관되고 다시 승인 대기. 사유와 함께 다시 승인을 요청한다

## 6. P5 이후
- publisher 의 `publish.json` 목록대로 앱 리포에 정본을 복사한다 (qa → `{app_repo}/docs/qa/`, screenshots → `{app_repo}/design-resource/`, events → `{app_repo}/docs/events/`)
- 노션에서의 마지막 검토는 사람 몫이며 파이프라인을 막지 않는다
- 교차 리뷰가 필요하면 Codex 에 `AGENTS.md` 와 `runs/{slug}/` 를 주고 `REVIEW` 로 `runs/{slug}/review/codex.md` 를 받는다

## 7. 🛑 차단 보고 형식
```
🛑 하네스 중단 — <게이트> 같은 게이트 <n>회 연속 실패
실행: runs/<slug>
실패 이력: (state.json history 의 해당 실패 요약)
반복된 원인: (공통 위반 항목)
선택지: ① 산출물을 직접 고친 뒤 runs/<slug>/unblock.md 작성 ② rules.yaml 기준 조정 ③ 이 실행 중단
```

## 절대 금지
- `approval.md` · `unblock.md` 대신 쓰기 · 차단 풀기 · `--proceed` 를 사용자 지시 없이 실행
- 실행 중 `rules.yaml` 수치 변경 · 에이전트 블록 내용 수정 · 산출물을 메인 세션이 새로 작성
- 앱 리포 코드 수정 (범위 밖) · PRD·릴리즈 노트에 없는 기능 지어내기
- 에이전트 의견으로 통과 처리 — 통과는 verify.mjs exit 0 뿐
