// 게이트마다 통과 1 · 실패 1. `node --test harness/tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  tmpRoot, write, verify, approve, png, copyCsv, goodCopyRows, figmaNodes, qaSheet,
  goodUx, goodScreenshots, goodQa, UX, SS, QA,
} from './helpers.mjs';

const fails = (r, id) => assert.equal(r.gate(id)?.pass, false, `${id} 가 실패해야 한다\n${r.out}`);

// ── 전부 통과 기준선 ─────────────────────────────────────
test('기준선: ux P4 전부 통과 → exit 0', () => {
  const root = tmpRoot(); goodUx(root);
  const r = verify(root, UX, 'P4');
  assert.equal(r.code, 0, r.out);
  for (const id of ['ART', 'APPROVAL', 'A1', 'A2', 'B1', 'B2', 'U3', 'U4', 'U5', 'U6', 'U7']) assert.equal(r.gate(id).pass, true, id);
});
test('기준선: ux P2 (U1·U2) 통과', () => {
  const root = tmpRoot(); goodUx(root);
  const r = verify(root, UX, 'P2');
  assert.equal(r.code, 0, r.out);
});
test('기준선: screenshots P4 전부 통과 → exit 0', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const r = verify(root, SS, 'P4');
  assert.equal(r.code, 0, r.out);
  for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']) assert.equal(r.gate(id).pass, true, id);
});
test('기준선: qa P4 · P5 통과 → exit 0', () => {
  const root = tmpRoot(); goodQa(root);
  assert.equal(verify(root, QA, 'P4').code, 0);
  const r = verify(root, QA, 'P5');
  assert.equal(r.code, 0, r.out);
});

// ── 공통 ─────────────────────────────────────────────────
test('ART 실패: P1 scope.md 없음', () => {
  const root = tmpRoot();
  const r = verify(root, QA, 'P1');
  assert.equal(r.code, 1); fails(r, 'ART');
});
test('APPROVAL: 없으면 승인 대기(exit 1), 해시 표시', () => {
  const root = tmpRoot(); goodQa(root);
  fs.rmSync(path.join(root, 'runs', QA, 'approval.md'));
  const r = verify(root, QA, 'HUMAN');
  assert.equal(r.code, 1); assert.equal(r.report.status, 'pending'); assert.match(r.out, /inputs_sha256: [0-9a-f]{64}/);
});
test('APPROVAL 실패: 승인 뒤 P3 산출물이 바뀌면 무효', () => {
  const root = tmpRoot(); goodQa(root);
  assert.equal(verify(root, QA, 'HUMAN').code, 0);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet() + '\n수정\n');
  const r = verify(root, QA, 'HUMAN');
  fails(r, 'APPROVAL'); assert.match(r.out, /승인 무효/);
});
test('★A1 실패: qa 항목에 "서버에 저장"', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ item1: '서버에 저장된 클립 확인' }));
  fails(verify(root, QA, 'P4'), 'A1');
});
test('★A1 통과: 절차·기대 열의 "서버에 저장되지 않는다"는 검사 범위 밖', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet().replace('| 도착 | **P0**', '| 서버에 저장되지 않는다 | **P0**'));
  approve(root, QA);
  assert.equal(verify(root, QA, 'P4').gate('A1').pass, true);
});
test('★A2 실패: ux 연결 흐름에 E2EE 신호 없음', () => {
  const root = tmpRoot(); goodUx(root);
  write(root, UX, 'p2-design/screens.md', '| 화면 | 흐름 | 기능 ID | 텍스트 |\n|---|---|---|---|\n| 메뉴바 패널 | 기타 | F-01 | a |\n| 기기 연결 | 연결 | F-02 | 기기를 연결해요 |\n');
  fails(verify(root, UX, 'P4'), 'A2');
});
test('★A2 실패: 스크린샷 ko 세트에 신뢰 신호 없음', () => {
  const root = tmpRoot(); goodScreenshots(root);
  write(root, SS, 'p2-design/copy.csv', copyCsv(goodCopyRows().map((r) => (r.lang === 'ko' ? { ...r, sub: '' } : r))));
  const r = verify(root, SS, 'P4');
  fails(r, 'A2'); assert.match(r.gate('A2').violations.join(), /aos\/ko/);
});
test('★B1 실패: 연결 흐름에 "Pro 로 업그레이드" (MacBook Pro 는 통과)', () => {
  const root = tmpRoot(); goodUx(root);
  assert.equal(verify(root, UX, 'P4').gate('B1').pass, true); // 기준선 텍스트에 MacBook Pro 포함
  write(root, UX, 'p2-design/screens.md', '| 화면 | 흐름 | 기능 ID | 텍스트 |\n|---|---|---|---|\n| 메뉴바 패널 | 기타 | F-01 | a |\n| 기기 연결 | 연결 | F-02 | E2EE. 2대 이상은 Pro 로 Upgrade |\n');
  fails(verify(root, UX, 'P4'), 'B1');
});
test('★B2 실패: 연결 흐름에 구독 결제 화면', () => {
  const root = tmpRoot(); goodUx(root);
  write(root, UX, 'p2-design/screens.md', '| 화면 | 흐름 | 기능 ID | 텍스트 |\n|---|---|---|---|\n| 메뉴바 패널 | 기타 | F-01 | a |\n| 기기 연결 | 연결 | F-02 | E2EE |\n| 구독 결제 | 연결 | F-02 | 월 3,900원 |\n');
  fails(verify(root, UX, 'P4'), 'B2');
});

// ── UX ───────────────────────────────────────────────────
test('U1 실패: 레퍼런스 4개 + URL 없는 행', () => {
  const root = tmpRoot(); goodUx(root);
  write(root, UX, 'p2-design/references.md', '| # | 앱 | 화면 | 출처 URL | 반영 포인트 |\n|---|---|---|---|---|\n| 1 | a | b | https://x | c |\n| 2 | a | b | https://x | c |\n| 3 | a | b | https://x | c |\n| 4 | a | b | 없음 | c |\n');
  const r = verify(root, UX, 'P2');
  fails(r, 'U1'); assert.equal(r.report.return_to, 'P1');
});
test('U2 실패: scope 의 F-03 이 화면에 없음', () => {
  const root = tmpRoot(); goodUx(root);
  write(root, UX, 'p1-collect/scope.md', '| ID | 기능 | 근거 |\n|---|---|---|\n| F-01 | a | b |\n| F-02 | a | b |\n| F-03 | 핀 | c |\n');
  const r = verify(root, UX, 'P2');
  fails(r, 'U2'); assert.match(r.gate('U2').violations.join(), /F-03/);
});
const withNodes = (root, mut) => {
  const nodes = mut(figmaNodes());
  write(root, UX, 'p3-make/figma.json', JSON.stringify({ nodes }));
  write(root, UX, 'p4-check/figma-live.json', JSON.stringify({ nodes }));
  approve(root, UX);
};
test('U3 실패: 토큰 밖 색 · DEV 리본 색', () => {
  const root = tmpRoot(); goodUx(root);
  withNodes(root, (n) => { n[0].fills = ['#123456']; n[1].fills = ['#D92E38']; return n; });
  const r = verify(root, UX, 'P4');
  fails(r, 'U3'); assert.equal(r.gate('U3').violations.length, 2);
});
test('U4 실패: 간격 10 · 라운드 10 · 글자 22(정리 대상) — 캡슐 40 은 통과', () => {
  const root = tmpRoot(); goodUx(root);
  withNodes(root, (n) => { n[2].spacing = [10]; n[2].radius = [10, 40]; n[1].fontSize = 22; return n; });
  const r = verify(root, UX, 'P4');
  fails(r, 'U4'); assert.equal(r.gate('U4').violations.length, 3);
});
test('U5 실패: CTA 높이 48', () => {
  const root = tmpRoot(); goodUx(root);
  withNodes(root, (n) => { n[2].height = 48; return n; });
  fails(verify(root, UX, 'P4'), 'U5');
});
test('U6 실패: 옛 표기 ClipDoggy', () => {
  const root = tmpRoot(); goodUx(root);
  withNodes(root, (n) => { n[1].text = 'ClipDoggy 에 오신 걸 환영해요'; return n; });
  fails(verify(root, UX, 'P4'), 'U6');
});
test('U7 실패: figma.json 이 실제 Figma 와 다름 · live 없음', () => {
  const root = tmpRoot(); goodUx(root);
  const live = figmaNodes(); live[3].text = '연결하기';
  write(root, UX, 'p4-check/figma-live.json', JSON.stringify({ nodes: live }));
  fails(verify(root, UX, 'P4'), 'U7');
  fs.rmSync(path.join(root, 'runs', UX, 'p4-check/figma-live.json'));
  fails(verify(root, UX, 'P4'), 'U7');
});

// ── 스크린샷 ─────────────────────────────────────────────
test('S1 실패: 크기 1080×1920 · 파일명 규격 밖', () => {
  const root = tmpRoot(); goodScreenshots(root);
  write(root, SS, 'p3-make/out/en-str-scrnsht1.png', png(1080, 1920));
  write(root, SS, 'p3-make/out/english-shot.png', png(8, 8));
  const r = verify(root, SS, 'P4');
  fails(r, 'S1'); assert.equal(r.gate('S1').violations.length, 2);
});
test('S2 실패: ja 없음', () => {
  const root = tmpRoot(); goodScreenshots(root);
  for (let n = 1; n <= 5; n++) fs.rmSync(path.join(root, 'runs', SS, `p3-make/out/ja-str-scrnsht${n}.png`));
  fails(verify(root, SS, 'P4'), 'S2');
});
test('S3 실패: 헤드라인 3줄', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const rows = goodCopyRows(); rows[0] = { ...rows[0], headline: 'Copy on Phone,\\nPaste on Mac.\\nfinally in sync.', headline_lines: '' };
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  fails(verify(root, SS, 'P4'), 'S3');
});
test('S4 실패: 카피에 "Pair with PIN" · 통과: 핀 기능 "Pin your clips"', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const rows = goodCopyRows(); rows[1] = { ...rows[1], headline: 'Pin your clips' };
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  assert.equal(verify(root, SS, 'P4').gate('S4').pass, true);
  rows[2] = { ...rows[2], headline: 'Pair with PIN' };
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  const r = verify(root, SS, 'P4');
  fails(r, 'S4'); assert.equal(r.gate('S4').violations.length, 2);
});
test('S5 실패: ko em dash · mac 이모지', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const rows = goodCopyRows();
  rows[5] = { ...rows[5], headline: '복사 — 붙여넣기' };
  rows.push({ platform: 'mac', slot: 1, lang: 'en', headline: 'Paste 🐾', sub: 'E2EE', headline_lines: 1 });
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  const r = verify(root, SS, 'P4');
  fails(r, 'S5'); assert.equal(r.gate('S5').violations.length, 2);
});
test('S6 실패: 이메일 · 소유자 기기명', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const rows = goodCopyRows(); rows[1] = { ...rows[1], sub: "tomy@gmail.com · Tomy's MacBook" };
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  const r = verify(root, SS, 'P4');
  fails(r, 'S6'); assert.equal(r.gate('S6').violations.length, 2);
});
test('S7 실패: DEV 리본 색 픽셀', () => {
  const root = tmpRoot(); goodScreenshots(root);
  write(root, SS, 'p3-make/raw/cap1.png', png(1024, 1920, [0xfd, 0xfd, 0xfd], { x: 0, y: 0, w: 40, h: 40, rgb: [0xd9, 0x2e, 0x38] }));
  const r = verify(root, SS, 'P4');
  fails(r, 'S7'); assert.match(r.gate('S7').violations.join(), /#D92E38 1600px/);
});
test('S8 실패: 카피에 ClipDoggy', () => {
  const root = tmpRoot(); goodScreenshots(root);
  const rows = goodCopyRows(); rows[0] = { ...rows[0], headline: 'ClipDoggy syncs' };
  write(root, SS, 'p2-design/copy.csv', copyCsv(rows));
  fails(verify(root, SS, 'P4'), 'S8');
});

// ── QA ───────────────────────────────────────────────────
test('Q1 실패: 범위 표에 섹션 열 없음 · 범위 영역에 항목 0', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ scopeHeader: '| 영역 | 코드 | 근거 |' }));
  fails(verify(root, QA, 'P4'), 'Q1');
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet().replace('| 공지 배너 | NB |', '| 공지 배너 | ZZ |'));
  const r = verify(root, QA, 'P4');
  fails(r, 'Q1'); assert.match(r.gate('Q1').violations.join(), /공지 배너/);
});
test('Q2 실패: 기대 비어 있음 · 우선 P3', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ stat: '5항목 (P0 2 / P1 1 / P2 1)', extraRow: '| W-03 | 이미지 | 전송 |  | P3 | |' }));
  const r = verify(root, QA, 'P4');
  fails(r, 'Q2'); assert.equal(r.gate('Q2').violations.length, 2);
});
test('Q3 실패: 머리 통계가 실제 행 수와 다름', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ stat: '5항목 (P0 3 / P1 1 / P2 1)' }));
  fails(verify(root, QA, 'P4'), 'Q3');
});
test('Q4 실패: 직전 버전 시트에 있는 항목 반복', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ item1: '예전 항목' }));
  fails(verify(root, QA, 'P4'), 'Q4');
});
test('Q5 실패: 노션 체크박스 수 · notion_items · CSV 모르는 ID', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p5-derive/qa-1.1.2-notion.md', '- [ ] W-01\n- [ ] W-02\n');
  write(root, QA, 'p5-derive/sync-log.md', 'notion_items: 3\n');
  write(root, QA, 'p5-derive/qa-1.1.2-essential.csv', 'ID,항목\nW-09,x\n');
  const r = verify(root, QA, 'P5');
  fails(r, 'Q5'); assert.equal(r.gate('Q5').violations.length, 3); assert.equal(r.report.return_to, 'P5');
});
