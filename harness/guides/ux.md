# UX/UI 화면 디자인

손작업 흐름: `docs/story-work.md` W1 · 멈칫 G-a(Figma가 PRD 기능을 다 담았나) · G-b(코드와 같은가)

| 단계 | 누가 | 양식 | 통과 게이트 | 실패 시 |
|---|---|---|---|---|
| P1 수집 | collector | `templates/ux/scope.md` | ART | P1 |
| P2 설계 | planner (UI Bowl · Mobbin) | `templates/ux/references.md` · `screens.md` · `spec.md` | U1 레퍼런스 수·출처 · U2 기능 매핑(G-a) | P1 |
| P3 제작 | maker 또는 Multica (Figma MCP) | `templates/ux/figma.json` | ART | — |
| 👤 | 사람 — Figma 보강 후 승인 | `templates/common/approval.md` | APPROVAL | P2 |
| P4 대조 | judge (`--figma-code` 코드를 use_figma 로 → `--figma-digest`) | — | ★A1 · ★A2 · ★B1 · ★B2 · U3 색 · U4 간격·라운드·글자 · U5 CTA · U6 표기 · U7 지문(G-b) | 대부분 P3, ★ 카피 문제는 P2 |
| P5 파생 | publisher | `templates/common/sync-log.md` | ART | P5 |

## 자주 걸리는 곳
- **U7** — Figma 를 보강한 뒤 `figma.json` 을 다시 내보내지 않으면 지문이 달라 실패한다. 보강 후에는 maker 가 `figma-export.figma.js` 로 다시 내보낸다. init 때 준 Figma 파일과 다른 파일에서 내보내도 실패
- **U4** — 화면 여백을 눈대중으로 잡으면 `design_tokens.spacing` 밖 값이 나온다. 패널 노드는 이름에 `panel` 이 있어야 패널 라운드가 허용된다
- **★A2** — 연결·동기화 흐름 화면에 E2EE 신호 문구가 하나도 없으면 실패
- **U6** — 옛 표기 `brand_forbidden`
