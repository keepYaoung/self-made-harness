#!/usr/bin/env node
// 하네스 판정 스크립트 — 통과·실패는 이 종료 코드로만 정해진다.
//   node harness/scripts/verify.mjs <slug> [--stage=P1|P2|P3|HUMAN|P4|P5] [--runs-dir=DIR] [--app-repo=DIR] [--hash]
//   exit 0 통과 · 1 실패/승인 대기 · 2 오류 · 3 차단
// 쓰는 파일: runs/<slug>/state.json · runs/<slug>/p4-check/report.json (이 스크립트만 쓴다)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { strip, tables, tablesWith, csv, parseQa, countQa } from './lib/md.mjs';
import { eventRowsFrom, parseProps, propsKey, scanCode, drift } from './lib/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.resolve(HERE, '..');
const ROOT = path.resolve(HARNESS, '..');
const STAGES = ['P1', 'P2', 'P3', 'HUMAN', 'P4', 'P5'];
const EXIT = { pass: 0, fail: 1, error: 2, blocked: 3 };

// ── 입력 ─────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { slug: null, stage: null, runsDir: path.join(ROOT, 'runs'), appRepo: null, hashOnly: false };
  for (const a of argv) {
    if (a.startsWith('--stage=')) out.stage = a.slice(8);
    else if (a.startsWith('--runs-dir=')) out.runsDir = path.resolve(a.slice(11));
    else if (a.startsWith('--app-repo=')) out.appRepo = path.resolve(a.slice(11));
    else if (a === '--hash') out.hashOnly = true;
    else if (!a.startsWith('--') && !out.slug) out.slug = a;
    else throw new Error(`알 수 없는 인자: ${a}`);
  }
  if (!out.slug) throw new Error('slug 가 필요하다 (예: 1.1.2-qa)');
  if (out.stage && !STAGES.includes(out.stage)) throw new Error(`stage 는 ${STAGES.join('|')}`);
  return out;
}

function parseSlug(slug) {
  const m = /^(\d+\.\d+\.\d+)-(ux|screenshots|qa|events)(?:-([a-z0-9-]+))?$/.exec(slug);
  if (!m) throw new Error(`slug 형식 오류: ${slug} — {version}-{ux|screenshots|qa|events}[-{topic}]`);
  if (m[2] === 'ux' && !m[3]) throw new Error('ux slug 에는 화면 주제가 필요하다 (예: 1.1.2-ux-menubar)');
  return { version: m[1], domain: m[2], topic: m[3] ?? null };
}

const load = (p) => YAML.parse(fs.readFileSync(p, 'utf8'));
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ── 공용 파서 ─────────────────────────────────────────────
function toRegex(src) {
  const ci = src.startsWith('(?i)');
  return new RegExp(ci ? src.slice(4) : src, ci ? 'giu' : 'gu');
}
function matches(list, text) {
  const hits = [];
  for (const src of list) for (const m of text.matchAll(toRegex(src))) hits.push(m[0]);
  return hits;
}

function glob(dir, pattern) {
  // 파일명 부분의 * 만 지원 (a/b/*.png)
  const full = path.join(dir, pattern);
  const d = path.dirname(full), base = path.basename(full);
  if (!base.includes('*')) return fs.existsSync(full) ? [full] : [];
  if (!fs.existsSync(d)) return [];
  const re = new RegExp('^' + base.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return fs.readdirSync(d).filter((f) => re.test(f)).sort().map((f) => path.join(d, f));
}

// ── 실행 컨텍스트 ─────────────────────────────────────────
function context(args) {
  const rules = load(path.join(HARNESS, 'rules.yaml'));
  const defaults = load(path.join(HARNESS, 'defaults.yaml'));
  const { version, domain, topic } = parseSlug(args.slug);
  const run = path.join(args.runsDir, args.slug);
  const appRepo = args.appRepo ?? path.resolve(ROOT, defaults.app_repo);
  const fill = (p) => p.replaceAll('{version}', version).replaceAll('{slug}', args.slug);
  return { rules, version, domain, topic, run, appRepo, slug: args.slug, fill, ocrCache: null };
}

function artifactList(ctx, stage) {
  const a = ctx.rules.artifacts[stage];
  if (!a) return [];
  const list = [].concat(a.all ?? [], a[ctx.domain] ?? []);
  return list.map(ctx.fill);
}

// 승인 해시: p2-design/ · p3-make/ 아래 모든 파일 (상대경로 + 내용 해시)
function inputsHash(ctx) {
  const files = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(path.join(ctx.run, 'p2-design'));
  walk(path.join(ctx.run, 'p3-make'));
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(path.relative(ctx.run, f) + '\0' + sha(fs.readFileSync(f)) + '\n');
  return { hash: h.digest('hex'), files: files.length };
}

// ── 텍스트 수집 ───────────────────────────────────────────
function uxTexts(ctx) {
  const screensMd = read(path.join(ctx.run, 'p2-design/screens.md')) ?? '';
  const specMd = read(path.join(ctx.run, 'p2-design/spec.md')) ?? '';
  const figma = readJson(path.join(ctx.run, 'p3-make/figma.json'));
  const screens = tablesWith(screensMd, ['화면', '흐름', '기능 ID', '텍스트']).flatMap((t) => t.rows);
  const spec = tables(specMd).filter((t) => t.header.includes('카피')).flatMap((t) => t.rows.map((r) => ({ line: r.line, text: r['카피'] })));
  const figmaText = (figma?.nodes ?? []).filter((n) => n.type === 'TEXT').map((n) => ({ id: n.id, text: String(n.text ?? '') }));
  return { screens, spec, figmaText, figma };
}

function readJson(p) {
  const t = read(p);
  if (t == null) return null;
  try { return JSON.parse(t); } catch (e) { throw new Error(`${p} JSON 파싱 실패: ${e.message}`); }
}

function ocr(ctx) {
  if (ctx.ocrCache) return ctx.ocrCache;
  const targets = ctx.rules.gates.screenshots.ocr.targets.flatMap((g) => glob(ctx.run, g));
  if (!targets.length) return (ctx.ocrCache = []);
  const bin = path.join(HARNESS, '.cache/ocr');
  const src = path.join(HERE, 'ocr.swift');
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    execFileSync('swiftc', ['-O', src, '-o', bin], { stdio: 'pipe' });
  }
  // 결과 캐시: 이미지 내용 + 금지 색 목록 + ocr.swift 해시가 같으면 재사용
  const colors = ctx.rules.design_tokens.forbidden_colors.join(',');
  const cacheDir = path.join(HARNESS, '.cache/ocr-results');
  fs.mkdirSync(cacheDir, { recursive: true });
  const salt = sha(fs.readFileSync(src)) + colors;
  const keyOf = (f) => sha(Buffer.concat([fs.readFileSync(f), Buffer.from(salt)]));
  const byFile = new Map();
  const todo = [];
  for (const f of targets) {
    const c = path.join(cacheDir, keyOf(f) + '.json');
    if (fs.existsSync(c)) byFile.set(f, JSON.parse(fs.readFileSync(c, 'utf8')));
    else todo.push(f);
  }
  if (todo.length) {
    const out = execFileSync(bin, [colors, ...todo], { encoding: 'utf8', maxBuffer: 64 << 20 });
    out.trim().split('\n').filter(Boolean).forEach((l, i) => {
      const j = JSON.parse(l);
      fs.writeFileSync(path.join(cacheDir, keyOf(todo[i]) + '.json'), JSON.stringify(j));
      byFile.set(todo[i], j);
    });
  }
  return (ctx.ocrCache = targets.map((f) => {
    const j = { ...byFile.get(f), file: f };
    j.rel = path.relative(ctx.run, f);
    j.text = j.lines.map((x) => x.text).join('\n');
    return j;
  }));
}

function copyRows(ctx) {
  const t = read(path.join(ctx.run, 'p2-design/copy.csv'));
  return t == null ? [] : csv(t).map((r, i) => ({ ...r, row: i + 2, headline: r.headline.replaceAll('\\n', '\n'), sub: (r.sub ?? '').replaceAll('\\n', '\n') }));
}

function qaSheet(ctx) {
  const p = path.join(ctx.run, `p3-make/qa-${ctx.version}.md`);
  const md = read(p);
  if (md == null) return null;
  return parseQa(md);
}

// ── 게이트 ───────────────────────────────────────────────
// 각 게이트: (ctx) => [위반 문자열, …]  (빈 배열 = 통과)
const G = {
  ART(ctx, stage) {
    const miss = [];
    for (const a of artifactList(ctx, stage)) {
      if (a.endsWith('/')) { if (!fs.existsSync(path.join(ctx.run, a))) miss.push(`${a} 없음`); }
      else if (!glob(ctx.run, a).length) miss.push(`${a} 없음`);
    }
    return miss;
  },

  APPROVAL(ctx) {
    const t = read(path.join(ctx.run, 'approval.md'));
    const { hash } = inputsHash(ctx);
    if (t == null) return [`approval.md 없음 — 사람이 'approved: yes' 와 'inputs_sha256: ${hash}' 를 쓴다`];
    const v = [];
    if (!/^approved:\s*yes\s*$/m.test(t)) v.push("'approved: yes' 없음");
    const m = /^inputs_sha256:\s*([0-9a-f]{64})\s*$/m.exec(t);
    if (!m) v.push(`'inputs_sha256: ${hash}' 없음`);
    else if (m[1] !== hash) v.push(`승인 이후 P2·P3 산출물이 바뀜 — 승인 무효 (현재 ${hash})`);
    return v;
  },

  A1(ctx) {
    const d = ctx.rules.dictionaries.a_forbidden;
    return scopedTexts(ctx).flatMap(({ where, text }) => matches(d, text).map((h) => `${where}: "${h}"`));
  },

  A2(ctx) {
    const d = ctx.rules.dictionaries.a_signal;
    const v = [];
    if (ctx.domain === 'ux') {
      const { screens } = uxTexts(ctx);
      for (const flow of ctx.rules.sync_flows) {
        const rs = screens.filter((r) => strip(r['흐름']) === flow);
        if (rs.length && !rs.some((r) => matches(d, r['텍스트']).length)) v.push(`흐름 '${flow}' 에 신뢰 신호(E2EE 등) 없음`);
      }
    } else if (ctx.domain === 'screenshots') {
      const sets = new Map();
      for (const r of copyRows(ctx)) {
        const k = `${r.platform}/${r.lang}`;
        sets.set(k, (sets.get(k) ?? false) || matches(d, `${r.headline}\n${r.sub}`).length > 0);
      }
      for (const [k, ok] of sets) if (!ok) v.push(`세트 ${k} 카피에 신뢰 신호(E2EE 등) 없음`);
    }
    return v;
  },

  B1(ctx) {
    const d = ctx.rules.dictionaries.b_paywall;
    let texts = [];
    if (ctx.domain === 'ux') {
      texts = uxTexts(ctx).screens.filter((r) => ctx.rules.sync_flows.includes(strip(r['흐름'])))
        .map((r) => ({ where: `screens.md:${r.line}`, text: `${r['화면']} ${r['텍스트']}` }));
    } else if (ctx.domain === 'screenshots') {
      texts = copyRows(ctx).map((r) => ({ where: `copy.csv:${r.row}`, text: `${r.headline}\n${r.sub}` }));
    }
    return texts.flatMap(({ where, text }) => matches(d, text).map((h) => `${where}: "${h}"`));
  },

  B2(ctx) {
    if (ctx.domain !== 'ux') return [];
    const re = ctx.rules.paywall_screen;
    return uxTexts(ctx).screens.filter((r) => ctx.rules.sync_flows.includes(strip(r['흐름'])))
      .filter((r) => matches([re], r['화면']).length)
      .map((r) => `screens.md:${r.line} 연결 흐름에 결제·구독 화면 '${r['화면']}'`);
  },

  U1(ctx) {
    const md = read(path.join(ctx.run, 'p2-design/references.md')) ?? '';
    const rows = tablesWith(md, ['출처 URL']).flatMap((t) => t.rows);
    const v = [];
    if (rows.length < 5) v.push(`레퍼런스 ${rows.length}개 (< 5)`);
    for (const r of rows) if (!/https?:\/\/\S+/.test(r['출처 URL'])) v.push(`references.md:${r.line} 출처 URL 없음`);
    return v;
  },

  U2(ctx) {
    const scope = read(path.join(ctx.run, 'p1-collect/scope.md')) ?? '';
    const ids = new Set(tablesWith(scope, ['ID']).flatMap((t) => t.rows).map((r) => strip(r.ID)).filter((x) => /^F-\d+$/.test(x)));
    const mapped = new Set(uxTexts(ctx).screens.flatMap((r) => r['기능 ID'].split(/[,\s]+/).map(strip)));
    const v = [...ids].filter((id) => !mapped.has(id)).map((id) => `${id} 가 어느 화면에도 매핑되지 않음`);
    if (!ids.size) v.push('scope.md 에 기능 ID(F-01 …) 없음');
    return v;
  },

  U3(ctx) {
    const { colors, forbidden_colors } = ctx.rules.design_tokens;
    const ok = new Set(colors.map((c) => c.toUpperCase()));
    const bad = new Set(forbidden_colors.map((c) => c.toUpperCase()));
    return figmaNodes(ctx).flatMap((n) => (n.fills ?? []).map((f) => String(f).toUpperCase())
      .filter((f) => bad.has(f) || !ok.has(f)).map((f) => `${n.id} ${n.name}: 색 ${f}`));
  },

  U4(ctx) {
    const t = ctx.rules.design_tokens;
    const v = [];
    for (const n of figmaNodes(ctx)) {
      for (const s of n.spacing ?? []) if (!t.spacing.includes(s)) v.push(`${n.id} ${n.name}: 간격 ${s}`);
      const panel = /panel/i.test(n.name ?? '');
      const pill = (r) => t.radius_pill && r >= t.radius_pill[0] && r <= t.radius_pill[1];
      for (const r of n.radius ?? []) if (!t.radius.includes(r) && !pill(r) && !(panel && r === t.radius_mac_panel)) v.push(`${n.id} ${n.name}: 라운드 ${r}`);
      if (n.fontSize != null && !t.font_size.includes(n.fontSize)) v.push(`${n.id} ${n.name}: 글자 크기 ${n.fontSize}`);
    }
    return v;
  },

  U5(ctx) {
    const { layer_suffix, height } = ctx.rules.design_tokens.cta;
    return figmaNodes(ctx).filter((n) => String(n.name ?? '').endsWith(layer_suffix) && n.height !== height)
      .map((n) => `${n.id} ${n.name}: CTA 높이 ${n.height} (≠ ${height})`);
  },

  U6(ctx) {
    const d = ctx.rules.design_tokens.brand_forbidden;
    const { screens, spec, figmaText } = uxTexts(ctx);
    return [
      ...figmaText.map((n) => ({ where: `figma ${n.id}`, text: n.text })),
      ...screens.map((r) => ({ where: `screens.md:${r.line}`, text: r['텍스트'] })),
      ...spec.map((r) => ({ where: `spec.md:${r.line}`, text: r.text })),
    ].flatMap(({ where, text }) => matches(d, text).map((h) => `${where}: "${h}"`));
  },

  U7(ctx) {
    const live = readJson(path.join(ctx.run, 'p4-check/figma-live.json'));
    if (!live) return ['p4-check/figma-live.json 없음 — judge 가 Figma MCP 로 받은 실제 지문이 필요하다'];
    const norm = (n) => JSON.stringify({ id: n.id, name: n.name, type: n.type, fills: (n.fills ?? []).map((f) => String(f).toUpperCase()).sort(),
      spacing: [...(n.spacing ?? [])].sort(), radius: [...(n.radius ?? [])].sort(), fontSize: n.fontSize ?? null, text: n.text ?? null, height: n.height ?? null });
    const a = new Map(figmaNodes(ctx).map((n) => [n.id, norm(n)]));
    const b = new Map((live.nodes ?? []).map((n) => [n.id, norm(n)]));
    const v = [];
    for (const [id, s] of a) if (!b.has(id)) v.push(`${id}: 실제 Figma 에 없음`); else if (b.get(id) !== s) v.push(`${id}: figma.json 과 실제 Figma 가 다름`);
    for (const id of b.keys()) if (!a.has(id)) v.push(`${id}: figma.json 에 없음`);
    return v;
  },

  S1(ctx) {
    const spec = ctx.rules.gates.screenshots.spec;
    const v = [];
    const count = new Map();
    for (const f of glob(ctx.run, 'p3-make/out/*.png')) {
      const name = path.basename(f);
      const plat = ['aos', 'mac'].find((p) => new RegExp(spec[p].name).test(name));
      if (!plat) { v.push(`파일명 규격 밖: ${name}`); continue; }
      const { w, h } = pngSize(f);
      if (w !== spec[plat].size[0] || h !== spec[plat].size[1]) v.push(`${name}: ${w}×${h} (≠ ${spec[plat].size.join('×')})`);
      const lang = name.split(/-(str|mac)/)[0];
      count.set(`${plat}/${lang}`, (count.get(`${plat}/${lang}`) ?? 0) + 1);
    }
    for (const [k, n] of count) {
      const [lo, hi] = spec[k.split('/')[0]].count;
      if (n < lo || n > hi) v.push(`${k}: ${n}장 (허용 ${lo}–${hi})`);
    }
    if (!count.size && !v.length) v.push('p3-make/out/ 에 규격 PNG 없음');
    return v;
  },

  S2(ctx) {
    const spec = ctx.rules.gates.screenshots.spec;
    const have = new Map();
    for (const f of glob(ctx.run, 'p3-make/out/*.png')) {
      const name = path.basename(f);
      const plat = ['aos', 'mac'].find((p) => new RegExp(spec[p].name).test(name));
      if (plat) (have.get(plat) ?? have.set(plat, new Set()).get(plat)).add(name.split(/-(str|mac)/)[0]);
    }
    return [...have].flatMap(([plat, langs]) => spec.required_langs.filter((l) => !langs.has(l)).map((l) => `${plat}: ${l} 없음`));
  },

  S3(ctx) {
    return copyRows(ctx).flatMap((r) => {
      const n = r.headline_lines ? Number(r.headline_lines) : r.headline.split('\n').length;
      return n > 2 ? [`copy.csv:${r.row} ${r.platform}/${r.lang}/${r.slot} 헤드라인 ${n}줄`] : [];
    });
  },

  S4(ctx) { return copyAndOcr(ctx, ctx.rules.dictionaries.legacy_feature); },

  S5(ctx) {
    const v = [];
    for (const r of copyRows(ctx)) {
      const t = `${r.headline}\n${r.sub}`;
      if (['ko', 'ja', 'zh-CN'].includes(r.lang) && t.includes('—')) v.push(`copy.csv:${r.row} ${r.lang} em dash`);
      if (r.platform === 'mac' && /\p{Extended_Pictographic}/u.test(t)) v.push(`copy.csv:${r.row} mac 카피 이모지`);
    }
    return v;
  },

  S6(ctx) { return copyAndOcr(ctx, ctx.rules.dictionaries.personal_data); },

  S7(ctx) {
    const ok = ctx.rules.gates.screenshots.spec.status_time;
    const v = [];
    for (const o of ocr(ctx)) {
      for (const [hex, n] of Object.entries(o.colorHits)) if (n > 0) v.push(`${o.rel}: 금지 색 ${hex} ${n}px`);
      for (const m of o.text.matchAll(/(?<![\d:])(\d{1,2}:\d{2})(?![\d:])/g)) if (!ok.includes(m[1])) v.push(`${o.rel}: 시각 ${m[1]} (≠ 09:41)`);
    }
    return v;
  },

  S8(ctx) { return copyAndOcr(ctx, ctx.rules.design_tokens.brand_forbidden); },

  S9(ctx) {
    const table = ctx.rules.gates.screenshots.lang_foreign_script;
    const v = [];
    for (const o of ocr(ctx).filter((x) => x.rel.startsWith('p3-make/out/'))) {
      const lang = path.basename(o.file).split(/-(str|mac)/)[0];
      // 오인식 방지: 그 문자를 주 언어로 읽은 pass 의 줄이고, 그 문자가 3자 이상 · 줄(공백 제외)의 60% 이상일 때만 센다
      const passOf = { Hangul: 'ko', Hiragana: 'ja', Katakana: 'ja' };
      for (const script of table[lang] ?? []) {
        const re = new RegExp(`\\p{Script=${script}}`, 'gu');
        const hits = o.lines.filter((l) => {
          const n = (l.text.match(re) ?? []).length;
          return l.pass === passOf[script] && n >= 3 && n / l.text.replace(/\s/g, '').length >= 0.6;
        }).map((l) => l.text);
        for (const h of hits) v.push(`${o.rel}: ${lang} 세트에 ${script} "${h}"`);
      }
    }
    return v;
  },

  Q1(ctx) {
    const qa = qaSheet(ctx);
    if (!qa) return [`qa-${ctx.version}.md 없음`];
    if (!qa.scope) return ['범위 표(| 영역 | 섹션 | 근거 |) 없음'];
    if (!qa.scope.header.includes('섹션')) return ['범위 표에 섹션 열 없음 — 영역별 항목 수를 셀 수 없다'];
    const bySection = new Set(qa.rows.map((r) => r.section));
    return qa.scope.rows.filter((r) => !strip(r['섹션']).split(/[,\s]+/).filter(Boolean).some((s) => bySection.has(s)))
      .map((r) => `범위 '${strip(r['영역'])}' (섹션 ${strip(r['섹션']) || '비어 있음'}) 항목 0개`);
  },

  Q2(ctx) {
    const qa = qaSheet(ctx);
    if (!qa) return [`qa-${ctx.version}.md 없음`];
    const v = [];
    for (const r of qa.rows) {
      for (const c of ['절차', '기대', '우선']) if (!strip(r[c])) v.push(`${r.id}: ${c} 비어 있음`);
      if (strip(r['우선']) && !['P0', 'P1', 'P2'].includes(r.pri)) v.push(`${r.id}: 우선 '${r.pri}'`);
    }
    if (!qa.rows.length) v.push('항목 표 행 0개');
    return v;
  },

  Q3(ctx) {
    const qa = qaSheet(ctx);
    if (!qa) return [`qa-${ctx.version}.md 없음`];
    if (!qa.stat) return ["머리 통계 '상태: N항목 (P0 a / P1 b / P2 c)' 없음"];
    const real = { total: qa.rows.length, P0: 0, P1: 0, P2: 0 };
    for (const r of qa.rows) if (r.pri in real) real[r.pri]++;
    return Object.keys(real).filter((k) => real[k] !== qa.stat[k]).map((k) => `머리 ${k}=${qa.stat[k]} · 실제 ${real[k]}`);
  },

  Q4(ctx) {
    const qa = qaSheet(ctx);
    if (!qa) return [`qa-${ctx.version}.md 없음`];
    const dir = path.join(ctx.appRepo, 'docs/qa');
    const cmp = (a, b) => a.split('.').map(Number).reduce((acc, x, i) => acc || x - b.split('.').map(Number)[i], 0);
    const prev = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
      .map((f) => /^qa-(\d+\.\d+\.\d+)\.md$/.exec(f)?.[1]).filter(Boolean)
      .filter((ver) => cmp(ver, ctx.version) < 0).sort(cmp).pop();
    if (!prev) return [];
    const norm = (s) => strip(s).replace(/\s+/g, ' ').toLowerCase();
    const old = new Set(parseQa(read(path.join(dir, `qa-${prev}.md`))).rows.map((r) => norm(r['항목'])));
    return qa.rows.filter((r) => old.has(norm(r['항목']))).map((r) => `${r.id} '${strip(r['항목'])}' 가 qa-${prev}.md 에 이미 있음`);
  },

  Q5(ctx) {
    const qa = qaSheet(ctx);
    if (!qa) return [`qa-${ctx.version}.md 없음`];
    const n = qa.rows.length;
    const v = [];
    const notion = read(path.join(ctx.run, `p5-derive/qa-${ctx.version}-notion.md`));
    if (notion != null) {
      const boxes = notion.split('\n').filter((l) => /^\s*- \[[ xX]\]/.test(l)).length;
      if (boxes !== n) v.push(`노션 파생본 체크박스 ${boxes} · 정본 ${n}`);
    }
    const log = read(path.join(ctx.run, 'p5-derive/sync-log.md'));
    const m = log && /notion_items:\s*(\d+)/.exec(log);
    if (log != null && !m) v.push("sync-log.md 에 'notion_items: N' 없음");
    if (m && +m[1] !== n) v.push(`노션 페이지 항목 ${m[1]} · 정본 ${n}`);
    const ids = new Set(qa.rows.map((r) => r.id));
    for (const f of glob(ctx.run, 'p5-derive/*.csv')) {
      for (const r of csv(fs.readFileSync(f, 'utf8'))) {
        const id = strip(r.ID ?? r.id ?? Object.values(r)[0]);
        if (id && !ids.has(id)) v.push(`${path.basename(f)}: ${id} 가 정본에 없음`);
      }
    }
    return v;
  },
};

function figmaNodes(ctx) {
  const f = readJson(path.join(ctx.run, 'p3-make/figma.json'));
  if (!f) throw new Error('p3-make/figma.json 없음');
  return f.nodes ?? [];
}

function scopedTexts(ctx) {
  if (ctx.domain === 'ux') {
    const { screens, spec, figmaText } = uxTexts(ctx);
    return [
      ...screens.map((r) => ({ where: `screens.md:${r.line}`, text: `${r['화면']} ${r['텍스트']}` })),
      ...spec.map((r) => ({ where: `spec.md:${r.line}`, text: r.text })),
      ...figmaText.map((n) => ({ where: `figma ${n.id}`, text: n.text })),
    ];
  }
  if (ctx.domain === 'screenshots') {
    return [
      ...copyRows(ctx).map((r) => ({ where: `copy.csv:${r.row}`, text: `${r.headline}\n${r.sub}` })),
      ...ocr(ctx).map((o) => ({ where: `OCR ${o.rel}`, text: o.text })),
    ];
  }
  if (ctx.domain === 'events') {
    return eventRows(ctx).filter((r) => r.implemented !== 'removed')
      .map((r) => ({ where: `amplitude_events.csv:${r.row} ${r.event_name}`, text: `${r.description_ko}\n${r.purpose ?? ''}` }));
  }
  const qa = qaSheet(ctx);
  return (qa?.rows ?? []).map((r) => ({ where: r.id, text: r['항목'] }));
}

function copyAndOcr(ctx, dict) {
  return [
    ...copyRows(ctx).map((r) => ({ where: `copy.csv:${r.row}`, text: `${r.headline}\n${r.sub}` })),
    ...ocr(ctx).map((o) => ({ where: `OCR ${o.rel}`, text: o.text })),
  ].flatMap(({ where, text }) => [...new Set(matches(dict, text))].map((h) => `${where}: "${h.replace(/\n/g, ' ')}"`));
}

function pngSize(f) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(f, 'r');
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  if (b.toString('latin1', 1, 4) !== 'PNG') return { w: 0, h: 0 };
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ── 이벤트 시트 ──────────────────────────────────────────
function eventRows(ctx) {
  const t = read(path.join(ctx.run, 'p3-make/amplitude_events.csv'));
  if (t == null) throw new Error('p3-make/amplitude_events.csv 없음');
  return eventRowsFrom(t);
}
function currentEventRows(ctx) {
  const t = read(path.join(ctx.appRepo, ctx.rules.events.sheet));
  return t == null ? [] : eventRowsFrom(t);
}
function deliverySections(ctx) {
  const md = read(path.join(ctx.run, `p3-make/events-${ctx.version}.md`)) ?? '';
  const secs = {};
  let cur = null;
  for (const line of md.split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) { cur = h[1]; secs[cur] = ''; continue; }
    if (cur) secs[cur] += line + '\n';
  }
  return secs;
}
const appCode = (ctx) => scanCode(ctx.appRepo, ctx.rules.events.code);
function reportOnly(ctx, id) {
  return (ctx.rules.gates.events ?? []).some((g) => g.id === id && g.report_only);
}

Object.assign(G, {
  E1(ctx) {
    const e = ctx.rules.events;
    const head = (read(path.join(ctx.run, 'p3-make/amplitude_events.csv')) ?? '').split(/\r?\n/)[0].split(',').map((x) => x.trim());
    const v = [];
    if (head.join(',') !== e.columns.join(',')) v.push(`헤더 ${head.join(',')} ≠ ${e.columns.join(',')}`);
    const re = new RegExp(e.name_pattern);
    const seen = new Map();
    for (const r of eventRows(ctx)) {
      if (!re.test(r.event_name)) v.push(`행 ${r.row}: 이름 형식 '${r.event_name}'`);
      if (seen.has(r.event_name)) v.push(`행 ${r.row}: '${r.event_name}' 중복 (행 ${seen.get(r.event_name)})`);
      seen.set(r.event_name, r.row);
      if (!e.implemented_values.includes(r.implemented)) v.push(`행 ${r.row}: implemented '${r.implemented}'`);
      if (!e.platform_values.includes(r.platform)) v.push(`행 ${r.row}: platform '${r.platform}'`);
    }
    const removedNow = new Set(currentEventRows(ctx).filter((r) => r.implemented === 'removed').map((r) => r.event_name));
    for (const r of eventRows(ctx)) if (removedNow.has(r.event_name) && r.implemented !== 'removed') v.push(`'${r.event_name}' 은 소거된 이름 — 다시 쓰지 않는다`);
    return v;
  },

  E2(ctx) {
    const scope = read(path.join(ctx.run, 'p1-collect/scope.md')) ?? '';
    const ids = tablesWith(scope, ['ID']).flatMap((t) => t.rows).map((r) => strip(r.ID)).filter((x) => /^K-\d+$/.test(x));
    const changes = tablesWith(read(path.join(ctx.run, 'p2-design/changes.md')) ?? '', ['구분', 'event_name', '스펙 ID']).flatMap((t) => t.rows);
    const v = [];
    if (!ids.length) v.push('scope.md 에 키 스펙 ID(K-01 …) 없음');
    for (const id of ids) if (!changes.some((r) => r['스펙 ID'].split(/[,\s]+/).map(strip).includes(id))) v.push(`${id}: changes.md 에 대응 행 없음`);
    for (const r of changes) {
      if (!ctx.rules.events.change_kinds.includes(strip(r['구분']))) v.push(`changes.md:${r.line} 구분 '${strip(r['구분'])}'`);
      if (strip(r['구분']) === '측정 안 함' && !strip(r.purpose)) v.push(`changes.md:${r.line} '측정 안 함' 사유(purpose) 없음`);
    }
    return v;
  },

  E3(ctx) {
    const now = new Map(currentEventRows(ctx).map((r) => [r.event_name, r]));
    return eventRows(ctx).filter((r) => r.implemented !== 'removed')
      .filter((r) => !now.has(r.event_name) || propsKey(now.get(r.event_name).properties) !== propsKey(r.properties))
      .filter((r) => !r.purpose).map((r) => `'${r.event_name}' 추가·변경인데 purpose 없음`);
  },

  E4(ctx) {
    const pii = new Set(ctx.rules.events.pii_props);
    return eventRows(ctx).filter((r) => r.implemented !== 'removed')
      .flatMap((r) => parseProps(r.properties).filter((p) => pii.has(p.key)).map((p) => `'${r.event_name}'.${p.key} 는 개인정보`));
  },

  A5(ctx) {
    const bad = new Set(ctx.rules.events.clip_content_props);
    return eventRows(ctx).filter((r) => r.implemented !== 'removed')
      .flatMap((r) => parseProps(r.properties).filter((p) => bad.has(p.key)).map((p) => `'${r.event_name}'.${p.key} — 클립 원문을 분석 서버로 보내면 안 된다 (길이·타입만)`));
  },

  B6(ctx) {
    const e = ctx.rules.events;
    const d = ctx.rules.dictionaries.b_paywall;
    const v = [];
    for (const r of eventRows(ctx).filter((x) => x.implemented !== 'removed' && e.sync_categories.includes(x.category))) {
      if (r.event_name === 'fakedoor_needs') continue; // 아래에서 값 단위로 본다
      for (const p of parseProps(r.properties)) for (const h of matches(d, [p.key, ...(p.enum ?? [])].join(' '))) v.push(`'${r.event_name}'.${p.key}: "${h}"`);
    }
    const src = (rows) => new Set(parseProps(rows.find((r) => r.event_name === 'fakedoor_needs')?.properties).find((p) => p.key === 'source')?.enum ?? []);
    const before = src(currentEventRows(ctx)), after = src(eventRows(ctx));
    for (const val of after) if (!before.has(val) && e.sync_fakedoor_values.includes(val)) v.push(`fakedoor_needs.source 에 동기화 관련 '${val}' 추가 — 동기화 앞 페이월 측정은 사람 판단`);
    return v;
  },

  E7(ctx) {
    const secs = deliverySections(ctx);
    const v = [];
    for (const s of ctx.rules.events.delivery_sections) if (!strip(secs[s] ?? '')) v.push(`events-${ctx.version}.md 에 '## ${s}' 절이 없거나 비어 있음`);
    const q = secs['질문'] ?? '';
    for (const r of eventRows(ctx).filter((x) => x.implemented !== 'removed')) {
      if (parseProps(r.properties).some((p) => (p.enum ?? []).some((x) => x === '…' || x === '...')) && !q.includes(r.event_name)) v.push(`'${r.event_name}' 미정 enum(…) 이 질문 절에 없음`);
    }
    return v;
  },

  E8(ctx) {
    const code = appCode(ctx);
    if (!code.files) return [`앱 코드 없음 (${ctx.appRepo})`];
    const d = drift(eventRows(ctx), code);
    return [
      ...d.yesNotInCode.map((n) => `'${n}' implemented=yes 인데 코드에 없음`),
      ...d.codeNotInSheet.map((n) => `코드가 보내는 '${n}' 가 시트에 없음`),
      ...d.noButInCode.map((n) => `'${n}' implemented=no 인데 코드가 보냄 — yes 로 바꾼다`),
    ];
  },

  E9(ctx) {
    const live = readJson(path.join(ctx.run, 'p4-check/amplitude-live.json'));
    if (!live) return ['p4-check/amplitude-live.json 없음 — judge 가 Amplitude MCP 로 받은 30일 발생량이 필요하다'];
    const counts = live.events ?? {};
    return eventRows(ctx).filter((r) => r.implemented === 'yes' && !(counts[r.event_name] > 0)).map((r) => `'${r.event_name}' 최근 30일 0건`);
  },
});

// ── 단계 → 게이트 ─────────────────────────────────────────
function gatesFor(ctx, stage) {
  const g = ctx.rules.gates;
  const domainGates = ctx.domain === 'screenshots' ? g.screenshots.checks : g[ctx.domain];
  const ids = (list, st) => list.filter((x) => x.stage === st).map((x) => x.id);
  switch (stage) {
    case 'P1': return ['ART'];
    case 'P2': return ['ART', ...ids(domainGates, 'P2')];
    case 'P3': return ['ART'];
    case 'HUMAN': return ['APPROVAL'];
    case 'P4': return ['ART', 'APPROVAL', ...ids(g.common, 'P4'), ...ids(domainGates, 'P4')];
    case 'P5': return ['ART', ...ids(domainGates, 'P5')];
  }
}

function onFail(ctx, id, stage) {
  if (id === 'ART') return stage;
  if (id === 'APPROVAL') return 'HUMAN';
  const g = ctx.rules.gates;
  const all = [...g.common, ...g.ux, ...g.screenshots.checks, ...g.qa, ...g.events];
  return all.find((x) => x.id === id)?.on_fail ?? stage;
}

// ── 상태 ─────────────────────────────────────────────────
function loadState(ctx) {
  return readJson(path.join(ctx.run, 'state.json')) ?? { slug: ctx.slug, domain: ctx.domain, version: ctx.version, passed: [], fails: {}, blocked_at: null, history: [] };
}
function saveState(ctx, st) {
  fs.mkdirSync(ctx.run, { recursive: true });
  fs.writeFileSync(path.join(ctx.run, 'state.json'), JSON.stringify(st, null, 2) + '\n');
}
function nextStage(st) {
  return STAGES.find((s) => !st.passed.includes(s)) ?? null;
}

// ── main ─────────────────────────────────────────────────
function main() {
  let args, ctx;
  try {
    args = parseArgs(process.argv.slice(2));
    ctx = context(args);
  } catch (e) {
    console.error(`[verify] 오류: ${e.message}`);
    return EXIT.error;
  }

  if (args.hashOnly) {
    console.log(inputsHash(ctx).hash);
    return EXIT.pass;
  }

  const st = loadState(ctx);

  // 차단 해제: 사람이 unblock.md 를 blocked_at 이후에 썼으면 초기화
  if (st.blocked_at) {
    const ub = path.join(ctx.run, 'unblock.md');
    if (fs.existsSync(ub) && fs.statSync(ub).mtimeMs > Date.parse(st.blocked_at)) {
      st.blocked_at = null;
      st.fails = {};
      st.history.push({ at: new Date().toISOString(), event: 'unblocked' });
    } else {
      console.error(`[verify] 차단됨 (${st.blocked_at}). 사람이 runs/${ctx.slug}/unblock.md 를 써야 풀린다.`);
      return EXIT.blocked;
    }
  }

  const stage = args.stage ?? nextStage(st);
  if (!stage) {
    console.log(`[verify] ${ctx.slug}: 모든 단계 통과`);
    return EXIT.pass;
  }

  const results = [];
  let error = null;
  for (const id of gatesFor(ctx, stage)) {
    try {
      const violations = id === 'ART' ? G.ART(ctx, stage === 'P4' ? 'P3' : stage) : G[id](ctx);
      if (reportOnly(ctx, id)) results.push({ id, pass: true, report_only: true, violations: [], warnings: violations, return_to: null });
      else results.push({ id, pass: violations.length === 0, violations, return_to: violations.length ? onFail(ctx, id, stage) : null });
    } catch (e) {
      error = `${id}: ${e.message}`;
      results.push({ id, pass: false, error: e.message });
      break;
    }
  }

  const failed = results.filter((r) => !r.pass);
  const pending = failed.length > 0 && failed.every((r) => r.id === 'APPROVAL');
  const status = error ? 'error' : failed.length === 0 ? 'pass' : pending ? 'pending' : 'fail';
  const returnTo = error ? null : failed.length ? earliest(failed.map((r) => r.return_to)) : null;

  // 실패 횟수 (승인 대기·오류는 세지 않는다)
  if (status === 'fail') {
    for (const r of failed) if (r.id !== 'APPROVAL') st.fails[r.id] = (st.fails[r.id] ?? 0) + 1;
  }
  if (status === 'pass') {
    if (!st.passed.includes(stage)) st.passed.push(stage);
    for (const r of results) delete st.fails[r.id];
  } else {
    // 이 단계 이후로 통과 기록을 되돌린다
    st.passed = st.passed.filter((s) => STAGES.indexOf(s) < STAGES.indexOf(stage));
  }
  const max = ctx.rules.retry.max_same_gate_fail;
  const blocked = Object.entries(st.fails).filter(([, n]) => n >= max).map(([id]) => id);
  if (blocked.length) st.blocked_at = new Date().toISOString();

  const report = {
    slug: ctx.slug, stage, status: blocked.length ? 'blocked' : status, return_to: returnTo,
    inputs_sha256: inputsHash(ctx).hash, at: new Date().toISOString(),
    gates: results, fail_counts: st.fails, blocked_gates: blocked,
  };
  st.history.push({ at: report.at, stage, status: report.status, failed: failed.map((r) => r.id) });
  saveState(ctx, st);
  fs.mkdirSync(path.join(ctx.run, 'p4-check'), { recursive: true });
  fs.writeFileSync(path.join(ctx.run, 'p4-check/report.json'), JSON.stringify(report, null, 2) + '\n');

  // 사람이 읽는 요약
  console.log(`[verify] ${ctx.slug} ${stage}: ${report.status}${returnTo ? ` → ${returnTo}` : ''}`);
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.id}${r.error ? ` (오류: ${r.error})` : r.violations.length ? ` ×${r.violations.length}` : ''}`);
    for (const v of (r.violations ?? []).slice(0, 8)) console.log(`       - ${v}`);
    for (const w of (r.warnings ?? []).slice(0, 8)) console.log(`       ! (보고만) ${w}`);
    if ((r.violations?.length ?? 0) > 8) console.log(`       … 외 ${r.violations.length - 8}건 (report.json)`);
  }
  if (pending) console.log(`  승인 대기: runs/${ctx.slug}/approval.md 에 'approved: yes' 와 'inputs_sha256: ${report.inputs_sha256}'`);

  if (blocked.length) return EXIT.blocked;
  if (error) return EXIT.error;
  return status === 'pass' ? EXIT.pass : EXIT.fail;
}

function earliest(list) {
  return list.filter(Boolean).sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b))[0] ?? null;
}

process.exitCode = main();
