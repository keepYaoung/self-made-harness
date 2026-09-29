// Figma 쪽 코드(figma-export.figma.js)와 Node 쪽 지문(lib/digest.mjs)이 같은 값을 내는지 — mock figma 로 실제 코드를 돌린다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HARNESS } from './helpers.mjs';
import { figmaDigest, digestCode, isDigestCode, FIGMA_SCRIPT } from '../scripts/lib/digest.mjs';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const mixed = Symbol('mixed');
const solid = (hex) => ({ type: 'SOLID', visible: true, color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 } });
const tree = {
  id: '1:1', name: 'menubar.panel', type: 'FRAME', height: 480, fills: [solid('#FFFFFF')], layoutMode: 'VERTICAL', itemSpacing: 12, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, cornerRadius: 20,
  children: [
    { id: '1:2', name: 'title', type: 'TEXT', height: 22.4, fills: [solid('#333333')], fontSize: 16, characters: '복사한 클립이 여기 모여요' },
    { id: '1:3', name: 'connect.cta', type: 'FRAME', height: 52, fills: [solid('#61BF72'), { type: 'IMAGE', visible: true }], layoutMode: 'NONE', cornerRadius: mixed, topLeftRadius: 12, topRightRadius: 12, bottomRightRadius: 0, bottomLeftRadius: 0, children: [] },
    { id: '1:4', name: 'hidden', type: 'TEXT', visible: false, height: 10, fills: [], fontSize: 12, characters: 'x' },
  ],
};
const byId = new Map(); const index = (n) => { byId.set(n.id, n); (n.children ?? []).forEach(index); }; index(tree);
const figma = { mixed, fileKey: 'FILEKEY', getNodeByIdAsync: async (id) => byId.get(id) ?? null };
const run = (code) => new AsyncFunction('figma', code)(figma);

test('digest parity: Figma export → figma.json 의 지문 = Figma digest 모드 지문', async () => {
  const exp = await run(fs.readFileSync(FIGMA_SCRIPT, 'utf8').replace('const FRAME_IDS = ["__FRAME_ID__"];', 'const FRAME_IDS = ["1:1"];'));
  assert.equal(exp.pages, 1);
  assert.equal(exp.nodes.length, 3, '숨긴 노드 제외');
  assert.deepEqual(exp.nodes.find((n) => n.id === '1:3').radius, [12]);
  assert.deepEqual(exp.nodes.find((n) => n.id === '1:3').fills, ['#61BF72'], '이미지 fill 제외');
  const live = await run(digestCode(['1:1']));
  assert.equal(figmaDigest({ file_key: exp.file_key, frame_ids: exp.frame_ids, nodes: exp.nodes }), live.digest);
  // 한 노드라도 바뀌면 지문이 달라진다
  byId.get('1:2').characters = '바뀜';
  const changed = await run(digestCode(['1:1']));
  assert.notEqual(changed.digest, live.digest);
});
test('isDigestCode: 출력 코드는 통과, 한 글자라도 바꾸면 거부', () => {
  assert.equal(isDigestCode(digestCode(['1:1', '2:3'])), true);
  assert.equal(isDigestCode(digestCode(['1:1']).replace('return {', 'figma.currentPage.remove(); return {')), false);
  assert.equal(isDigestCode(digestCode(['1:1']).replace('const MODE = "digest";', 'const MODE = "export";')), false);
  assert.equal(isDigestCode('figma.root.children[0].remove()'), false);
});
test('guard-judge: judge 의 use_figma 는 digest 코드만', () => {
  const g = (code) => spawnSync('node', [path.join(HARNESS, 'scripts/guard-judge.mjs')], { input: JSON.stringify({ tool_name: 'mcp__figma__use_figma', agent_type: 'judge', tool_input: { code } }) }).status;
  assert.equal(g(digestCode(['1:1'])), 0);
  assert.equal(g('figma.createFrame()'), 2);
});
