#!/usr/bin/env node
// 이벤트 시트 기계 작업 — 에이전트가 CSV 를 손으로 고치지 않는다.
//   drift <slug>   앱 리포 현재 시트 ↔ 앱 코드 드리프트를 markdown 으로 출력 (P1 수집 입력)
//   apply <slug>   현재 시트 + p2-design/changes.md → p3-make/amplitude_events.csv
// 공통 옵션: --runs-dir=DIR --app-repo=DIR     exit 0 성공 · 1 입력 문제 · 2 오류
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { strip, tablesWith, csvCell } from './lib/md.mjs';
import { eventRowsFrom, scanCode, drift } from './lib/events.mjs';

const HARNESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(HARNESS, '..');
const rules = YAML.parse(fs.readFileSync(path.join(HARNESS, 'rules.yaml'), 'utf8'));
const defaults = YAML.parse(fs.readFileSync(path.join(HARNESS, 'defaults.yaml'), 'utf8'));
const argv = process.argv.slice(2);
const opt = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runsDir = path.resolve(opt('runs-dir') ?? path.join(ROOT, 'runs'));
const appRepo = path.resolve(opt('app-repo') ?? path.resolve(ROOT, defaults.app_repo));
const [cmd, slug] = argv.filter((a) => !a.startsWith('--'));
const m = /^(\d+\.\d+\.\d+)-events$/.exec(slug ?? '');
if (!cmd || !m) {
  console.error('사용: event-tools.mjs <drift|apply> <version>-events');
  process.exit(2);
}
const version = m[1];
const E = rules.events;
const sheetPath = path.join(appRepo, E.sheet);
if (!fs.existsSync(sheetPath)) {
  console.error(`[event-tools] 현재 시트 없음: ${sheetPath}`);
  process.exit(1);
}
const current = eventRowsFrom(fs.readFileSync(sheetPath, 'utf8'));
const code = scanCode(appRepo, E.code);

if (cmd === 'drift') {
  const d = drift(current, code);
  const list = (xs) => (xs.length ? xs.map((x) => `- \`${x}\``).join('\n') : '- 없음');
  console.log(`## 드리프트 — 현재 시트 ↔ 앱 코드 (${code.files}개 파일)\n`);
  console.log(`### 코드가 보내는데 시트에 없음 (${d.codeNotInSheet.length})\n${list(d.codeNotInSheet)}\n`);
  console.log(`### 시트는 implemented=yes 인데 코드에 없음 (${d.yesNotInCode.length})\n${list(d.yesNotInCode)}\n`);
  console.log(`### 시트는 implemented=no 인데 코드가 보냄 (${d.noButInCode.length})\n${list(d.noButInCode)}`);
} else if (cmd === 'apply') {
  const run = path.join(runsDir, slug);
  const cp = path.join(run, 'p2-design/changes.md');
  if (!fs.existsSync(cp)) { console.error('[event-tools] p2-design/changes.md 없음'); process.exit(1); }
  const changes = tablesWith(fs.readFileSync(cp, 'utf8'), E.changes_columns).flatMap((t) => t.rows);
  const rows = current.map((r) => ({ ...Object.fromEntries(E.columns.map((c) => [c, r[c] ?? ''])) }));
  const byName = new Map(rows.map((r) => [r.event_name, r]));
  const today = new Date().toISOString().slice(0, 10);
  const problems = [];
  for (const c of changes) {
    const kind = strip(c['구분']);
    const name = strip(c.event_name);
    const val = (k) => strip(c[k]);
    if (kind === '측정 안 함') continue;
    if (kind === '추가') {
      if (byName.has(name)) { problems.push(`추가 '${name}': 이미 시트에 있다 (변경으로 적는다)`); continue; }
      const r = { event_name: name, category: val('category'), description_ko: val('설명'), properties: val('properties'), platform: val('platform'),
        implemented: code.calls.has(name) ? 'yes' : 'no', purpose: val('purpose'), since: version };
      rows.push(r); byName.set(name, r);
    } else if (kind === '변경') {
      const r = byName.get(name);
      if (!r) { problems.push(`변경 '${name}': 시트에 없다`); continue; }
      for (const [col, k] of [['category', 'category'], ['description_ko', '설명'], ['properties', 'properties'], ['platform', 'platform'], ['purpose', 'purpose']]) if (val(k)) r[col] = val(k);
    } else if (kind === '소거') {
      const r = byName.get(name);
      if (!r) { problems.push(`소거 '${name}': 시트에 없다`); continue; }
      r.implemented = 'removed';
      r.description_ko = `${r.description_ko} (${today} 소거 — ${val('purpose') || '사유 미기재'})`;
    } else problems.push(`구분 '${kind}' 모름 (${E.change_kinds.join('·')})`);
  }
  if (problems.length) {
    console.error('[event-tools] changes.md 를 적용할 수 없다:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const out = [E.columns.join(','), ...rows.map((r) => E.columns.map((c) => csvCell(r[c] ?? '')).join(','))].join('\n') + '\n';
  fs.mkdirSync(path.join(run, 'p3-make'), { recursive: true });
  fs.writeFileSync(path.join(run, 'p3-make/amplitude_events.csv'), out);
  const n = (k) => changes.filter((c) => strip(c['구분']) === k).length;
  console.log(`[event-tools] ${rows.length}행 · 추가 ${n('추가')} · 변경 ${n('변경')} · 소거 ${n('소거')} · 측정 안 함 ${n('측정 안 함')}`);
} else {
  console.error(`[event-tools] 알 수 없는 명령: ${cmd}`);
  process.exit(2);
}
