#!/usr/bin/env node
// 하네스 자체 점수 — 100점 만점. 누가(Claude·Codex·Multica·사람) 돌려도 같은 점수가 나온다.
// 리뷰하는 에이전트는 이 출력의 점수를 그대로 쓰고, 의견은 점수 밖에 따로 적는다.
//   node harness/scripts/score.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const HARNESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(HARNESS, '..');
const rel = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => (exists(p) ? fs.readFileSync(rel(p), 'utf8') : '');
const rules = YAML.parse(read('harness/rules.yaml'));
const allGates = Object.entries(rules.gates).flatMap(([dom, v]) => (Array.isArray(v) ? v : v.checks ?? []).map((g) => ({ ...g, dom })));

// 테스트는 한 번만 돌린다
const t = spawnSync('node', ['--test', '--test-reporter=tap', ...fs.readdirSync(rel('harness/tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => rel(`harness/tests/${f}`))], { encoding: 'utf8', timeout: 600_000 });
const tapNum = (k) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(t.stdout)?.[1] ?? 0);
const tests = { total: tapNum('tests'), pass: tapNum('pass'), fail: tapNum('fail') };
const titles = [...t.stdout.matchAll(/^(?:not )?ok \d+ - (.+)$/gm)].map((m) => m[1]);

const items = [];
const add = (area, max, got, why) => items.push({ area, max, got: Math.max(0, Math.min(max, Math.round(got * 10) / 10)), why });

// 1. 판정은 스크립트가 한다
{
  const codes = rules.exit_codes ?? {};
  const okCodes = codes.pass === 0 && codes.fail_or_pending === 1 && codes.error === 2 && codes.blocked === 3;
  const got = (exists('harness/scripts/verify.mjs') ? 2 : 0) + (okCodes ? 2 : 0) + (tests.total && !tests.fail ? 6 : 6 * (tests.pass / Math.max(1, tests.total)));
  add('판정 스크립트 · 테스트 통과', 10, got, `verify.mjs ${exists('harness/scripts/verify.mjs') ? '있음' : '없음'} · exit 계약 ${okCodes ? '일치' : '불일치'} · 테스트 ${tests.pass}/${tests.total}`);
}

// 2. 게이트마다 실패 예시가 테스트로 있다
{
  const text = titles.join('\n');
  const miss = allGates.filter((g) => !new RegExp(`(^|[^A-Z0-9])${g.id}([^0-9]|$)`, 'm').test(text));
  add('게이트별 실패 테스트', 15, 15 * (1 - miss.length / Math.max(1, allGates.length)), miss.length ? `테스트 없음: ${miss.map((g) => g.id).join(', ')}` : `${allGates.length}개 전부`);
}

// 3. ★ 어기면 안 되는 것 → 게이트
{
  const a = allGates.filter((g) => g.star === 'A').length, b = allGates.filter((g) => g.star === 'B').length;
  const svc = read('docs/story-service.md');
  const ok = /\*\*A\./.test(svc) && /\*\*B\./.test(svc);
  add('★ 서비스 금지 조건 게이트화', 10, (a ? 4 : 0) + (b ? 4 : 0) + (ok ? 2 : 0), `★A ${a}개 · ★B ${b}개 · story-service A/B ${ok ? '있음' : '없음'}`);
}

// 4. 규칙 SSOT — 수치를 다른 문서에 복사하지 않는다
{
  const docs = ['AGENTS.md', 'CLAUDE.md', '.claude/skills/run-harness/SKILL.md', ...fs.readdirSync(rel('.claude/agents')).map((f) => `.claude/agents/${f}`)];
  const hits = docs.flatMap((d) => [...read(d).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => `${d}:${m[0]}`));
  const src = rules.sources ?? {};
  const arbitrary = Object.values(src).filter((v) => v === '임의').length;
  const srcOk = Object.keys(src).length > 0 && titles.some((x) => /sources:/.test(x));
  add('규칙 SSOT · 값 출처(임의 표시)', 10, Math.max(0, 5 - hits.length) + (srcOk ? 5 : 0), `${hits.length ? `복사된 hex: ${hits.slice(0, 3).join(', ')}` : 'hex 복사 0건'} · 출처 표 ${Object.keys(src).length}개 (임의 ${arbitrary})`);
}

// 5. 사람 승인은 파일 하나 · 입력이 바뀌면 무효
{
  const inv = titles.some((x) => /승인 뒤 .*바뀌면 무효/.test(x));
  const guard = /approval/.test(read('harness/scripts/guard-write.mjs'));
  const hookOn = /guard-write\.mjs/.test(read('.claude/settings.json'));
  add('사람 승인 (파일 1개 · 무효화)', 10, (inv ? 4 : 0) + (guard ? 3 : 0) + (hookOn ? 3 : 0), `무효화 테스트 ${inv ? 'O' : 'X'} · guard ${guard ? 'O' : 'X'} · hook 등록 ${hookOn ? 'O' : 'X'}`);
}

// 6. 에이전트는 직접 쓰지 않는다 / 자기 폴더만
{
  const agents = fs.readdirSync(rel('.claude/agents')).map((f) => f.replace(/\.md$/, ''));
  const agentsMd = read('AGENTS.md');
  const listed = agents.filter((a) => new RegExp(`\\|\\s*${a}\\s*\\|`).test(agentsMd));
  const saver = exists('harness/scripts/save-blocks.mjs') && titles.some((x) => /save-blocks/.test(x)) && titles.some((x) => /guard-write/.test(x)) && /runState/.test(read('harness/scripts/guard-write.mjs'));
  const judge = /agent_type !== 'judge'/.test(read('harness/scripts/guard-judge.mjs')) && /guard-judge\.mjs/.test(read('.claude/settings.json'));
  add('편집 범위 강제', 10, 4 * (listed.length / Math.max(1, agents.length)) + (saver ? 3 : 0) + (judge ? 3 : 0), `AGENTS.md 역할표 ${listed.length}/${agents.length} · 지금 단계 폴더만 저장 ${saver ? 'O' : 'X'} · judge 제한 ${judge ? 'O' : 'X'}`);
}

// 7. 도구 결과는 대조한다
{
  const u7 = allGates.some((g) => g.id === 'U7') && titles.some((x) => /digest parity/.test(x)) && titles.some((x) => /use_figma 는 digest 코드만/.test(x));
  const ocr = titles.some((x) => /회귀: 1\.0\.4/.test(x));
  add('도구 결과 대조 (Figma 지문 · OCR)', 10, (u7 ? 6 : 0) + (ocr ? 4 : 0), `Figma 지문(코드 고정 · 파일 경유 없음) ${u7 ? 'O' : 'X'} · 실제 이미지 OCR 회귀 ${ocr ? 'O' : 'X'}`);
}

// 8. 실패에는 길과 한도가 있다
{
  const need = allGates.filter((g) => !['ART', 'APPROVAL'].includes(g.id));
  const noRoute = need.filter((g) => !g.on_fail).map((g) => g.id);
  const block = titles.some((x) => /3회 실패 → exit 3/.test(x)) && rules.retry?.max_same_gate_fail > 0;
  add('실패 복귀 · 재시도 한도', 10, 6 * (1 - noRoute.length / Math.max(1, need.length)) + (block ? 4 : 0), `on_fail 없음 ${noRoute.length ? noRoute.join(', ') : '0'} · 차단 테스트 ${block ? 'O' : 'X'}`);
}

// 9. 문서가 가리키는 경로가 실제로 있다
{
  const docs = ['AGENTS.md', 'CLAUDE.md', 'README.md', '.claude/skills/run-harness/SKILL.md', ...fs.readdirSync(rel('.claude/agents')).map((f) => `.claude/agents/${f}`),
    ...fs.readdirSync(rel('harness/guides')).map((f) => `harness/guides/${f}`), 'harness/templates/README.md'];
  const refs = new Set();
  for (const d of docs) for (const m of read(d).matchAll(/`((?:docs|harness|\.claude|tool|templates)\/[^`\s]+?)`/g)) if (!/[{<*]/.test(m[1])) refs.add(`${d} → ${m[1]}`);
  const found = (p) => exists(p) || exists(`harness/${p}`); // guides 는 templates/… 를 harness 기준으로 쓴다
  const missing = [...refs].filter((r) => !found(r.split(' → ')[1].replace(/:\d+$/, '')));
  add('문서 경로 일관성', 10, 10 - 2 * missing.length, missing.length ? `없는 경로: ${missing.slice(0, 4).join(' · ')}` : `${refs.size}개 경로 전부 존재`);
}

// 10. 실제 실행 — 하네스 트리거로 한 번이라도 끝까지(P5) 통과한 실행이 있는가
{
  const runs = exists('runs') ? fs.readdirSync(rel('runs')).filter((d) => exists(`runs/${d}/state.json`)) : [];
  const done = runs.filter((d) => (JSON.parse(read(`runs/${d}/state.json`)).passed ?? []).includes('P5'));
  add('실제 실행 1회 이상 완주', 5, done.length ? 5 : runs.length ? 2 : 0, done.length ? `완주: ${done.join(', ')}` : runs.length ? `진행 중만 있음: ${runs.join(', ')}` : '실행 기록 없음 — 트리거로 한 번 돌려야 한다');
}

const total = Math.round(items.reduce((s, x) => s + x.got, 0) * 10) / 10;
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, tests, items }, null, 2));
} else {
  console.log(`하네스 점수: ${total} / 100   (테스트 ${tests.pass}/${tests.total})\n`);
  for (const x of items) console.log(`${String(x.got).padStart(4)} / ${String(x.max).padEnd(2)}  ${x.area} — ${x.why}`);
}
