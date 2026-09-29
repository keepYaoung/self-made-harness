// 값의 출처 표 — 가리키는 경로가 rules.yaml 에 실제로 있고, 출처 값은 정해진 것만
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { HARNESS } from './helpers.mjs';

const rules = YAML.parse(fs.readFileSync(path.join(HARNESS, 'rules.yaml'), 'utf8'));
const OK = ['인터뷰', '임의', 'design.md', 'story-service.md', 'store-screenshots.md', 'qa-sheet.md', '앱 시트'];

test('sources: 모든 키가 rules.yaml 에 있는 경로', () => {
  const miss = Object.keys(rules.sources).filter((k) => k.split('.').reduce((o, p) => (o == null ? o : o[p]), rules) === undefined);
  assert.deepEqual(miss, []);
});
test('sources: 출처 값은 정해진 목록 안', () => {
  assert.deepEqual(Object.entries(rules.sources).filter(([, v]) => !OK.includes(v)), []);
});
test('sources: 임의 값이 하나 이상이면 run-harness 첫 실행 절차가 그 목록을 보여 준다', () => {
  const skill = fs.readFileSync(path.join(HARNESS, '../.claude/skills/run-harness/SKILL.md'), 'utf8');
  if (Object.values(rules.sources).includes('임의')) assert.match(skill, /sources.*임의/);
});
