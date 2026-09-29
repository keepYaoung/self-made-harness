# Copyright & Third-party Notices

## 이 저장소

Copyright (c) 2026 Self-made-Orange. All rights reserved.

비공개 저장소다. 아래 서드파티 구성요소를 제외한 문서·프롬프트·스크립트의 권리는 Self-made-Orange 에 있다.
`docs/PRD.md`, `design.md` 는 Clipdoggy 제품 정보를 담고 있어 외부 공유 전 확인이 필요하다.

## 서드파티 구성요소

| 구성요소 | 위치 | 저작권 | 라이선스 | 가져오는 방식 |
|---|---|---|---|---|
| artemis-codex | `tool/artemis-codex/` | ClipDoggy contributors. 일부 코드는 Google LLC Artemis 에서 변형 | Apache-2.0 ([LICENSE](tool/artemis-codex/LICENSE), [NOTICE](tool/artemis-codex/NOTICE.md)) | 소스 복사 |
| Scrapling | `tool/scrapling/` | Copyright (c) 2024, Karim Shoair | BSD-3-Clause ([LICENSE](tool/scrapling/LICENSE)) | git submodule (`keepYaoung/Scrapling`, upstream `D4Vinci/Scrapling`) |
| Mobile MCP (`@mobilenext/mobile-mcp` 1.0.3) | `tool/node_modules/` (설치 시) | mobile-next (패키지 LICENSE 에 개별 저작권 줄 없음) | Apache-2.0 | npm, `package-lock.json` 고정 |
| XcodeBuildMCP (`xcodebuildmcp` 2.7.0) | `tool/node_modules/` (설치 시) | Copyright (c) 2025 Cameron Cooke | MIT | npm, `package-lock.json` 고정 |
| Self-Made DesignOps | `tool/.cache/design-ops/` (호출 시) | Copyright (c) 2026 StudioSMO | 코드 MIT · 문서·코퍼스 CC BY 4.0 | `giget` 으로 필요한 폴더만 |

### 표기 규칙

- **Apache-2.0 (artemis-codex)**: `LICENSE` 와 `NOTICE.md` 를 지우거나 고치지 않는다. 파일을 수정하면 수정 사실을 남긴다.
- **BSD-3-Clause (Scrapling)**: 서브모듈 안의 저작권 고지를 유지한다. 원저작자 이름을 홍보·보증에 쓰지 않는다.
- **CC BY 4.0 (DesignOps 코퍼스)**: 코퍼스 수치를 `design.md` 나 산출물에 인용하면 출처를 단다.
  예: `Measurements from Self-Made DesignOps (StudioSMO), CC BY 4.0`

## 외부 서비스 (코드 미포함)

| 서비스 | 쓰는 곳 | 비고 |
|---|---|---|
| UI Bowl MCP (`uibowl.io`) | 화면 레퍼런스 검색 | 결과 이미지·화면은 각 앱의 저작물. 산출물에 그대로 넣지 않고 참고만 한다 |
| Mobbin MCP (`mobbin.com`) | 화면 레퍼런스 검색 | 위와 동일. 인용 시 Mobbin 링크로 출처 표기 |

## 산출물 (스토어 스크린샷 등)

- 화면 속 데이터는 연출용 가짜 데이터만 쓴다. 실제 개인정보·타사 로고·타사 UI 를 넣지 않는다.
- 클립 이미지·일러스트는 Clipdoggy 자체 에셋 또는 이 저장소에서 렌더한 그래픽만 쓴다.
- 폰트: Pretendard (SIL OFL 1.1) — 이미지에 렌더하는 것은 허용. Eudoxus Sans 는 라이선스 확인 필요.
