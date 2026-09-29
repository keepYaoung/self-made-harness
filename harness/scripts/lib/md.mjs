// 하네스 스크립트 공용 파서 — markdown 표 · CSV · QA 시트
export const strip = (s) => String(s ?? '').replace(/\*\*|`/g, '').trim();

// markdown 표 → [{ header, rows:[{line, <열>: 값}], line }]
export function tables(md) {
  const out = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;
    // 셀 안의 | 는 \| 로 쓴다 (enum 값 나열)
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replaceAll('\\|', '|'));
    const header = cells(lines[i]);
    const rows = [];
    let j = i + 2;
    for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const c = cells(lines[j]);
      rows.push({ line: j + 1, ...Object.fromEntries(header.map((h, k) => [h, c[k] ?? ''])) });
    }
    out.push({ header, rows, line: i + 1 });
    i = j - 1;
  }
  return out;
}
export const tablesWith = (md, cols) => tables(md).filter((t) => cols.every((c) => t.header.includes(c)));

// RFC4180 최소 CSV → [{열: 값}]
export function csv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  const [head, ...body] = rows;
  return (body ?? []).map((r) => Object.fromEntries((head ?? []).map((h, k) => [h.trim(), r[k] ?? ''])));
}
export const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));

// QA 시트: 항목 행 · 머리 통계 · 범위 표 · 섹션 제목
export const STAT_RE = /(\d+)\s*항목\s*\(\s*P0\s*(\d+)\s*\/\s*P1\s*(\d+)\s*\/\s*P2\s*(\d+)\s*\)/;
export function parseQa(md) {
  const rows = tablesWith(md, ['ID', '항목', '절차', '기대', '우선']).flatMap((t) => t.rows)
    .filter((r) => /^[A-Z]+-\d+[a-z]?$/.test(strip(r.ID)))
    .map((r) => ({ ...r, id: strip(r.ID), section: strip(r.ID).split('-')[0], pri: strip(r['우선']) }));
  const stat = STAT_RE.exec(md);
  const scope = tables(md).find((t) => t.header[0] === '영역');
  const sections = [...md.matchAll(/^# ([A-Z]+)\. (.+)$/gm)].map((m) => ({ code: m[1], title: m[2].trim() }));
  return { md, rows, stat: stat && { total: +stat[1], P0: +stat[2], P1: +stat[3], P2: +stat[4] }, scope, sections };
}
export function countQa(rows) {
  const c = { total: rows.length, P0: 0, P1: 0, P2: 0 };
  for (const r of rows) if (r.pri in c) c[r.pri]++;
  return c;
}
export const statText = (c) => `${c.total}항목 (P0 ${c.P0} / P1 ${c.P1} / P2 ${c.P2})`;
