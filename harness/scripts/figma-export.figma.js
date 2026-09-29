// Figma 노드 지문 — use_figma(Plugin API) 로 실행하는 코드 본문. 반드시 figma-use 스킬을 먼저 불러온다.
//
// 이 파일 전체를 그대로 실행하되 MODE · FRAME_IDS · PAGE 세 줄만 바꾼다. 주석도 지우지 않는다 —
// judge 의 use_figma 는 `verify.mjs <slug> --figma-code` 가 출력한 코드와 한 글자라도 다르면 hook 이 막는다.
//
// MODE
//   "export" — maker(또는 Multica)용. 노드 정보를 PAGE 번째 조각으로 돌려준다 → 조각을 이어 붙여 p3-make/figma.json
//   "digest" — judge 전용. 같은 순회 결과를 지문 한 줄("<해시>-<노드 수>")로만 돌려준다 (노드를 읽기만 한다)
// 노드 형식은 harness/rules.yaml formats.figma_json 과 같다. 지문 계산은 harness/scripts/lib/digest.mjs 와 글자까지 같다.

const MODE = "export";
const FRAME_IDS = ["__FRAME_ID__"]; // 예: ["123:456", "123:789"]
const PAGE = 0; // 0 … pages - 1 (use_figma 응답은 20KB 에서 잘린다)
const PAGE_NODES = 80;

const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const fillsOf = (n) => (!("fills" in n) || n.fills === figma.mixed ? [] : n.fills.filter((p) => p.visible !== false && p.type === "SOLID").map((p) => hex(p.color)));
const spacingOf = (n) => (!("layoutMode" in n) || n.layoutMode === "NONE" ? [] : [n.itemSpacing, n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].filter((v) => typeof v === "number" && v > 0));
const radiusOf = (n) => {
  if (!("cornerRadius" in n)) return [];
  if (n.cornerRadius !== figma.mixed) return n.cornerRadius > 0 ? [n.cornerRadius] : [];
  return [n.topLeftRadius, n.topRightRadius, n.bottomRightRadius, n.bottomLeftRadius].filter((v) => v > 0);
};
const nodeOf = (n) => ({
  id: n.id,
  name: n.name,
  type: n.type,
  fills: fillsOf(n),
  spacing: [...new Set(spacingOf(n))],
  radius: [...new Set(radiusOf(n))],
  fontSize: n.type === "TEXT" && typeof n.fontSize === "number" ? n.fontSize : null,
  text: n.type === "TEXT" ? n.characters : null,
  height: Math.round(n.height),
});

const nodes = [];
for (const id of FRAME_IDS) {
  const frame = await figma.getNodeByIdAsync(id);
  if (!frame) throw new Error(`노드를 찾을 수 없음: ${id}`);
  const walk = (n) => {
    if (n.visible === false) return;
    nodes.push(nodeOf(n));
    if ("children" in n) for (const c of n.children) walk(c);
  };
  walk(frame);
}
nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// cyrb53 — harness/scripts/lib/digest.mjs 의 같은 함수와 글자까지 같아야 한다 (Figma 안에는 crypto 가 없음)
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
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

if (MODE === "digest") {
  return { file_key: figma.fileKey, digest: `${cyrb53(figma.fileKey + "\n" + JSON.stringify(nodes))}-${nodes.length}` };
}
const pages = Math.max(1, Math.ceil(nodes.length / PAGE_NODES));
return { file_key: figma.fileKey, frame_ids: FRAME_IDS, page: PAGE, pages, nodes: nodes.slice(PAGE * PAGE_NODES, (PAGE + 1) * PAGE_NODES) };
