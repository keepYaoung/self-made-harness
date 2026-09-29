# 검증 기록 — 2026-09-10

## 최신 후속 수정

AXe/simctl 경로로 앱 실행·UI 구조·ref 탭·HOME·재진입을 실제 검증했다.
단위/경계 테스트는 20개 통과했다. 탭 직후 PNG 본문이 이전 상태를 보이는 제한이
남아 HOME/재진입 후 구조와 이미지의 일치를 확인했다. WDA 자체를 고친 것은 아니다.
[최신 상세 기록](../docs/ios-simulator-axe-validation-2026-09-10.md)

## 이전 앱 시나리오 검사

14:17–14:21 KST에 실제 ClipDoggy 시뮬레이터 앱으로 범위를 넓혀 검사했다.
앱 실행·PNG 캡처는 통과했지만, Mobile MCP UI 조회와 좌표 탭의 WDA 시작 시간
초과로 최종 결과는 **BLOCKED**다. 아래의 초기 관찰 검증 성공과 구분해야 한다.
[상세 결과·재현 절차·근거](../docs/ios-simulator-test-2026-09-10.md)

## 통과

- 단위/통합 경계 테스트 12개: 기기 고정, 로컬 기기 확인, 실패 로그,
  근거 없는 합격 차단, 오래된 근거 차단, 조작 결과와 관찰 구분,
  중단 이벤트 보존, 재시작 후 읽기, 경로 검증, 네이티브 캡처 분기 등.
- 실제 stdio MCP 초기화·도구 목록: artemis-codex 8개, 원본 Artemis 4개,
  XcodeBuildMCP 51개, Mobile MCP 32개.
- artemis-codex를 통한 로컬 기기 조회.
- iOS 26.3 `ClipDoggy Isolated QA` 시뮬레이터에서 실제 UI 구조 조회.
- simctl을 통한 PNG 캡처 및 MCP 이미지 반환, 실행 폴더 저장.
- 저장한 화면을 직접 확인하고 MCP 체크포인트 기록 → 완료 보고서 생성.
- 테스트 때문에 부팅한 시뮬레이터는 검증 후 종료.
- 셸 구문, JSON/TOML 파싱, `git diff --check` 통과.
- 별도 모델 SDK 의존성 및 모델 API 호출 없음.

실제 실행 보고서는 Git에서 제외된
`tool/results/atemis-codex/19bed0ded48b47dbac31b9112d3cf0ae/report.md`에 있다.
검증 결과 파일은 로컬 산출물이므로 새로 복제한 환경에는 없다.

## 발견 및 대응

- Mobile MCP 1.0.3에서 미설치 에이전트의 상태 조회가 실패해 자동 설치로
  이어지지 않았다. 테스트 시뮬레이터에 Device Kit 0.0.26을 명시적으로 설치했다.
- Mobile MCP의 WDA 기반 스크린샷에서 시작 시간 초과가 발생했다.
  artemis-codex의 기본 Android/iOS 시뮬레이터 캡처를 ADB/simctl로 구현했다.
  iOS 실기기 캡처는 기존 Mobile MCP를 사용한다. 현재 시뮬레이터는 크기 옵션을 거부한다.
- MCP/Pydantic 의존성이 `lifespan` 필드 forward-reference 경고를 출력한다.
  실제 수명주기 초기화·도구 호출·정상 종료는 통과했다. 경고를 숨기지는 않았다.

## 미검증 범위

Android 실제 에뮬레이터/기기의 조작, iOS 실기기, 앱의 이미지 전송 및 Mac 수신,
장시간 시나리오, 모든 Mobile MCP 작업을 실제 기기로 검증한 것은 아니다.
현재 성공 근거는 도구 연결·iOS 앱 실행/탭/홈/재진입·관찰·기록·보고서와 경계 테스트다.
즉시 렌더링 갱신, 한글 입력, 모든 어댑터 작업의 실제 동작은 검증 범위에 포함되지 않는다.
