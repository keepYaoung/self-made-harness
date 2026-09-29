# tool/

하네스가 호출하는 외부 도구 모음. 앱이나 산출물에 포함되는 의존성이 아니다.
설치본·가상환경·캐시·결과는 Git에 올리지 않고, **버전 고정 파일과 실행 스크립트만** 관리한다.

## 도구와 역할

| 도구 | 역할 | 하네스에서 쓰는 곳 | 가져오는 방식 |
|---|---|---|---|
| [artemis-codex](artemis-codex/README.md) | 기기 조작 MCP — 에뮬레이터·시뮬레이터에서 앱 실행·탭·캡처, 작업 계획·체크포인트·근거·보고서 기록 | 스토어 스크린샷 캡처, QA 시트 항목 실제 검증 | ClipDoggy `tool/artemis-codex` 복사 (소스만) |
| Mobile MCP · XcodeBuildMCP | artemis-codex 가 내부에서 부르는 Android/iOS 조작·빌드 도구 | 위와 동일 (직접 호출은 드묾) | `package-lock.json` 고정, `npm ci` |
| [Scrapling](scrapling/) | 웹 스크래핑 프레임워크 + MCP 서버 — 페이지를 가져와 필요한 부분만 추출 | 스토어 경쟁앱 페이지·리뷰 수집, 레퍼런스 문구 수집 | `keepYaoung/Scrapling` 포크를 git submodule |
| self-made-design-ops | 디자인시스템 117개 실측 코퍼스 + 검수·로컬라이제이션·이벤트 시트 절차 + 린터 | `design.md` 값 근거, 디자인 리뷰, i18n 문구 린트, 목업 인벤토리 | **필요한 폴더만** `giget`(npx)로 그때그때 받음 |
| UI Bowl MCP | 국내 앱 화면·플로우·문구·컴포넌트 검색 | 화면 레퍼런스, 스크린샷 카피 톤 비교 | 원격 HTTP MCP (`.mcp.json`) |
| Mobbin MCP | 글로벌 앱 화면·플로우 검색 | 화면 레퍼런스, 스토어 스크린샷 사례 | 원격 HTTP MCP (`.mcp.json`) |

## MCP 등록

저장소 루트의 [`.mcp.json`](../.mcp.json) 에 네 서버가 프로젝트 범위로 등록돼 있다.
Claude Code 로 이 폴더를 열면 처음 한 번 사용 승인을 묻는다.

| 서버 | 종류 | 처음 할 일 |
|---|---|---|
| `uibowl` | HTTP | `/mcp` → uibowl → Authenticate (유아이볼 구글 로그인). 무료는 검색당 3개 |
| `mobbin` | HTTP | `/mcp` → mobbin → Authenticate. claude.ai 커넥터로 이미 연결돼 있으면 도구가 중복으로 보일 수 있다 |
| `artemis-codex` | stdio | `bash tool/setup.sh` 후 사용 |
| `scrapling` | stdio | `bash tool/setup.sh` 후 사용. 브라우저 기반 수집은 `bash tool/run.sh scrapling install` 추가 |

## 설치

필수: macOS, Node 22.12+, uv (Python 3.12+). Android 작업은 ADB, iOS 는 Xcode.

```bash
bash tool/setup.sh
```

하는 일: Scrapling 서브모듈 받기 → artemis-codex 가상환경 → Mobile MCP·XcodeBuildMCP `npm ci` → Scrapling 가상환경(`[ai]` 포함).

## self-made-design-ops — 필요할 때만 호출

전체 저장소(20MB)를 복사하지 않는다. 필요한 폴더만 `tool/.cache/design-ops/` 로 받아 캐시한다.
한 번 받은 폴더는 재사용하고, 최신으로 다시 받으려면 `DESIGN_OPS_REFRESH=1` 을 붙인다.

```bash
# 문서·데이터 받기 (받은 경로를 출력)
bash tool/run.sh design-ops get agents              # 검수·로컬라이제이션·이벤트 절차
bash tool/run.sh design-ops get design-systems/patterns   # 9개 패턴 축 + 「구현 시 기본값」
bash tool/run.sh design-ops get mockups             # 공식 디바이스 목업 인벤토리
bash tool/run.sh design-ops get profiles            # DESIGN.md 프로필

# 도구 실행 (필요한 폴더를 자동으로 받음)
bash tool/run.sh design-ops i18n-lint en-US.json ko-KR.json --lang=ko
bash tool/run.sh design-ops events template.csv
```

## 실행 래퍼

모든 도구는 `tool/run.sh` 로 부른다.

```bash
bash tool/run.sh {artemis-codex|xcodebuildmcp|mobile-mcp|scrapling|design-ops} [arguments...]
```

## 주의

- artemis-codex·Mobile MCP 는 연결된 기기에서 앱 설치·입력·캡처를 한다. 작업 시 기기 ID(`emulator-5556` 등)를 지정하고, 다른 작업이 쓰는 기기는 건드리지 않는다.
- 원본 Google Artemis(별도 모델 API 필요)는 가져오지 않았다. artemis-codex 는 모델 API 없이 Claude/Codex 가 판단한다.
- 라이선스는 [COPYRIGHT.md](../COPYRIGHT.md).
