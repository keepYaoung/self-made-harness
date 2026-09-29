// 이벤트 시트 게이트 — 통과 1 · 실패 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpRoot, write, verify, approve, goodEvents, eventTools, csvOf, CHANGES_HEAD, EV } from './helpers.mjs';

const fails = (r, id) => assert.equal(r.gate(id)?.pass, false, `${id} 가 실패해야 한다\n${r.out}`);
const setCsv = (root, text) => { write(root, EV, 'p3-make/amplitude_events.csv', text); approve(root, EV); };
const addRow = (root, row) => setCsv(root, csvOf(root) + row + '\n');

test('기준선: events P2 · P4 전부 통과, apply 가 코드에 있는 추가 이벤트를 yes 로', () => {
  const root = tmpRoot(); goodEvents(root);
  assert.equal(verify(root, EV, 'P2').code, 0);
  const r = verify(root, EV, 'P4');
  assert.equal(r.code, 0, r.out);
  for (const id of ['E1', 'E3', 'E4', 'A5', 'B6', 'E7', 'E8', 'E9']) assert.equal(r.gate(id).pass, true, id);
  assert.match(csvOf(root), /paste_stack_completed,clipboard,붙여넣기 스택 완료,"item_count, source\(menu\|hotkey\|…\)",mac,yes,스택 기능 사용 빈도,1\.1\.2/);
});
test('event-tools drift: 코드에만 있는 이벤트를 보여 준다', () => {
  const root = tmpRoot(); goodEvents(root);
  const r = eventTools(root, 'drift');
  assert.equal(r.status, 0); assert.match(r.stdout, /코드가 보내는데 시트에 없음 \(1\)\n- `paste_stack_completed`/);
});
test('event-tools apply: 모르는 구분 · 이미 있는 이름 추가는 거부', () => {
  const root = tmpRoot(); goodEvents(root);
  write(root, EV, 'p2-design/changes.md', CHANGES_HEAD + '| 추가 | app_started | lifecycle | x | | both | y | K-01 |\n| 바꿈 | a_b | c | d | | both | e | K-01 |\n');
  const r = eventTools(root, 'apply');
  assert.equal(r.status, 1); assert.match(r.stderr, /이미 시트에 있다/); assert.match(r.stderr, /구분 '바꿈' 모름/);
});
test('E1 실패: 이름 형식 · 중복 · 소거된 이름 부활 · 헤더', () => {
  const root = tmpRoot(); goodEvents(root);
  addRow(root, 'PasteDone,clipboard,x,,mac,no,y,1.1.2');
  addRow(root, 'app_started,lifecycle,x,,both,yes,y,1.1.2');
  addRow(root, 'pin_generated,pin_auth,x,,mac,no,다시,1.1.2');
  const r = verify(root, EV, 'P4');
  fails(r, 'E1'); const v = r.gate('E1').violations.join('\n');
  assert.match(v, /이름 형식 'PasteDone'/); assert.match(v, /'app_started' 중복/); assert.match(v, /'pin_generated' 은 소거된 이름/);
  setCsv(root, csvOf(root).replace('purpose,since', 'purpose'));
  assert.match(verify(root, EV, 'P4').gate('E1').violations.join(), /헤더/);
});
test('E2 실패: 키 스펙 K-02 에 대응 행 없음 · 측정 안 함 사유 없음', () => {
  const root = tmpRoot(); goodEvents(root);
  write(root, EV, 'p1-collect/scope.md', '| ID | 키 스펙 | 근거 |\n|---|---|---|\n| K-01 | a | b |\n| K-02 | 다크 모드 | c |\n| K-03 | 로고 | d |\n');
  write(root, EV, 'p2-design/changes.md', CHANGES_HEAD + '| 추가 | paste_stack_completed | clipboard | x | | mac | y | K-01 |\n| 측정 안 함 | - | - | - | - | - | | K-03 |\n');
  const r = verify(root, EV, 'P2');
  fails(r, 'E2'); assert.equal(r.gate('E2').violations.length, 2); assert.equal(r.report.return_to, 'P1');
});
test('E3 실패: 추가 이벤트에 purpose 없음', () => {
  const root = tmpRoot(); goodEvents(root);
  addRow(root, 'image_saved,clipboard,이미지 저장,content_type,android,no,,1.1.2');
  fails(verify(root, EV, 'P4'), 'E3');
});
test('E4 실패: 개인정보 프로퍼티(email · device_name)', () => {
  const root = tmpRoot(); goodEvents(root);
  addRow(root, 'share_opened,clipboard,공유,"email, device_name",android,no,공유 경로,1.1.2');
  const r = verify(root, EV, 'P4'); fails(r, 'E4'); assert.equal(r.gate('E4').violations.length, 2);
});
test('★A5 실패: 클립 원문 프로퍼티(clip_text) — content_length 는 통과', () => {
  const root = tmpRoot(); goodEvents(root);
  assert.equal(verify(root, EV, 'P4').gate('A5').pass, true);
  addRow(root, 'clip_pinned,clipboard,핀,"clip_text, content_length",both,no,핀 사용,1.1.2');
  const r = verify(root, EV, 'P4'); fails(r, 'A5'); assert.equal(r.gate('A5').violations.length, 1);
});
test('★B6 실패: 동기화 이벤트 enum 에 premium · fakedoor 에 large_file_sync 추가', () => {
  const root = tmpRoot(); goodEvents(root);
  setCsv(root, csvOf(root)
    .replace('source(history_cap_card|device_limit)', 'source(history_cap_card|device_limit|large_file_sync)')
    .replace('"content_length, content_type",both', '"content_length, content_type, plan(free|premium)",both'));
  const r = verify(root, EV, 'P4'); fails(r, 'B6');
  const v = r.gate('B6').violations.join('\n');
  assert.match(v, /large_file_sync/); assert.match(v, /premium/); assert.equal(r.report.return_to, 'P2');
});
test('E7 실패: 퍼널 절 없음 · 미정 enum 이벤트가 질문 절에 없음', () => {
  const root = tmpRoot(); goodEvents(root);
  write(root, EV, 'p3-make/events-1.1.2.md', '## 목적\n- a\n\n## 질문\n- 없음\n\n## 커버리지\n- b\n');
  approve(root, EV);
  const r = verify(root, EV, 'P4'); fails(r, 'E7'); assert.equal(r.gate('E7').violations.length, 2);
});
test('E8 실패: yes 인데 코드에 없음 · 코드가 보내는데 시트에 없음 · no 인데 코드가 보냄', () => {
  const root = tmpRoot(); goodEvents(root);
  write(root, EV, 'p3-make/../../../app/mac/Sources/C.swift', 'track("history_searched")\n');
  setCsv(root, csvOf(root).replace('paste_stack_completed,clipboard,붙여넣기 스택 완료,"item_count, source(menu|hotkey|…)",mac,yes', 'paste_stack_completed,clipboard,붙여넣기 스택 완료,"item_count, source(menu|hotkey|…)",mac,no') + 'ghost_event,ui,유령,,mac,yes,확인,1.1.2\n');
  const r = verify(root, EV, 'P4'); fails(r, 'E8');
  const v = r.gate('E8').violations.join('\n');
  assert.match(v, /'ghost_event' implemented=yes 인데 코드에 없음/); assert.match(v, /'history_searched' 가 시트에 없음/); assert.match(v, /'paste_stack_completed' implemented=no 인데 코드가 보냄/);
});
test('E9 보고만: 30일 0건이어도 통과, 경고로 남김', () => {
  const root = tmpRoot(); goodEvents(root);
  write(root, EV, 'p4-check/amplitude-live.json', JSON.stringify({ range_days: 30, events: { app_started: 3 } }));
  const r = verify(root, EV, 'P4');
  assert.equal(r.code, 0, r.out); assert.equal(r.gate('E9').pass, true);
  assert.equal(r.gate('E9').warnings.length, 3); assert.match(r.out, /\(보고만\)/);
});
