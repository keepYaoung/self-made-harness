// rules.yaml design_tokens ↔ docs/design.md — design.md 가 바뀌면 여기서 먼저 깨진다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { HARNESS, ROOT } from './helpers.mjs';

const t = YAML.parse(fs.readFileSync(path.join(HARNESS, 'rules.yaml'), 'utf8')).design_tokens;
const md = fs.readFileSync(path.join(ROOT, 'docs/design.md'), 'utf8');

test('design-sync: design.md 의 모든 6자리 색이 rules.yaml colors · forbidden_colors 에 있다', () => {
  const inDoc = new Set([...md.matchAll(/#([0-9A-Fa-f]{6})(?![0-9A-Fa-f])/g)].map((m) => `#${m[1].toUpperCase()}`));
  const inRules = new Set([...t.colors, ...t.forbidden_colors].map((c) => c.toUpperCase()));
  assert.deepEqual([...inDoc].filter((c) => !inRules.has(c)).sort(), [], 'design.md 에만 있는 색 — rules.yaml 에 추가하거나 design.md 를 고친다');
  assert.deepEqual([...inRules].filter((c) => !inDoc.has(c)).sort(), [], 'rules.yaml 에만 있는 색 — design.md 에서 빠졌다');
});
test('design-sync: 타이포 표의 sp 값 = rules.yaml font_size', () => {
  const rows = md.split('\n').filter((l) => /^\| `\{typography\./.test(l));
  const sizes = [...new Set(rows.map((l) => Number(/\|\s*(\d+)sp\s*\|/.exec(l)?.[1])).filter(Boolean))].sort((a, b) => a - b);
  assert.deepEqual(sizes, [...t.font_size].sort((a, b) => a - b));
});
test('design-sync: 간격 토큰 = rules.yaml spacing', () => {
  const line = md.split('\n').find((l) => l.includes('{spacing.xs}'));
  const vals = [...line.matchAll(/`\{spacing\.\w+\}` (\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(vals, t.spacing);
});
