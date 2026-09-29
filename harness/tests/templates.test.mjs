// 양식 ↔ 판정 스크립트가 같은 열 이름을 쓰는지 — 양식을 고치면 여기서 먼저 깨진다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { HARNESS } from './helpers.mjs';
import { tables, parseQa } from '../scripts/lib/md.mjs';

const T = (p) => fs.readFileSync(path.join(HARNESS, 'templates', p), 'utf8');
const rules = YAML.parse(fs.readFileSync(path.join(HARNESS, 'rules.yaml'), 'utf8'));
const header = (p) => tables(T(p))[0]?.header ?? [];
const hasCols = (p, cols) => assert.deepEqual(cols.filter((c) => !header(p).includes(c)), [], `${p} 에 빠진 열`);

test('templates: ux 양식 열 = verify 가 읽는 열', () => {
  hasCols('ux/scope.md', ['ID', '기능', '근거']);
  hasCols('ux/references.md', ['출처 URL']);
  hasCols('ux/screens.md', ['화면', '흐름', '기능 ID', '텍스트']);
  assert.ok(tables(T('ux/spec.md')).some((t) => t.header.includes('카피')), 'spec.md 에 카피 열');
  const f = JSON.parse(T('ux/figma.json'));
  assert.deepEqual(Object.keys(f.nodes[0]), ['id', 'name', 'type', 'fills', 'spacing', 'radius', 'fontSize', 'text', 'height']);
});
test('templates: screenshots copy.csv 헤더', () => {
  assert.equal(T('screenshots/copy.csv').split('\n')[0], 'platform,slot,lang,headline,sub,feature_id,headline_lines');
});
test('templates: qa 시트 — 항목 표 · 범위 섹션 열 · {{STATS}} 자리', () => {
  hasCols('qa/scope.md', ['영역', '섹션', '근거']);
  hasCols('qa/items.md', ['ID', '항목', '절차', '기대', '우선', '결과']);
  const qa = parseQa(T('qa/qa-sheet.md'));
  assert.ok(T('qa/qa-sheet.md').includes('{{STATS}}'));
  assert.ok(qa.scope?.header.includes('섹션'));
});
test('templates: events 양식 = rules.events', () => {
  hasCols('events/scope.md', ['ID', '키 스펙', '근거']);
  assert.deepEqual(header('events/changes.md'), rules.events.changes_columns);
  const d = T('events/delivery.md');
  for (const s of rules.events.delivery_sections) assert.match(d, new RegExp(`^## ${s}$`, 'm'));
  assert.ok('events' in JSON.parse(T('events/amplitude-live.json')));
});
test('templates: 사람 승인·동기화 양식이 verify 규칙과 맞다', () => {
  assert.match(T('common/approval.md'), /^approved: yes$/m);
  assert.match(T('common/approval.md'), /^inputs_sha256: /m);
  assert.match(T('common/sync-log.md'), /^notion_items: /m);
});
test('templates · guides: 수치(hex) 를 복사하지 않는다', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));
  const hits = [...walk(path.join(HARNESS, 'templates')), ...walk(path.join(HARNESS, 'guides'))]
    .flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => `${path.relative(HARNESS, f)} ${m[0]}`));
  assert.deepEqual(hits, []);
});
