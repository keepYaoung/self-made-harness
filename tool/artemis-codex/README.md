# artemis-codex

`tool/artemis-codex`에 둔 Codex용 MCP 통합입니다.
Artemis Pro의 계획·체크포인트·기록 방식을 적용하고 Android/실기기는 Mobile MCP, iOS 시뮬레이터는 AXe·simctl에 연결합니다.
**별도 LLM API 연결 없이 현재 Codex가 판단합니다.** Codex의 사용량은 발생합니다.

기본 스크린샷은 Android ADB와 iOS 시뮬레이터 simctl로 직접 캡처합니다.
Mobile MCP의 WDA 스크린샷 시간 초과를 피하며 모델 API는 사용하지 않습니다.

```text
Codex: 계획, UI 해석, 검증
  → artemis-codex: 기기 고정, 작업 기록, 근거 검사, 보고서
    → AXe(XcodeBuildMCP 번들) + simctl: iOS 시뮬레이터
    → Mobile MCP: Android 및 iOS 실기기
```

## 설치

전체 도구는 저장소 루트에서 `bash tool/setup.sh`로 설치합니다.
원본 Artemis 없이 이 통합만 설치할 수도 있습니다.

```bash
npm ci --prefix tool
UV_CACHE_DIR="$PWD/tool/.cache/uv" uv sync --project tool/artemis-codex --frozen
tool/artemis-codex/.venv/bin/python tool/install-codex.py
bash tool/run.sh artemis-codex
```

필수: Python 3.12+, Node 22.12+, uv, Android는 ADB/에뮬레이터,
iOS는 Xcode/부팅된 시뮬레이터. 시뮬레이터 앱 실행 시 Simulator 창도 엽니다.
마지막 명령은 stdio 서버를 실행하므로 일반 대화형 CLI처럼 출력하지 않습니다.
Codex 프로젝트를 다시 열거나 MCP를 다시 로드하면 `ac_*` 도구가 표시됩니다.
원본 `artemis`는 설치를 유지하되 새 MCP 설정에서는 기본 비활성화합니다.

## 도구

| 도구 | 역할 |
| --- | --- |
| `ac_guide` | 실행 안내 |
| `ac_catalog` | 대상별 허용 작업과 인자 스키마 (`run_id` 지정) |
| `ac_devices` | 로컬 기기 조회 |
| `ac_start` | 기기와 체크포인트를 지정해 작업 생성 |
| `ac_device` | 기기 조작·관찰 및 이벤트/이미지 저장 |
| `ac_checkpoint` | Codex의 검증 결과와 관찰 근거 기록 |
| `ac_status` | 작업 목록·진행 상태·재개 정보 |
| `ac_finish` | 최종 상태와 Markdown 보고서 저장 |

실제 호출 순서와 예시는 [GUIDE.md](GUIDE.md)에 있습니다.
검증 결과와 남은 범위는 [VALIDATION.md](VALIDATION.md)에 있습니다.
설치만으로 장시간 자율 테스트가 시작되지는 않습니다. Codex에 시나리오를 지시해야 합니다.

## 원본과 차이

실제로 가져온 코드 및 변경 내역은 [NOTICE.md](NOTICE.md)에 적었습니다.
원본 전체를 복제한 Pro 실행기가 아닙니다. 원본의 원자적 파일 저장 로직을 변형하고,
계획·검증 절차는 이식했습니다. 모델·Gemini ER·클라우드 OCR·자동 영상 분석은 사용하지 않습니다.
별도 LLM/Google/OpenAI/Anthropic 클라이언트를 의존성에 넣지 않았습니다.

MCP는 로컬 stdio이고 클라우드 기기 할당은 노출하지 않습니다.
기기 앱에서 발생하는 통신, Mobile MCP의 설치 다운로드·텔레메트리까지 차단하는
완전 오프라인 도구라는 뜻은 아닙니다.
통과 판정은 Codex가 합니다. 서버는 근거가 해당 작업의 최근 성공한 관찰인지 확인합니다.

## 검증

```bash
tool/artemis-codex/.venv/bin/python -m unittest discover -s tool/artemis-codex -p 'test_*.py' -v
tool/artemis-codex/.venv/bin/python tool/smoke.py --devices
```

두 번째 명령은 원본 Artemis를 포함한 전체 설치가 필요합니다.
첫 번째 검사는 가짜 기기로 실패 처리·근거 연결·장치 고정을 검사합니다.
실기기와 앱의 실제 전송 기능 검증은 별도로 수행해야 합니다.
