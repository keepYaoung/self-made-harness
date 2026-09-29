#!/usr/bin/env node
// PreToolUse guard (Write · Edit · MultiEdit · NotebookEdit · Bash).
// 1) approval.md 는 사람만 쓴다 — 에이전트·메인 세션 모두 차단
// 2) state.json · p4-check/report.json 은 verify.mjs 만 쓴다 — 도구 쓰기 차단
// 3) 하네스 서브에이전트는 Write/Edit 금지 — 결과를 블록으로 돌려주고 메인 세션이 저장
// 차단 = exit 2 + stderr
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runState, FOLDER_OF } from './lib/stage.mjs';

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HARNESS_AGENTS = new Set(['collector', 'planner', 'maker', 'publisher', 'judge']);
const HUMAN_ONLY = /(^|\/)runs\/[^/]+\/(approval|unblock)\.md$/;
const SCRIPT_ONLY = /(^|\/)runs\/[^/]+\/(state\.json|p4-check\/report\.json)$/;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
// Bash 에서 보호 파일이 "쓰기 대상"인 형태만 잡는다 (본문에 이름이 나오는 것만으로는 막지 않음)
// 경로 앞에는 괄호·백틱·$ 가 올 수 없다 — 코드 문자열(`=> exists(\`runs/…\`)`)을 리다이렉트로 오인하지 않게
const PROTECTED = String.raw`[^\s'"\`()$|;&<>]*runs\/[^\s'"\`()|;&<>]*\/(approval\.md|unblock\.md|state\.json|p4-check\/report\.json)`;
const BASH_TARGETS = [
  new RegExp(String.raw`(>>?|>\|)\s*['"]?${PROTECTED}`),                         // 리다이렉트
  new RegExp(String.raw`\btee\b(\s+-\w+)*\s+['"]?${PROTECTED}`),                 // tee
  new RegExp(String.raw`\b(cp|mv|rm|touch|truncate|install|ln|dd)\b[^|;&\n]*${PROTECTED}`),
  new RegExp(String.raw`\bsed\s+(-\w*\s+)*-i[^|;&\n]*${PROTECTED}`),
  new RegExp(String.raw`\b(writeFile|writeFileSync|appendFile|open)\b[^\n]*${PROTECTED}`), // node/python 인라인
];

function block(msg) {
  process.stderr.write(`[guard-write] ${msg}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  block('hook 입력 JSON 파싱 실패 — 안전하게 차단');
}

const tool = input.tool_name;
const agent = input.agent_type;
const ti = input.tool_input ?? {};

if (WRITE_TOOLS.has(tool)) {
  const p = String(ti.file_path ?? ti.notebook_path ?? '');
  if (HUMAN_ONLY.test(p)) block(`${p} 는 사람만 쓴다. 사용자에게 직접 작성을 요청하라.`);
  if (SCRIPT_ONLY.test(p)) block(`${p} 는 verify.mjs 만 쓴다.`);
  if (agent && HARNESS_AGENTS.has(agent)) {
    block(`${agent} 는 파일을 직접 쓰지 않는다. <<<FILE 경로 … >>> 블록으로 돌려줘라.`);
  }
  // 4) runs/<slug>/ 안은 지금 단계 폴더에만 (state.json 의 다음 단계)
  const rel = path.relative(path.join(ROOT, 'runs'), path.resolve(input.cwd ?? ROOT, p));
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    const [slug, folder] = rel.split(path.sep);
    const st = runState(path.join(ROOT, 'runs'), slug);
    if (!st) block(`runs/${slug} 에 state.json 이 없다 — 먼저 node harness/scripts/verify.mjs ${slug} --init`);
    const allowed = FOLDER_OF[st.next];
    if (!allowed) block(`지금 단계(${st.next ?? '완료'})에서는 runs/${slug} 에 쓸 산출물이 없다${st.next ? '' : ' — 고치려면 --reopen'}`);
    if (folder !== allowed) block(`지금 단계는 ${st.next} — runs/${slug}/${allowed}/ 에만 쓸 수 있다 (요청: ${folder}/)`);
  }
}

if (tool === 'Bash') {
  const cmd = String(ti.command ?? '');
  if (BASH_TARGETS.some((re) => re.test(cmd))) {
    block('보호 파일(approval.md · unblock.md · state.json · report.json)을 셸로 쓰려는 명령은 차단된다.');
  }
}

process.exit(0);
