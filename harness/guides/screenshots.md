# 스토어 스크린샷

손작업 흐름: `docs/story-work.md` W2 · 실패 예시 fixture `harness/tests/fixtures/runs/1.0.4-screenshots` (1.0.4 en 세트)

| 단계 | 누가 | 양식 | 통과 게이트 | 실패 시 |
|---|---|---|---|---|
| P1 수집 | collector (릴리즈 노트) | `templates/screenshots/scope.md` | ART | P1 |
| P2 설계 | planner | `templates/screenshots/copy.csv` | ART | P1 |
| P3 제작 | maker — artemis-codex 캡처 `raw/` · 템플릿 렌더 `out/` | — | ART | — |
| 👤 | 사람 | `templates/common/approval.md` | APPROVAL | P2 |
| P4 대조 | judge (+ macOS Vision OCR) | — | ★A2 신뢰 신호 · ★B1 · S1 규격 · S2 언어 · S3 줄 수 · S4 폐기 기능 문구 · S5 em dash·이모지 · S6 개인정보 · S7 금지 색·시각 · S8 표기 · S9 언어 혼입 | 카피는 P2, 캡처·렌더는 P3 |
| P5 파생 | publisher → `{app_repo}/design-resource/` | `templates/common/publish.json` | ART | P5 |

## 자주 걸리는 곳 (1.0.4 세트에서 실제로 걸린 것)
- **S4** — 캡처 화면 속 옛 기능 문구(Bluetooth, Pair …). 카피만 고쳐도 캡처 안에 남는다 → OCR 로 잡는다
- **S6** — 캡처 속 실제 기기명(`Tomy's …`). 데모 데이터로 다시 캡처
- **S7** — 잠금화면·알림 캡처의 시각이 `status_time` 과 다름
- **S9** — 영어 세트 캡처에 한국어 UI 가 남음 (앱 언어를 세트 언어로 바꾸고 캡처)
- **S3** — 가장 긴 언어 기준으로 줄 수 확인. `headline_lines` 는 렌더러가 채운다
- 파일명 언어 코드는 `ja` (앱 리포 기존 파일의 `jp` 는 규격 밖)
