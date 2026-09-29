#!/usr/bin/env node
// QA 시트 기계 작업 — 사람·에이전트가 세거나 옮겨 적지 않는다.
//   fill-stats <slug>              p3-make/qa-{v}.md 머리 통계({{STATS}} 또는 기존 값)를 실제 행 수로 채움
//   derive <slug>                  정본 → p5-derive/qa-{v}-notion.md · qa-{v}-essential.csv(P0) · qa-{v}-medium.csv(P1)
//   merge-results <slug> <notion.md>  노션에서 체크한 결과를 정본 `결과` 열로 가져옴 (동기화 1단계)
// 공통 옵션: --runs-dir=DIR     exit 0 성공 · 1 입력 문제 · 2 오류
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strip, parseQa, countQa, statText, csvCell, STAT_RE } from './lib/md.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const runsDir = path.resolve(argv.find((a) => a.startsWith('--runs-dir='))?.slice(11) ?? path.join(ROOT, 'runs'));
const [cmd, slug, extra] = argv.filter((a) => !a.startsWith('--'));
const m = /^(\d+\.\d+\.\d+)-qa$/.exec(slug ?? '');
if (!cmd || !m) {
  console.error('사용: qa-tools.mjs <fill-stats|derive|merge-results> <version>-qa [notion.md]');
  process.exit(2);
}
const version = m[1];
const run = path.join(runsDir, slug);
const canonPath = path.join(run, `p3-make/qa-${version}.md`);
if (!fs.existsSync(canonPath)) {
  console.error(`[qa-tools] 정본 없음: ${path.relative(ROOT, canonPath)}`);
  process.exit(1);
}
const canon = fs.readFileSync(canonPath, 'utf8');
const qa = parseQa(canon);

if (cmd === 'fill-stats') {
  const text = statText(countQa(qa.rows));
  let next;
  if (canon.includes('{{STATS}}')) next = canon.replace('{{STATS}}', text);
  else if (STAT_RE.test(canon)) next = canon.replace(STAT_RE, text);
  else { console.error("[qa-tools] 머리에 '상태: {{STATS}}' 자리가 없다"); process.exit(1); }
  fs.writeFileSync(canonPath, next);
  console.log(`[qa-tools] ${text}`);
} else if (cmd === 'derive') {
  const icon = { P0: '🔴', P1: '🟡', P2: '⚪' };
  const bySection = new Map();
  for (const r of qa.rows) (bySection.get(r.section) ?? bySection.set(r.section, []).get(r.section)).push(r);
  const title = (code) => qa.sections.find((s) => s.code === code)?.title ?? code;
  let md = `# Clipdoggy ${version} QA 체크리스트\n\n붙여넣기용 파생본. 정본은 \`qa-${version}.md\` — 여기서 직접 고치지 않는다.\n결과는 노션에 적고, 동기화 때 정본 \`결과\` 열로 가져온다.\n\n- ${statText(countQa(qa.rows))}\n- **P0 는 하나라도 실패하면 출시하지 않는다**\n`;
  for (const [code, rows] of bySection) {
    md += `\n\n## ${code}. ${title(code)}\n`;
    for (const r of rows) {
      md += `\n- [${strip(r['결과']) ? 'x' : ' '}]  ${icon[r.pri] ?? ''} **${r.id}** ${strip(r['항목'])}\n    - 어떻게: ${strip(r['절차'])}\n    - 기대: ${strip(r['기대'])}\n    - 결과: ${strip(r['결과'])}\n`;
    }
  }
  const out = path.join(run, 'p5-derive');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `qa-${version}-notion.md`), md);
  const csvOf = (pri) => ['ID,항목,절차,기대,우선,결과', ...qa.rows.filter((r) => r.pri === pri).map((r) => [r.id, strip(r['항목']), strip(r['절차']), strip(r['기대']), r.pri, strip(r['결과'])].map(csvCell).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(out, `qa-${version}-essential.csv`), csvOf('P0'));
  fs.writeFileSync(path.join(out, `qa-${version}-medium.csv`), csvOf('P1'));
  console.log(`[qa-tools] 노션 ${qa.rows.length}항목 · essential ${qa.rows.filter((r) => r.pri === 'P0').length} · medium ${qa.rows.filter((r) => r.pri === 'P1').length}`);
} else if (cmd === 'merge-results') {
  if (!extra || !fs.existsSync(extra)) { console.error('[qa-tools] 노션 내보내기 파일이 필요하다'); process.exit(1); }
  // "- [x] … **ID** …" 다음 줄들의 "- 결과: …" 를 읽는다
  const results = new Map();
  let cur = null;
  for (const line of fs.readFileSync(extra, 'utf8').split('\n')) {
    const h = /^\s*- \[([ xX])\].*?\*\*([A-Z]+-\d+[a-z]?)\*\*/.exec(line);
    if (h) { cur = { id: h[2], checked: h[1] !== ' ', text: '' }; results.set(cur.id, cur); continue; }
    const r = /^\s+- 결과:\s*(.*)$/.exec(line);
    if (r && cur) cur.text = r[1].trim();
  }
  let changed = 0;
  const lines = canon.split('\n');
  for (const row of qa.rows) {
    const got = results.get(row.id);
    if (!got) continue;
    const value = got.text || (got.checked ? '통과' : '');
    if (!value || value === strip(row['결과'])) continue;
    const i = row.line - 1;
    const cells = lines[i].split('|');
    cells[cells.length - 2] = ` ${value} `; // 마지막 열 = 결과
    lines[i] = cells.join('|');
    changed++;
  }
  fs.writeFileSync(canonPath, lines.join('\n'));
  console.log(`[qa-tools] 결과 ${changed}건 정본에 반영 (노션 항목 ${results.size})`);
} else {
  console.error(`[qa-tools] 알 수 없는 명령: ${cmd}`);
  process.exit(2);
}
