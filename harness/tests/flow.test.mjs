// 종료 코드 · 재시도 한도 · 차단 해제 · 실제 데이터 회귀 · guard hook
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpRoot, write, verify, goodQa, qaSheet, QA, HARNESS, ROOT, liveDigest } from './helpers.mjs';

test('exit 2: slug 형식 오류', () => {
  const root = tmpRoot();
  assert.equal(verify(root, 'qa-sheet', 'P1').code, 2);
  assert.equal(verify(root, '1.1.2-ux', 'P1').code, 2); // ux 는 주제 필수
});

test('다음 단계 자동 선택: P1 통과 뒤 stage 생략 시 P2', () => {
  const root = tmpRoot(); goodQa(root);
  assert.equal(verify(root, QA).code, 0);
  const r = verify(root, QA);
  assert.equal(r.report.stage, 'P2');
});

test('같은 게이트 3회 실패 → exit 3 차단, unblock.md 로만 풀림', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet({ stat: '9항목 (P0 9 / P1 0 / P2 0)' }));
  assert.equal(verify(root, QA, 'P4').code, 1);
  assert.equal(verify(root, QA, 'P4').code, 1);
  const third = verify(root, QA, 'P4');
  assert.equal(third.code, 3); assert.deepEqual(third.report.blocked_gates.includes('Q3'), true);
  assert.equal(verify(root, QA, 'P4').code, 3, '차단 중에는 계속 3');
  // 사람이 unblock.md 를 쓴 뒤 → 초기화되고 다시 판정
  const ub = path.join(root, 'runs', QA, 'unblock.md');
  fs.writeFileSync(ub, 'reason: 기준 확인\n');
  const later = new Date(Date.now() + 5000); fs.utimesSync(ub, later, later);
  const after = verify(root, QA, 'P4');
  assert.equal(after.code, 1, after.out);
  assert.deepEqual(after.report.fail_counts, { Q3: 1 });
});

test('회귀: 1.0.4 en 스토어 세트는 ★A2 · S3 · S4 · S6 · S7 · S8 · S9 에서 실패', { timeout: 180_000 }, () => {
  const root = tmpRoot();
  fs.cpSync(path.join(HARNESS, 'tests/fixtures/runs/1.0.4-screenshots'), path.join(root, 'runs/1.0.4-screenshots'), { recursive: true });
  const r = verify(root, '1.0.4-screenshots', 'P4');
  assert.equal(r.code, 1);
  const failed = r.report.gates.filter((g) => !g.pass).map((g) => g.id);
  for (const id of ['A2', 'S3', 'S4', 'S6', 'S7', 'S8', 'S9']) assert.ok(failed.includes(id), `${id} 실패해야 함 — ${failed}`);
  const all = JSON.stringify(r.report);
  for (const s of ['Bluetooth', 'Pair', "Tomy's Pixel", '11:31', '클립보드 지우기']) assert.ok(all.includes(s), s);
});

test('회귀: 실제 qa-1.1.1.md (앱 리포 있으면) — Q3 통과, Q1 섹션 열 없음', (t) => {
  const src = path.resolve(ROOT, '../clipdoggy/docs/qa/qa-1.1.1.md');
  if (!fs.existsSync(src)) return t.skip('앱 리포 없음');
  const root = tmpRoot();
  write(root, '1.1.1-qa', 'p1-collect/scope.md', 'x');
  write(root, '1.1.1-qa', 'p2-design/items.md', 'x');
  write(root, '1.1.1-qa', 'p3-make/qa-1.1.1.md', fs.readFileSync(src));
  fs.cpSync(path.resolve(ROOT, '../clipdoggy/docs/qa/qa-1.1.0.md'), path.join(root, 'app/docs/qa/qa-1.1.0.md'));
  const r = verify(root, '1.1.1-qa', 'P4');
  assert.equal(r.gate('Q3').pass, true, '손으로 센 119항목 통계는 맞다');
  assert.equal(r.gate('Q1').pass, false);
});

const save = (root, slug, role, input) => spawnSync('node', [path.join(HARNESS, 'scripts/save-blocks.mjs'), slug, role, `--runs-dir=${path.join(root, 'runs')}`], { input, encoding: 'utf8' });
test('save-blocks: 역할 폴더 안만 저장, 하나라도 어긋나면 전부 거부', () => {
  const root = tmpRoot();
  assert.equal(save(root, QA, 'P1', `<<<FILE runs/${QA}/p1-collect/a.md\na\n>>>\n`).status, 1, 'init 전에는 저장 안 함');
  write(root, QA, 'state.json', JSON.stringify({ passed: ['P1'], fails: {}, history: [] }));
  assert.equal(save(root, QA, 'P3', `<<<FILE runs/${QA}/p3-make/a.md\na\n>>>\n`).status, 1, '지금 단계(P2)가 아닌 역할은 거부');
  const ok = save(root, QA, 'P2', `설명\n<<<FILE runs/${QA}/p2-design/items.md\n| ID | 항목 |\n>>>\n`);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'runs', QA, 'p2-design/items.md'), 'utf8'), '| ID | 항목 |\n');
  const mixed = save(root, QA, 'P2', `<<<FILE runs/${QA}/p2-design/a.md\na\n>>>\n<<<FILE runs/${QA}/p3-make/b.md\nb\n>>>\n`);
  assert.equal(mixed.status, 1);
  assert.equal(fs.existsSync(path.join(root, 'runs', QA, 'p2-design/a.md')), false, '부분 저장 없음');
  assert.equal(save(root, QA, 'P3', `<<<FILE runs/${QA}/approval.md\napproved: yes\n>>>\n`).status, 1);
  assert.equal(save(root, QA, 'P1', `<<<FILE runs/${QA}/../../etc/x\nx\n>>>\n`).status, 1);
  write(root, QA, 'state.json', JSON.stringify({ passed: ['P1', 'P2', 'P3', 'HUMAN'], fails: {}, history: [] }));
  assert.equal(save(root, QA, 'JUDGE', `<<<FILE runs/${QA}/p4-check/amplitude-live.json\n{}\n>>>\n`).status, 0);
  assert.equal(save(root, QA, 'JUDGE', `<<<FILE runs/${QA}/p4-check/figma-live.json\n{}\n>>>\n`).status, 1, 'Figma 는 파일이 아니라 지문으로만');
  assert.equal(save(root, QA, 'JUDGE', `<<<FILE runs/${QA}/p4-check/report.json\n{}\n>>>\n`).status, 1);
});

// guard hook — 모의 입력
const guard = (name, input, root = null) => spawnSync('node', [path.join(HARNESS, 'scripts', name)], { input: typeof input === 'string' ? input : JSON.stringify(input), env: { ...process.env, ...(root ? { CLAUDE_PROJECT_DIR: root } : {}) } }).status;
test('guard-write: 보호 파일·서브에이전트 쓰기 차단, 일반 저장 허용', () => {
  const W = 'guard-write.mjs';
  assert.equal(guard(W, { tool_name: 'Write', tool_input: { file_path: '/r/runs/1.1.2-qa/approval.md' } }), 2);
  assert.equal(guard(W, { tool_name: 'Write', tool_input: { file_path: 'runs/1.1.2-qa/unblock.md' } }), 2);
  assert.equal(guard(W, { tool_name: 'Edit', tool_input: { file_path: 'runs/1.1.2-qa/state.json' } }), 2);
  assert.equal(guard(W, { tool_name: 'Edit', tool_input: { file_path: 'runs/1.1.2-qa/p4-check/report.json' } }), 2);
  assert.equal(guard(W, { tool_name: 'Write', agent_type: 'planner', tool_input: { file_path: 'runs/1.1.2-qa/p2-design/items.md' } }), 2);
  const root = tmpRoot(); goodQa(root); verify(root, QA, 'P1'); // 다음 단계 = P2
  const at = (rel) => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: rel } });
  assert.equal(guard(W, at('runs/1.1.2-qa/p2-design/items.md'), root), 0, '지금 단계 폴더는 허용');
  assert.equal(guard(W, at('runs/1.1.2-qa/p3-make/x.md'), root), 2, '다음 단계 폴더는 차단');
  assert.equal(guard(W, at('runs/1.9.9-qa/p1-collect/scope.md'), root), 2, 'state.json 없는 실행은 차단');
  assert.equal(guard(W, at('harness/rules.yaml'), root), 0, 'runs/ 밖은 관여 안 함');
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: 'echo approved: yes > runs/1.1.2-qa/approval.md' } }), 2);
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: 'printf x | tee -a runs/a/state.json' } }), 2);
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: 'cp /tmp/x runs/a/approval.md' } }), 2);
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: 'cat runs/1.1.2-qa/approval.md' } }), 0);
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: "cat > notes.md <<'EOF'\napproval.md 는 사람만\nEOF" } }), 0, '본문 언급은 허용');
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: "python3 - <<'EOF'\ns='runs.filter((d) => exists(`runs/${d}/state.json`))'\nEOF" } }), 0, '코드 속 화살표 함수는 리다이렉트 아님');
  assert.equal(guard(W, { tool_name: 'Bash', tool_input: { command: 'echo {} > "runs/a/state.json"' } }), 2, '따옴표 경로 리다이렉트는 차단');
  assert.equal(guard(W, 'not json'), 2);
});
test('guard-judge: judge 는 verify.mjs 와 MCP 읽기만', () => {
  const J = 'guard-judge.mjs';
  assert.equal(guard(J, { tool_name: 'Bash', agent_type: 'judge', tool_input: { command: 'node harness/scripts/verify.mjs 1.1.2-qa --stage=P4' } }), 0);
  assert.equal(guard(J, { tool_name: 'Bash', agent_type: 'judge', tool_input: { command: 'node harness/scripts/verify.mjs 1.1.2-qa; rm -rf runs' } }), 2);
  assert.equal(guard(J, { tool_name: 'Bash', agent_type: 'judge', tool_input: { command: 'ls runs' } }), 2);
  assert.equal(guard(J, { tool_name: 'mcp__figma__get_metadata', agent_type: 'judge', tool_input: {} }), 0);
  assert.equal(guard(J, { tool_name: 'mcp__figma__use_figma', agent_type: 'judge', tool_input: {} }), 2);
  assert.equal(guard(J, { tool_name: 'Bash', agent_type: 'maker', tool_input: { command: 'ls' } }), 0);
});

// ── 실행 수명주기: init · status · review_after · proceed · reopen · 승인 보관 ──
import YAML from 'yaml';
import { goodUx, UX, approve } from './helpers.mjs';
const rulesWithReview = (root, stages) => {
  const r = YAML.parse(fs.readFileSync(path.join(HARNESS, 'rules.yaml'), 'utf8'));
  r.review_after = stages;
  const p = path.join(root, 'rules-review.yaml');
  fs.writeFileSync(p, YAML.stringify(r));
  return `--rules=${p}`;
};
test('init: ux 는 Figma URL 필수, file_key 를 state 에 남긴다 · 두 번 init 은 exit 2', () => {
  const root = tmpRoot();
  assert.equal(verify(root, UX, null, '--init').code, 2);
  assert.equal(verify(root, UX, null, '--init', '--figma=https://www.figma.com/design/AbC123/x').code, 0);
  const st = JSON.parse(fs.readFileSync(path.join(root, 'runs', UX, 'state.json'), 'utf8'));
  assert.equal(st.figma_file_key, 'AbC123');
  assert.equal(verify(root, UX, null, '--init', '--figma=https://www.figma.com/design/AbC123/x').code, 2);
});
test('U7: figma.json 이 init 때와 다른 Figma 파일에서 나오면 실패', () => {
  const root = tmpRoot();
  verify(root, UX, null, '--init', '--figma=https://www.figma.com/design/OTHER/x');
  goodUx(root);
  const r = verify(root, UX, 'P4', liveDigest());
  assert.match(r.gate('U7').violations.join(), /다른 파일/);
});
test('review_after: 통과 뒤 확인 대기(exit 4) → proceed 로만 다음 단계, status 도 4', () => {
  const root = tmpRoot(); goodQa(root);
  const R = rulesWithReview(root, ['P1']);
  const r1 = verify(root, QA, null, R);
  assert.equal(r1.code, 0); assert.match(r1.out, /사용자 확인 대기/);
  assert.equal(verify(root, QA, null, R).code, 4, '확인 전에는 다음 단계 판정 안 함');
  assert.equal(verify(root, QA, null, R, '--status').code, 4);
  assert.equal(verify(root, QA, null, R, '--proceed').code, 0);
  assert.equal(verify(root, QA, null, R, '--proceed').code, 2, '대기 아닐 때 proceed 는 오류');
  assert.equal(verify(root, QA, null, R).report.stage, 'P2');
});
test('reopen: 지정 단계부터 통과 기록을 되돌린다', () => {
  const root = tmpRoot(); goodQa(root);
  for (const s of ['P1', 'P2', 'P3']) assert.equal(verify(root, QA, s).code, 0);
  assert.equal(verify(root, QA, null, '--reopen=P2').code, 0);
  const st = JSON.parse(fs.readFileSync(path.join(root, 'runs', QA, 'state.json'), 'utf8'));
  assert.deepEqual(st.passed, ['P1']);
  assert.equal(verify(root, QA, null, '--reopen=P9').code, 2);
});
test('APPROVAL: 무효가 된 승인은 approval-stale-<n>.md 로 보관되고 승인 대기로', () => {
  const root = tmpRoot(); goodQa(root);
  write(root, QA, 'p3-make/qa-1.1.2.md', qaSheet() + '\n바뀜\n');
  const r = verify(root, QA, 'HUMAN');
  assert.equal(r.code, 1); assert.match(r.out, /approval-stale-1\.md/);
  assert.ok(fs.existsSync(path.join(root, 'runs', QA, 'approval-stale-1.md')));
  assert.equal(fs.existsSync(path.join(root, 'runs', QA, 'approval.md')), false);
  approve(root, QA);
  assert.equal(verify(root, QA, 'HUMAN').code, 0, '현재 산출물로 다시 승인하면 통과');
});
test('guard-judge: judge 는 init·proceed·reopen·rules 를 못 쓴다', () => {
  for (const f of ['--init', '--proceed', '--reopen=P1', '--rules=x.yaml'])
    assert.equal(guard('guard-judge.mjs', { tool_name: 'Bash', agent_type: 'judge', tool_input: { command: `node harness/scripts/verify.mjs 1.1.2-qa ${f}` } }), 2, f);
});

test('guard-review: 확인 대기 중이면 작업 에이전트 호출 차단, judge 는 통과', () => {
  const root = tmpRoot(); goodQa(root);
  const call = (t) => guard('guard-review.mjs', { tool_name: 'Agent', tool_input: { subagent_type: t } }, root);
  assert.equal(call('planner'), 0);
  write(root, QA, 'state.json', JSON.stringify({ passed: ['P1'], fails: {}, history: [], awaiting_review: 'P1' }));
  assert.equal(call('planner'), 2);
  assert.equal(call('judge'), 0);
});
