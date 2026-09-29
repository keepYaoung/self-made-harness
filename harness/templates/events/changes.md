# {version} 이벤트 변경안 (P2)

- 구분: 추가 · 변경 · 소거 · 측정 안 함 (`rules.yaml` `events.change_kinds`)
- properties: `key, key(a\|b\|…), key(mac)` — 표 안이라 enum 구분자는 `\|`
- 이 표는 `event-tools.mjs apply` 가 시트에 적용한다. CSV 를 손으로 고치지 않는다

| 구분 | event_name | category | 설명 | properties | platform | purpose | 스펙 ID |
|---|---|---|---|---|---|---|---|
| {추가} | {대상_과거형동작} | {category} | {한국어 설명} | {key, key(a\|b\|…)} | {both · all · android · mac} | {측정 목적 한 줄 · 측정 안 함이면 사유} | {K-01} |
