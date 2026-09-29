# design.md — Clipdoggy

> 값의 출처: ClipDoggy `android/app/src/main/res/values/{colors,dimens}.xml`, 레이아웃 XML, `mac/Sources`.
> `(확인 필요)` 표시는 코드에서 추론한 값이라 Figma(soonr Design Library)와 대조가 필요함.

## Philosophy
**가볍고, 빠르고, 조용하다.** 클립보드는 하루 수십 번 스치는 도구라 UI는 배경에 머물고, 내용(클립)이 주인공이다. 흰 바탕 + 짙은 회색 텍스트 위에 상태만 색으로 말한다. 브랜드의 온기는 파스텔 클립 블록과 펄스 그라데이션으로만 준다.

## Color tokens

### Surface & text
| Token | Value | 용도 |
|---|---|---|
| `bg.main` | `#FDFDFD` | 화면 배경 (splash·main·pin 공통) |
| `bg.card` | `#FFFFFF` | 카드 배경 |
| `bg.card.selected` | `#F2F2F2` | 선택된 카드 |
| `bg.skeleton` | `#EEEEEE` | 스켈레톤 |
| `stroke.card` | `#EEEEEE` | 카드 기본 테두리 |
| `stroke.card.selected` | `#252525` | 선택 카드 테두리 |
| `text.primary` | `#333333` | 본문·제목 |
| `text.secondary` | `#666666` | 보조 |
| `text.tertiary` | `#999999` | 캡션·빈 상태 아이콘 |
| `icon.gray` | `#BDBDBD` | 비활성 아이콘 |

### Status (클립 라벨)
| Token | Value | 용도 |
|---|---|---|
| `label.received` | `#00A4FF` | 받음 |
| `label.sent` | `#4CCE71` | 보냄 · 성공 |
| `label.copy` | `#555555` | 복사 |
| `label.pinned` | `#FF2D2D` | 핀 |
| `label.failed` | `#FF2D2D` | 전송 실패 |

### Action & signal
| Token | Value | 용도 |
|---|---|---|
| `action.primary` | `#61BF72` | 연결하기 CTA · 좋은 신호 |
| `action.destructive` | `#FE5430` | 삭제 · 약한 신호 |
| `signal.medium` | `#FEB230` | 보통 신호 |
| `cta.shadow` | `#D8D8D8` | LayeredCtaButton 하단 레이어 |

### Toast & notice
| Token | Value |
|---|---|
| `toast.bg` | `#333333` @ 90% |
| `toast.info` / `success` / `error` / `loading` | `#5EC6FF` / `#4CCE71` / `#FF5050` / `#FE9800` |
| `toast.warning` (bg / glyph) | `#FFDDD2` / `#8A3B1C` |
| `notice.info` / `warning` / `critical` | `#2C2C2C` / `#8A3B1C` / `#B02E12` |

### Brand accents
| Token | Value | 용도 |
|---|---|---|
| `clip.pastel.1–6` | `#CDC1FF` `#BFE3D0` `#FFD9B0` `#F7C8D8` `#BFDDF5` `#F2E7A6` | 클립 미리보기 상단 블록 (클립별 순환) |
| `pulse.*` | `#FFC376`↔`#FFB5B5`, `#76FFCD`↔`#FFC376`, `#A5E5FF`↔`#76FFCD` | 배경 펄스 그라데이션 |
| `brand.orange` | `#FE5430` (확인 필요) | Beta 배지 텍스트 · 브랜드 주황 |
| `icon.bg` | `#FFF3E0` | 앱 아이콘 배경 |

### Image mode (dark)
| Token | Value |
|---|---|
| `dark.bg` | `#0C0C0C` |
| `dark.grid` | `#1C1C1E` / `#2C2C2E` |
| `dark.icon.inactive` | `#555555` |

## Typography
- **UI 기본**: Pretendard JP (Variable) — 한·일·영 공통. 6개 언어 대응
- **워드마크·숫자 강조**: Eudoxus Sans Bold — 로고타입 "Clipdoggy"(소문자), 키패드 숫자
- 보조 보유: SUIT Variable (현재 미사용 — 확인 필요)

| Role | Size | Weight | 예 |
|---|---|---|---|
| Keypad / Display | 36sp | Bold | PIN 숫자 |
| Title | 20–22sp | Bold | 화면 제목 |
| Button | 18sp | Bold | Primary CTA |
| Body | 16sp | Regular / Bold | 카드 본문 |
| Label | 14sp | Regular | 라벨·설정 항목 |
| Caption | 12sp | Regular | 시간·메타 |

규칙: 사이즈는 위 6단계만 쓴다 (13/15/17sp 등 파생값은 정리 대상).

## Layout
- **간격 스케일**: 4 · 8 · 12 · 16 · 20 · 24 (dp/pt)
- **라운드**: 6 · 8 · 12 · 16 — 카드 12, 시트 16
- **Stroke**: 2dp 기본
- **아이콘**: 16 · 32 · 48
- 화면 좌우 여백 16–20, 카드 간 12

## Components
- **LayeredCtaButton** — 높이 52dp, 하단 4dp 그림자 레이어(`cta.shadow`)가 드러나는 레이어드 버튼. 색·텍스트·크기만 attrs로 가변. 주요 CTA는 전부 이것
- **Clip card** — 흰 카드 + `stroke.card`. 상단 상태 라벨(받음/보냄/복사/핀/실패), 본문 최대 2줄 말줄임, 선택 시 `stroke.card.selected` + `bg.card.selected`
- **Clip preview** — 파스텔 상단 블록 + 본문 + 복사/핀/삭제 액션
- **Toast** — 어두운 90% 배경, 좌측 상태 글리프(info/success/error/loading/warning)
- **Notice banner** — info/warning/critical 3단, 흰 글씨 대비 확보용 어두운 톤
- **Beta badge** — `#FFEAE6` 배경 · `#FFDCDC` 테두리 · `#FE5430` 텍스트 (다크: `#3A2C29` / `#FF7043`)
- **GNB / Extended GNB** — 상단 네비게이션, 텍스트/이미지 탭 전환
- **Mac menu-bar panel** — 상단 슬라이드 다운(설정에서 하단 선택), 좌 이미지 가로 스트립 / 우 텍스트 세로 리스트

## Behavior
- **화면 전환**: 흐름 양끝(처음·마지막)은 dissolve, 중간 단계는 좌→우 슬라이드
- **피드백**: 모든 전송 결과는 토스트로 1회. 실패는 카드에 `label.failed`로도 남긴다
- **로딩**: loading dots (밝은/어두운 두 버전), 리스트는 스켈레톤
- **빈 상태**: 아이콘(`text.tertiary`) + 다음 행동 1개 제시
- **키보드 (Mac)**: ←→ 이미지 · ↑↓ 텍스트 · Tab 패널 전환 · Enter 복사 · Esc 닫기 · ⌘1–9 즉시
- **리뷰 요청**: 성공 전송 5·30·50·100회에 1회만

## Do / Don't
**Do**
- 색은 상태를 말할 때만 쓴다 — 나머지는 흰색·회색
- 새 CTA는 LayeredCtaButton으로, 새 알림은 Toast 컴포넌트로
- 6개 언어 중 가장 긴 문구(주로 es/hi) 기준으로 폭을 잡는다
- 토큰 이름으로 지정하고 hex를 하드코딩하지 않는다

**Don't**
- 파스텔·펄스 색을 텍스트나 상태 표시에 쓰지 않는다 (장식 전용)
- 브랜드 주황 위에 흰 글씨를 얹지 않는다 — 대비가 부족해서 notice 톤을 따로 뒀다
- 타이포 6단계 밖의 사이즈를 새로 만들지 않는다
- 한 화면에 Primary CTA를 2개 이상 두지 않는다
