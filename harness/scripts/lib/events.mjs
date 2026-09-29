// 이벤트 시트 공용 — 시트 파싱 · 프로퍼티 파싱 · 앱 코드 스캔
import fs from 'node:fs';
import path from 'node:path';
import { csv } from './md.mjs';

export function eventRowsFrom(text) {
  return csv(text).map((r, i) => ({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).trim()])), row: i + 2 }));
}

// "key, key(a|b|…), key(mac)" → [{ key, enum: [..] | null, cond: string | null }]
export function parseProps(cell) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(cell ?? '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^([^(]+?)\s*(?:\((.*)\))?$/.exec(x);
    const inner = m?.[2] ?? null;
    const isEnum = inner != null && inner.includes('|');
    return { key: (m?.[1] ?? x).trim(), enum: isEnum ? inner.split('|').map((v) => v.trim()) : null, cond: !isEnum ? inner : null };
  });
}
export const propsKey = (cell) => parseProps(cell).map((p) => `${p.key}(${(p.enum ?? []).join('|')})`).sort().join(',');

const cache = new Map();
// codeCfg = rules.events.code
export function scanCode(appRepo, codeCfg) {
  const key = appRepo + JSON.stringify(codeCfg);
  if (cache.has(key)) return cache.get(key);
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) { if (!codeCfg.exclude_dirs.includes(f.name)) walk(path.join(d, f.name)); }
      else if (codeCfg.extensions.includes(path.extname(f.name))) files.push(path.join(d, f.name));
    }
  };
  for (const r of codeCfg.roots) walk(path.join(appRepo, r));
  const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const calls = new Set();
  for (const p of codeCfg.call_patterns) for (const m of text.matchAll(new RegExp(p, 'g'))) if (!codeCfg.ignore_names.includes(m[1])) calls.add(m[1]);
  const out = { text, calls, files: files.length };
  cache.set(key, out);
  return out;
}

// 시트 ↔ 코드 드리프트
export function drift(rows, code) {
  const names = new Set(rows.map((r) => r.event_name));
  return {
    yesNotInCode: rows.filter((r) => r.implemented === 'yes' && !code.text.includes(`"${r.event_name}"`)).map((r) => r.event_name),
    codeNotInSheet: [...code.calls].filter((n) => !names.has(n)).sort(),
    noButInCode: rows.filter((r) => r.implemented === 'no' && code.calls.has(r.event_name)).map((r) => r.event_name),
  };
}
