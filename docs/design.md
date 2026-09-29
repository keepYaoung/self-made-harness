# design.md — Clipdoggy

> 값의 출처: ClipDoggy `android/app/src/main/res/values/{colors,dimens,attrs,themes_font}.xml`, `ui/design/DS.kt`, 레이아웃·drawable XML,
> `mac/Sources/KeyPlayer/Views/{DesignTokens,ClipboardPanelView}.swift`, `docs/release-notes-1.1.1.md`. 기준 브랜치 `fix/android-font-locale` (2026-09-29).
> `(확인 필요)` 는 코드에서 추론한 값이라 Figma(soonr Design Library)와 대조가 필요하다.

## Overview

Clipdoggy 는 Mac 과 Android 사이에서 복사한 것을 옮겨 주는 클립보드 앱이다. 하루에 수십 번 스치는 도구라 인터페이스는 **배경에 머문다.** 오프화이트 캔버스(`{colors.canvas}` — #FDFDFD) 위에 짙은 회색 잉크(`{colors.ink}` — #333333)만으로 구조를 세우고, 색은 **상태를 말할 때만** 쓴다 — 받음은 파랑, 보냄은 초록, 실패는 빨강. 화면의 주인공은 사용자가 복사한 텍스트와 이미지다.

형태 언어는 **각진 종이**다. 클립 카드는 모서리 0 에 2px 테두리를 두른 직사각형이고(`{rounded.none}`), 주요 버튼은 2dp 모서리의 판 위에 4dp 아래 판이 비치는 **겹친 종이 버튼**(`LayeredCtaButton`)이다. 미리보기에서 텍스트 클립은 가장자리가 반원으로 파인 **우표**(`StampCardLayout`)가 된다. 둥근 캡슐은 토스트·배지처럼 떠 있는 알림에만 쓴다.

온기는 두 곳에서만 온다. 거친 마커로 그린 **흑백 손그림**(집게 클립 강아지 마스코트, 발바닥, 화살표)과, 미리보기 카드에 깔리는 **파스텔 6색**(`{colors.clip-pastel-*}`). 둘 다 장식 전용이라 텍스트나 상태 표시에 쓰지 않는다.

Mac 은 같은 원칙을 macOS 문법으로 옮긴다 — 시스템 폰트·시스템 색·라이트/다크, 메뉴바에서 내려오는 20pt 라운드 패널.

**Key Characteristics**

- 오프화이트 캔버스 + 짙은 회색 잉크. 색은 상태(받음·보냄·실패·신호)에만
- 각진 종이: 카드 모서리 0 + 2px 헤어라인, CTA 모서리 2dp + 4dp 아래 판
- 그림자 대신 테두리와 겹친 판으로 층을 만든다 — 실제 그림자는 떠오르는 카드(미리보기 우표·연결 중·설정)뿐
- Pretendard JP 한 가족 (zh·hi 는 시스템 폰트), 로고타입만 Eudoxus Sans Bold
- 흑백 마커 손그림 + 파스텔 6색 = 브랜드 온기의 전부
- 짙은 `{colors.ink-strong}` 하단 GNB 가 화면을 닫는다 (Android)
- 키보드로 끝나는 Mac 패널, 엄지로 끝나는 Android 카드 리스트

## Colors

### Brand & Accent

- **Ink** (`{colors.ink}` — #333333): 본문·제목·아이콘의 기본. Figma 원본 값. 순흑이 아니라 한 단계 풀어 사진·스크린샷 옆에서 튀지 않는다.
- **Ink Strong** (`{colors.ink-strong}` — #252525): 하단 GNB 바, 선택된 카드 테두리, 재검색 버튼. 화면에서 가장 무거운 면.
- **Connect Green** (`{colors.action-primary}` — #61BF72): "연결하기" CTA 와 좋은 신호. 앱에서 유일하게 **행동을 요구하는** 유채색.
- **Brand Orange** (`{colors.brand-orange}` — #FE5430, 확인 필요): Beta 배지 텍스트, 삭제, 약한 신호. 흰 글씨를 얹지 않는다.
- **Indicator Blue** (`{colors.indicator}` — #00BFFF): GNB 현재 탭 점.

### Surface

| Token | Value | 용도 |
|---|---|---|
| `{colors.canvas}` | #FDFDFD | 화면 배경 (splash·main·pin 공통) |
| `{colors.surface}` | #FFFFFF | 카드 채움 |
| `{colors.surface-selected}` | #F2F2F2 | 선택된 카드 채움 |
| `{colors.surface-soft}` | #F1F1F1 | 캡슐 액션(`bg_pill_action`) 채움 |
| `{colors.gnb-tab-track}` | #E9E9E9 | GNB 보조 면 |
| `{colors.hairline}` | #EEEEEE | 카드 기본 테두리 · 스켈레톤 |
| `{colors.cta-shadow}` | #D8D8D8 | LayeredCtaButton 아래 판 |
| `{colors.icon-bg}` | #FFF3E0 | 앱 아이콘 배경 |

### Text

| Token | Value | 용도 |
|---|---|---|
| `{colors.ink}` | #333333 | 제목·본문 |
| `{colors.text-muted}` | #666666 | 보조 문구 |
| `{colors.text-faint}` | #999999 | 캡션·빈 상태 아이콘 |
| `{colors.icon-faint}` | #BDBDBD | 비활성 아이콘 |
| `{colors.toggle-inactive}` | #6D7280 | 꺼진 토글 라벨 |
| `{colors.on-primary}` | #FFFFFF | 짙은 면·초록 CTA 위 글씨 |

### Semantic — 클립 상태

| Token | Value | 라벨 |
|---|---|---|
| `{colors.label-received}` | #00A4FF | 받음 |
| `{colors.label-sent}` | #4CCE71 | 보냄 · 성공 |
| `{colors.label-copy}` | #555555 | 복사 |
| `{colors.label-pinned}` | #FF2D2D | 핀 |
| `{colors.label-failed}` | #FF2D2D | 전송 실패 |
| `{colors.quota-exceeded}` | #E57373 | 일일 한도 초과 안내 |
| `{colors.signal-good / medium / weak}` | #61BF72 / #FEB230 / #FE5430 | 연결 신호 |

### Semantic — 알림

| Token | Value |
|---|---|
| `{colors.toast-bg}` | #333333 @ 90% |
| `{colors.toast-info / success / error / loading}` | #5EC6FF / #4CCE71 / #FF5050 / #FE9800 |
| `{colors.toast-warning}` (bg / glyph) | #FFDDD2 / #8A3B1C |
| `{colors.notice-info / warning / critical}` | #2C2C2C / #8A3B1C / #B02E12 — 흰 글씨 대비를 위해 브랜드 주황보다 어둡다 |
| `{colors.beta-badge}` (bg / stroke / text) | #FFEAE6 / #FFDCDC / #FE5430 — 이미지 모드 #3A2C29 / — / #FF7043 |

### Decorative (장식 전용)

| Token | Value | 용도 |
|---|---|---|
| `{colors.clip-pastel-1…6}` | #CDC1FF · #BFE3D0 · #FFD9B0 · #F7C8D8 · #BFDDF5 · #F2E7A6 | 미리보기 카드 채움. **텍스트 클립은 6번(노랑) 고정**, 이미지·파일은 클립 id 해시로 배정 — 같은 클립은 늘 같은 색 |
| `{colors.pulse-*}` | #FFC376↔#FFB5B5 · #76FFCD↔#FFC376 · #A5E5FF↔#76FFCD | 연결 대기 배경 펄스 (6초 주기), 에러 #FF6B6B↔#FF4757 |

### Image mode (Android 다크 면)

| Token | Value |
|---|---|
| `{colors.image-bg}` | #0C0C0C |
| `{colors.image-grid}` | #1C1C1E / #2C2C2E |
| `{colors.image-icon-inactive}` | #555555 |

### Mac

Mac 은 hex 토큰 대신 **시스템 시맨틱 색**을 쓴다 — `DS.Color.primary=.blue · success=.green · warning=.orange · error=.red`, 표면은 같은 색 10%. 클립 종류 색만 고정값이다.

| Token | Value | 용도 |
|---|---|---|
| `{colors.mac-category-text}` | #FFC208 | 텍스트 (메모지 톤) |
| `{colors.mac-category-image}` | #59C7FA | 이미지 |
| `{colors.mac-category-file}` | #FF7800 | 파일 |
| `{colors.dev-ribbon}` | #D92E38 | DEV 리본 — 스토어 캡처에 노출 금지 (Android 는 elevation 8dp 로 헤더 위에 뜸) |

## Typography

### Font Family

**Pretendard JP** — 한·일·라틴을 한 가족으로 담는 네오 그로테스크. Android 는 가변 폰트(wght 45–930, 기본 400) 한 파일로 모든 굵기를 낸다. 레이아웃·코드는 폰트 파일이 아니라 **테마 속성 `?attr/appFontFamily`** 만 참조한다.

| 로케일 | 폰트 | 이유 |
|---|---|---|
| en · ko · ja · es (기본) | Pretendard JP Variable | 한·일·라틴 글리프 포함 |
| zh (`values-zh`) | 시스템 `sans-serif` | Pretendard JP 에 zh 문구 글자의 28%(507자 중 141자)가 없고, 있는 한자도 일본식 자형 |
| hi (`values-hi`) | 시스템 `sans-serif` | 데바나가리 글리프 없음 |

- **Eudoxus Sans Bold** — 로고 옆 "Clipdoggy"(소문자 d) 와 선택 개수 숫자에만. 라틴 전용이라 본문 금지
- **Mac UI** — 시스템 폰트(SF Pro). `DS.Typography` 가 `.title2 / .headline / .body / .subheadline / .caption / .caption2` 로 매핑, 패널 본문 12–12.5pt, PIN 숫자는 48pt Bold 모노
- **마케팅(스토어·웹)** — 헤드라인 Pretendard Bold–ExtraBold, 영문 서브카피 Eudoxus Sans. zh·hi 이미지는 Noto Sans SC / Noto Sans Devanagari
- **라이선스** — Pretendard JP · Eudoxus Sans 모두 SIL OFL 1.1

### Hierarchy (Android)

실측 빈도 기준. line-height 를 지정하지 않은 행은 폰트 기본 메트릭을 따른다.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.keypad}` | 36sp | 700 | 기본 | 0 | PIN 숫자 키패드 |
| `{typography.title}` | 20sp | 700 | 기본 | 0 | 화면·다이얼로그 제목 |
| `{typography.button}` | 18sp | 700 | 기본 | 0 | Primary CTA 라벨 |
| `{typography.body-strong}` | 16sp | 700 | 기본 | 0 | 카드 본문 강조 (36곳, 최다 강조) |
| `{typography.body}` | 16sp | 400 / 500 | 기본 | 0 | 카드 본문, SecondaryButton |
| `{typography.section}` | 14sp | 600 | 20sp | 0 | 섹션 제목 ("복사 기록") |
| `{typography.label}` | 14sp | 400 | 기본 | 0 | 라벨·설정 항목 |
| `{typography.caption}` | 12sp | 400 / 500 | 기본 / 14sp | 0 | 시간·글자 수·상태 라벨 (64곳, 최다) |

- **정리 대상**: 11 · 13 · 15 · 17 · 22 · 44sp 가 소수 남아 있다(합 38곳). 새로 쓰지 않는다
- **letter-spacing**: 0 이 원칙. 예외는 로고타입 -0.04, 선택 개수 0.1 (activity_main) 두 곳뿐
- **굵기**: `android:textFontWeight` 는 API 28+ 에서만 동작한다(minSdk 23). API 23–27 에서는 400 으로 보이므로, 굵기가 의미를 가지는 곳은 `Typography.apply / load` 를 쓴다

### Principles

- **크기보다 굵기.** 위계는 16sp 안에서 400 ↔ 700 으로 먼저 만들고, 크기는 6단계를 넘지 않는다.
- **상태는 글자로.** 캡션 줄(12sp)에 상태 라벨·글자 수·시간을 한 줄로 늘어놓고, 상태만 색을 입힌다.
- **자간은 건드리지 않는다.** Pretendard 기본 자간을 믿는다.

## Layout

### Spacing System

- **Base unit**: 4dp. 토큰은 Android `DS.Spacing` · Mac `DS.Spacing` 이 같은 값이다
- **Tokens**: `{spacing.xs}` 4 · `{spacing.sm}` 8 · `{spacing.md}` 12 · `{spacing.lg}` 16 · `{spacing.xl}` 20 · `{spacing.xxl}` 24
- 화면 좌우 여백 `{spacing.lg}`–`{spacing.xl}` (16–20dp), 카드 사이 `{spacing.md}` 12dp, 카드 안 여백 `{spacing.md}`–`{spacing.lg}`
- 토스트 안 여백 14 / 16–20dp (상하 / 좌우)

### Grid & Container

- **Android** — 한 열 카드 리스트가 기본. 이미지 탭은 격자(`item_image_grid`), 상단 헤더(로고 32dp) + 섹션 제목 줄 + 리스트 + 하단 GNB(82dp)
- **Mac 패널** — 좌 이미지 가로 스트립(높이 고정, 비율대로 폭 가변) / 우 텍스트 세로 리스트(항목 최대 2줄)
- **Mac 창** — 설정 760×480, 고급 설정 높이 600, 연결 허브 최소 600×400

### Whitespace Philosophy

카드 사이의 12dp 가 리스트의 리듬이다. 구분선 대신 카드 테두리가 경계를 만들고, 빈 공간은 카드 안 여백으로만 준다. 빈 상태 화면은 반대로 거의 비워 두고 아이콘 하나와 다음 행동 하나만 둔다.

### Responsive Strategy

#### Screen Size

| Name | Width × Height | Notes |
|---|---|---|
| Android 기준 | 360–412dp 폭 (확인 필요 — Figma 기준 프레임) | 레이아웃은 dp 단위, 가로 스크롤 없음 |
| Android 최소 | 360dp 폭 | 6개 언어 중 가장 긴 문구(es·hi)로 확인 |
| 태블릿 | — | 아직 범위 밖 (iPad 포트 계획 별도) |
| Mac 패널 | 화면 상단(또는 하단) 슬라이드 | 위치는 설정에서 선택 |

#### Touch Targets

- 터치 타깃 48dp 이상. Primary CTA 52dp, GNB 탭 영역 82dp 높이
- Mac 은 모든 핵심 동작을 키보드로 끝낼 수 있어야 한다

#### Image Behavior

- 카드 썸네일은 4dp 라운드 회색 틀(#D9D9D9)에 담는다. 로딩 중엔 같은 틀의 스켈레톤
- 미리보기에서 이미지는 각진 직사각형(`PLAIN`), 텍스트·파일은 우표(`STAMP`)
- 높이 상한에 걸린 긴 카드는 하단을 페이드로 잘라 "더 있음" 을 알린다

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | `{colors.canvas}` 위 평면 | 화면 대부분 |
| 1 | 2px `{colors.hairline}` 테두리, 모서리 0 | 클립 카드 (`AppCardView`) |
| 1-selected | 2px `{colors.ink-strong}` 테두리 + `{colors.surface-selected}` 채움 | 선택된 카드 |
| 2 | 4dp 아래 판(`{colors.cta-shadow}`) 이 비치는 겹친 판 | LayeredCtaButton, Extended GNB 버튼 |
| 3 | 실제 그림자 elevation 2–12dp | 설정 카드 2dp, 연결 중 카드 12dp |
| 4 | elevation 16dp + 창 뒤 블러 | 미리보기 우표 카드 (바텀시트) |
| Inverse | `{colors.ink-strong}` 채움 | 하단 GNB, 모든 기록 비우기 버튼 |

기본은 **그림자 없는 층**이다. 깊이는 테두리 색의 차이와, 버튼 아래로 4dp 비치는 두 번째 판으로 만든다. 실제 그림자는 화면 위에 떠오르는 것(미리보기·연결 중 카드)에만 쓴다. GNB 는 그림자 없이 짙은 면으로만 구분한다.

### Decorative Depth

- **배경 펄스** — 연결 대기 화면에서 파스텔 그라데이션이 6초 주기로 숨 쉰다. 앱의 유일한 대기 애니메이션
- **우표 가장자리** — 반지름 3dp 반원 구멍이 가장자리를 따라 파여, 텍스트 클립을 "보관된 쪽지" 처럼 보이게 한다

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0 | 클립 카드, 미리보기 이미지 카드, 우표 외곽 |
| `{rounded.xs}` | 2dp | LayeredCtaButton, 연결·재검색·해제 버튼, 복사하기 칩, 모든 기록 비우기 |
| `{rounded.thumb}` | 4dp | 썸네일 틀·스켈레톤 |
| `{rounded.sm}` | 6dp | DS 토큰 (드묾) |
| `{rounded.md}` | 8dp | 로그인 제공자 버튼, 되돌리기 스낵바, PIN 입력 |
| `{rounded.lg}` | 12dp | Beta 배지, 클라우드 연결 배너 |
| `{rounded.xl}` | 16–20dp | PIN 자리 표시 (`pin_digit_*`) |
| `{rounded.pill}` | 22dp–100dp | 캡슐 액션, 기기 아이콘, 토스트, 키패드 숫자(40dp) |
| `{rounded.mac-panel}` | 20pt | Mac 메뉴바 패널 (테두리 `primary @ 28%` 1pt) |

원칙: **정보를 담는 것은 각지게, 떠 있는 것은 둥글게.** 카드·버튼은 0–2dp, 알림·배지는 캡슐.

### Illustration Geometry

- 마스코트·아이콘은 선이 고르지 않은 마커 질감의 흑백. 정사각 캔버스 중앙 배치
- Mac 아이콘은 Lucide(stroke 2, 24 캔버스). 슬롯 폭은 정사각이 아니라 **잉크 폭** 으로 맞춰 글자와 간격을 균일하게 한다

## Components

### Buttons

**`LayeredCtaButton`** — "연결하기", "허용하기", "계속하기"

- 높이 52dp, 모서리 `{rounded.xs}`, 윗판 아래로 `{colors.cta-shadow}` 판이 4dp 드러난다. 누르면 40ms 에 윗판이 내려앉는다
- 라벨 `{typography.button}`. 색·텍스트·크기·굵기만 attrs 로 바꾼다 — 주요 CTA 는 전부 이것

**`clear-history-button`** — "모든 기록 비우기"

- `{colors.ink}` 채움, `{colors.on-primary}` 라벨 + 휴지통 아이콘, 모서리 `{rounded.xs}`

**`copy-chip`** — "복사하기"

- 연초록 채움 #EFF9F1, `{colors.label-sent}` 계열 라벨, 모서리 `{rounded.xs}`. 카드 오른쪽 아래 고정

**`pill-action`** — 보조 캡슐 액션

- `{colors.surface-soft}` 채움, `{rounded.pill}` 22dp, 옅은 테두리 #22000000

**`DarkPillCTA`** (Mac) — 캡슐, 라이트 `white 0.90` / 다크 `white 0.26`, hover 시 한 단계 진하게

### Cards & Containers

**`clip-card`** (`AppCardView`) — 복사 기록 한 줄

- `{colors.surface}` 채움, 2px `{colors.hairline}` 테두리, `{rounded.none}`
- 본문 `{typography.body}` 최대 2줄 → 캡션 줄: 상태 라벨(색) · 글자 수/용량 · 시간 → 오른쪽 `copy-chip`
- 이미지 클립은 왼쪽에 썸네일, 오른쪽에 날짜
- 선택 시 테두리 `{colors.ink-strong}` + 채움 `{colors.surface-selected}`, 20ms 전환

**`stamp-card`** (`StampCardLayout`) — 미리보기 상단 콘텐츠

- 텍스트·파일: 우표 모양(`STAMP`), 채움 `{colors.clip-pastel-6}` 고정
- 이미지: 각진 직사각형(`PLAIN`), 채움은 파스텔 해시 배정
- elevation 16dp, 바텀시트 뒤 창은 블러

**`cloud-cta-banner`** — 로그인 유도 배너: #F5F7FA 채움, 1dp #D8DDE3 테두리, `{rounded.lg}`

**`notice-banner`** — 공지: info / warning / critical 3단 어두운 톤, 흰 글씨

### Feedback

**`toast`** (`ClipToast`) — 모든 전송 결과를 한 번 알린다

- `{colors.toast-bg}` 캡슐(`{rounded.pill}`), 좌측 24dp 상태 글리프(info/success/error/loading/warning), 라벨 14sp
- 앱이 켜져 있을 땐 시스템 알림과 겹치지 않게 토스트만

**`beta-badge`** — `{colors.beta-badge}`, `{rounded.lg}`

**`empty-state-card`** — `{colors.text-faint}` 아이콘 + 제목 16sp Bold + 다음 행동 하나

**`skeleton`** — `{colors.hairline}` 면에 쉬머

### Navigation

**`gnb`** — 하단 탭 바

- `{colors.ink-strong}` 채움, 높이 82dp, 탭 4개(기록 · 핀 · 클라우드 · 설정) 흰 아이콘
- 현재 탭 아래 `{colors.indicator}` 점, 클라우드 탭은 오프라인이면 #E74C3C 점 배지(흰 테두리)
- 그림자 없음 — 리스트와는 면의 명도 차이로만 나뉜다

**`extended-gnb`** — GNB 위로 펼쳐지는 기기 연결 영역: 안내 제목 + 주의 아이콘 + "선택한 기기 연결" 버튼. 버튼은 2dp 모서리 + 4dp 아래 판(`{colors.cta-shadow}`), LayeredCta 와 같은 문법

**`page-header`** — 로고(발바닥 + "Clipdoggy" 32dp) 좌측, DEV 빌드는 우상단 대각선 리본

### Signature Components

**`mac-menubar-panel`** — 메뉴바에서 상단으로 슬라이드 다운(설정에서 하단 선택). 20pt 라운드, 반투명 머티리얼, 좌 이미지 스트립 / 우 텍스트 리스트. ←→ 이미지 · ↑↓ 텍스트 · Tab 전환 · Enter 복사 · Esc 닫기 · ⌘1–9 즉시

**`background-pulse`** — 연결 대기 화면의 파스텔 펄스 (6초 주기, 에러 1.5초 빨강)

**`keypad`** — PIN 숫자 키패드, 숫자 36sp, 키 모서리 40dp 원형

## Motion

| Token | Value | Use |
|---|---|---|
| `{motion.dissolve}` | 20ms | 카드 선택 색 전환 |
| `{motion.press}` | 40ms | LayeredCtaButton 눌림/복귀 |
| `{motion.pulse}` | 6000ms | 배경 펄스 한 주기 |
| `{motion.error-pulse}` | 1500ms | 에러 펄스 |
| `{motion.haptic}` | 870ms × 최대 5회 | 연결 중 햅틱 |

- **화면 전환**: 흐름 양끝(처음·마지막)은 dissolve, 중간 단계는 좌→우 슬라이드
- **로딩**: loading dots (밝은/어두운 두 버전), 리스트는 스켈레톤
- **리뷰 요청**: 성공 전송 5·30·50·100회에 1회만

## Voice & Copy

- **해요체**, 짧게. 한 문장에 한 가지. 기능명보다 사용자가 얻는 것 ("폰에서 복사, 맥북에 붙여넣기")
- 브랜드 표기 **Clipdoggy** (소문자 d). "ClipDoggy" 신규 사용 금지
- 6개 언어(en/ko/ja/zh-CN/es/hi) 동시 작성, 영어가 기본(fallback)
- ko / ja / zh 카피에 em dash(—) 금지 · App Store 카피에 이모지 금지(Play 는 허용) · Play 패치노트 언어당 500자
- 현재 기능만 말한다 — 클라우드 동기화·E2EE 기준. BLE / Wi‑Fi 직접 / PIN 페어링 / "No Cloud" 문구는 1.1.0부터 폐기

## Marketing Imagery (스토어·웹)

- 배경 `{colors.canvas}`, 헤드라인 상단 중앙 `{colors.ink}`, 기기 목업 하단
- 장식은 손그림 화살표·마스코트만. 스톡 사진·타사 UI(AirDrop 등) 금지
- 화면 속 데이터는 연출용 가짜 데이터 — 실제 이메일·기기명·개인정보 금지, 링크는 `clipdoggy.com`
- 상태바 09:41 · 배터리 가득 · 알림 없음 · DEV 리본 노출 금지
- 규격: Google Play 1024×1920, Mac App Store 2880×1800

## Accessibility

- 흰 글씨는 짙은 면(`{colors.ink}`·`{colors.ink-strong}`·notice 톤·초록 CTA) 위에만
- 색만으로 상태를 전달하지 않는다 — 라벨 텍스트("받음/보냄/실패")를 함께
- 터치 타깃 48dp 이상, Mac 은 키보드로 완결

## Do's and Don'ts

### Do

- 색은 상태를 말할 때만 쓴다 — 나머지는 `{colors.canvas}`·`{colors.surface}` 와 잉크 계열
- 정보를 담는 카드·버튼은 각지게(`{rounded.none}`·`{rounded.xs}`), 떠 있는 토스트·배지는 캡슐로
- 층은 테두리와 겹친 판으로 만든다 — 2px `{colors.hairline}`, 4dp `{colors.cta-shadow}`
- 새 CTA 는 `LayeredCtaButton`, 새 알림은 `toast` 로
- 텍스트 클립 미리보기는 노란 우표, 이미지는 각진 판
- 폰트는 `?attr/appFontFamily` 로, 굵기가 중요한 곳은 `Typography.apply / load` 로
- 6개 언어 중 가장 긴 문구(es·hi) 기준으로 폭을 잡는다
- 토큰 이름으로 지정하고 hex 를 하드코딩하지 않는다

### Don't

- 카드에 둥근 모서리나 그림자를 주지 않는다 — 카드는 모서리 0 + 2px 테두리
- 한 화면에 Primary CTA 를 2개 이상 두지 않는다. 초록 `{colors.action-primary}` 를 CTA 말고 장식에 쓰지 않는다
- 파스텔·펄스 색을 텍스트나 상태 표시에 쓰지 않는다 (장식 전용)
- 브랜드 주황·파스텔 위에 흰 글씨를 얹지 않는다
- 타이포 6단계 밖의 사이즈를 새로 만들지 않는다. 자간·대문자 변환을 쓰지 않는다
- 레이아웃·코드에서 폰트 파일(`@font/pretendard_jp_variable` 등)을 직접 참조하지 않는다 — zh·hi 폴백이 깨진다
- Eudoxus Sans 를 본문에 쓰지 않는다 (라틴 전용)
- 일러스트에 그라데이션·3D·사진풍을 섞지 않는다 — 흑백 마커 손그림 + 파스텔 배경만
