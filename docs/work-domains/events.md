# 업무: 이벤트 시트 (event taxonomy)

## 조건 체크
- [x] 2회 이상 반복 — 버전 출시마다 이벤트 추가·병합·소거 (시트 90행 중 소거 57)
- [x] 품질이 들쭉날쭉 — 시트와 코드가 어긋남 (2026-09-29 기준 코드에만 있는 이벤트 25, 시트만 yes 3)
- [x] 파일로 남음 — 앱 리포 `docs/events/amplitude_events.csv`

## 입력
- `{app_repo}/docs/release-notes-{version}.md` 기능 항목 = 키 스펙 (K-ID)
- 같은 버전 UX 실행의 `screens.md` (있으면)
- 현재 시트 · 앱 코드의 분석 호출 (`event-tools.mjs drift`)

## 산출물
1. `amplitude_events.csv` — 기존 6열 + `purpose` · `since` (정본, `event-tools.mjs apply`로만 생성)
2. `events-{version}.md` — 목적 · 퍼널 · 질문 · 커버리지 (전달 문서)

## 규칙 출처
- 형식: 앱 기존 시트 유지 (운영 중 이름 변경 금지 — Amplitude 이력 보존)
- design-ops `event-taxonomy` 규약 중 이름을 바꾸지 않는 것만: 목적 필수 · 퍼널 절 · 미정 enum `…` · 개인정보 금지
- 게이트 E1–E9 · ★A5 · ★B6 → `harness/rules.yaml` `gates.events`
