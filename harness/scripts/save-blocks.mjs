#!/usr/bin/env node
// 에이전트 출력의 <<<FILE 경로 … >>> 블록을 저장한다 — Claude · Codex · Multica 누가 돌려도 같은 규칙.
//   node harness/scripts/save-blocks.mjs <slug> <P1|P2|P3|P5|JUDGE|REVIEW> [--runs-dir=DIR] < agent-output.txt
// 규칙: 경로는 runs/<slug>/<그 역할 폴더>/ 안이어야 하고, 보호 파일은 거부한다. 하나라도 어긋나면 아무것도 쓰지 않는다.
// exit 0 저장 · 1 거부 · 2 오류
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FOLDER = { P1: ['p1-collect/'], P2: ['p2-design/'], P3: ['p3-make/'], P5: ['p5-derive/'], JUDGE: ['p4-check/figma-live.json', 'p4-check/amplitude-live.json'], REVIEW: ['review/'] };
const PROTECTED = /(^|\/)(approval\.md|unblock\.md|state\.json|p4-check\/report\.json)$/;

const argv = process.argv.slice(2);
const [slug, role] = argv.filter((a) => !a.startsWith('--'));
const runsDir = path.resolve(argv.find((a) => a.startsWith('--runs-dir='))?.slice(11) ?? path.join(ROOT, 'runs'));
if (!slug || !FOLDER[role]) {
  console.error('사용: save-blocks.mjs <slug> <P1|P2|P3|P5|JUDGE|REVIEW> < 출력');
  process.exit(2);
}

const input = fs.readFileSync(0, 'utf8');
const blocks = [...input.matchAll(/^<<<FILE[ \t]+(\S+)[ \t]*\n([\s\S]*?)\n>>>[ \t]*$/gm)].map((m) => ({ rel: m[1], body: m[2] + '\n' }));
if (!blocks.length) {
  console.error('[save-blocks] <<<FILE 블록이 없다');
  process.exit(1);
}

const prefix = `runs/${slug}/`;
const bad = [];
for (const b of blocks) {
  const norm = path.posix.normalize(b.rel);
  if (!norm.startsWith(prefix) || norm.includes('..')) { bad.push(`${b.rel}: runs/${slug}/ 밖`); continue; }
  const inner = norm.slice(prefix.length);
  if (PROTECTED.test(inner)) { bad.push(`${b.rel}: 보호 파일`); continue; }
  if (!FOLDER[role].some((f) => (f.endsWith('/') ? inner.startsWith(f) : inner === f))) bad.push(`${b.rel}: ${role} 는 ${FOLDER[role].join(', ')} 만 쓸 수 있다`);
  b.abs = path.join(runsDir, slug, inner);
}
if (bad.length) {
  console.error('[save-blocks] 거부 — 아무것도 쓰지 않았다');
  for (const x of bad) console.error(`  - ${x}`);
  process.exit(1);
}
for (const b of blocks) {
  fs.mkdirSync(path.dirname(b.abs), { recursive: true });
  fs.writeFileSync(b.abs, b.body);
  console.log(`[save-blocks] ${path.relative(ROOT, b.abs)} (${Buffer.byteLength(b.body)}B)`);
}
