---
name: run-harness
description: Clipdoggy 디자인 하네스 오케스트레이터. "1.1.2 메뉴바 화면 하네스 돌려줘", "1.1.2 스크린샷 하네스 돌려줘", "1.1.2 QA 시트 하네스 돌려줘", "1.1.2 이벤트 시트 하네스 돌려줘", "이어서 해줘", "승인했어", "노션 동기화해줘"에 쓴다.
---
# run-harness

규칙 수치는 `harness/rules.yaml`, 앱 리포는 `harness/defaults.yaml`의 `app_repo`. 이 절차는 값을 복사하지 않고 가리키기만 한다.

## 0. 트리거 → 시작점
| 말 | 시작 |
|---|---|
| `{version} {주제} 화면 하네스 돌려줘` | 새 실행 `{version}-ux-{topic}` P1 |
| `{version} 스크린샷 하네스 돌려줘` | 새 실행 `{version}-screenshots` P1 |
| `{version} QA 시트 하네스 돌려줘` | 새 실행 `{version}-qa` P1 |
| `{version} 이벤트 시트 하네스 돌려줘` | 새 실행 `{version}-events` P1 |
| `이어서 해줘` | 가장 최근 `runs/*/state.json`의 마지막 통과 다음 단계 |
| `승인했어` | 해당 실행의 HUMAN 게이트만 재판정 |
| `노션 동기화해줘` | 해당 실행 P5만 |

## 1. 첫 실행에 물을 것 (답 없으면 멈춤)
- 버전 · (ux) 화면 주제와 Figma 파일 링크 · 앱 리포 경로가 `../clipdoggy`가 맞는지

## 2. 단계 루프
```
P1 collector → P2 planner → P3 maker(ux는 Multica 가능) → HUMAN → P4 → P5 publisher
```
각 단계마다:
1. 해당 에이전트(`.claude/agents/<name>.md`)를 부른다. 재작업이면 `p4-check/report.json`을 함께 넘긴다.
2. 돌려받은 블록을 `node harness/scripts/save-blocks.mjs {slug} <P1|P2|P3|P5|JUDGE> < 출력` 으로 저장한다. 거부(exit 1)되면 에이전트에 반려한다.
   - qa P3 저장 뒤: `node harness/scripts/qa-tools.mjs fill-stats {slug}` · P5 전: `qa-tools.mjs derive {slug}`
   - events P3: 먼저 `node harness/scripts/event-tools.mjs apply {slug}` 로 CSV 를 만들고, maker 는 `events-{version}.md` 만 쓴다
3. `judge`를 불러 `node harness/scripts/verify.mjs {slug} --stage=<단계>` 판정을 받는다. ux P4는 `figma-live.json`, events P4는 `amplitude-live.json` 을 judge 가 돌려주면 JUDGE 로 먼저 저장한다. E9 는 보고만(`! (보고만)`) — 사용자에게 전달하고 통과 처리
4. 종료 코드로만 분기한다.

| exit | 할 일 |
|---|---|
| 0 | 다음 단계 |
| 1 실패 | `rules.yaml` 해당 게이트 `on_fail` 단계로 돌아가 report.json을 넘긴다 |
| 1 승인 대기 | 멈추고 안내: "`runs/{slug}/approval.md`에 `approved: yes`와 `inputs_sha256`을 쓴 뒤 '승인했어'" (해시는 verify.mjs 출력에 있다) |
| 2 오류 | 멈추고 오류를 그대로 보고 |
| 3 차단 | 멈추고 보고. 스스로 풀지 않는다 |

## 3. P5 이후
- publisher의 `publish.json` 목록대로 앱 리포에 정본을 복사한다 (qa → `{app_repo}/docs/qa/`, screenshots → `{app_repo}/design-resource/`).
- 노션에서의 마지막 검토는 사람 몫이며 파이프라인을 막지 않는다.
- 교차 리뷰가 필요하면 Codex에 `AGENTS.md`와 `runs/{slug}/`를 주고 `runs/{slug}/review/codex.md`를 받는다.

## 절대 금지
- `approval.md` 대신 쓰기 · 차단(exit 3) 풀기 · 실행 중 `rules.yaml` 수치 변경
- 앱 리포 코드 수정 (범위 밖) · PRD에 없는 기능 지어내기
- 에이전트 의견으로 통과 처리하기 — 통과는 verify.mjs exit 0뿐
