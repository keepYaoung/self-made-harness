// Figma 지문 — figma-export.figma.js 의 digest 모드와 같은 계산. 두 파일을 함께 고친다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIGMA_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../figma-export.figma.js');
export const DIGEST_RE = /^[0-9a-f]{14}-\d+$/;

// cyrb53 — figma-export.figma.js 의 같은 함수와 글자까지 같아야 한다
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// figma.json → 지문. 노드 키 순서·기본값을 Figma 쪽 nodeOf 와 똑같이 맞춘다
export function figmaDigest(figmaJson) {
  const nodes = (figmaJson.nodes ?? []).map((n) => ({
    id: n.id, name: n.name, type: n.type,
    fills: (n.fills ?? []).map((f) => String(f).toUpperCase()),
    spacing: n.spacing ?? [], radius: n.radius ?? [],
    fontSize: n.fontSize ?? null, text: n.text ?? null, height: n.height,
  })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${cyrb53(figmaJson.file_key + '\n' + JSON.stringify(nodes))}-${nodes.length}`;
}

// judge 가 실행할 코드: 원본에서 MODE 를 digest 로, FRAME_IDS 를 실제 값으로만 바꾼다
export function digestCode(frameIds) {
  const src = fs.readFileSync(FIGMA_SCRIPT, 'utf8');
  return src
    .replace(/^const MODE = "export";$/m, 'const MODE = "digest";')
    .replace(/^const FRAME_IDS = .*$/m, `const FRAME_IDS = ${JSON.stringify(frameIds)};`);
}

// guard 용: 받은 코드가 digestCode(아무 FRAME_IDS) 와 FRAME_IDS 줄 빼고 같은가
export function isDigestCode(code) {
  const norm = (s) => String(s).replace(/\r\n/g, '\n').trim();
  const idsRe = /^const FRAME_IDS = .*$/m;
  const idsLine = norm(code).match(idsRe)?.[0] ?? '';
  if (!/^const FRAME_IDS = \[(?:"[A-Za-z0-9:;-]+"(?:,)?)*\];$/.test(idsLine)) return false;
  return norm(code).replace(idsRe, '__IDS__') === norm(digestCode([])).replace(idsRe, '__IDS__');
}
