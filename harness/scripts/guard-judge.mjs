#!/usr/bin/env node
// PreToolUse guard — judge 전용 (Bash · MCP).
// judge 는 `node harness/scripts/verify.mjs …` 만 실행하고, MCP 는 읽기 도구만 쓴다.
// 다른 에이전트·메인 세션 호출은 그대로 통과. 차단 = exit 2 + stderr
import { readFileSync } from 'node:fs';

function block(msg) {
  process.stderr.write(`[guard-judge] ${msg}\n`);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  block('hook 입력 JSON 파싱 실패 — 안전하게 차단');
}

if (input.agent_type !== 'judge') process.exit(0);

const tool = String(input.tool_name ?? '');

if (tool === 'Bash') {
  const cmd = String(input.tool_input?.command ?? '').trim();
  // 인자는 slug·옵션만 허용. 체이닝·리다이렉트·치환 금지
  const ok = /^node harness\/scripts\/verify\.mjs( [\w.:=\/-]+)*$/.test(cmd);
  if (!ok) block(`judge 는 verify.mjs 만 실행한다: "${cmd}"`);
}

if (tool.startsWith('mcp__')) {
  const name = tool.split('__').pop();
  const READ = /^(get_|read|fetch|search|list|query_|whoami)/;
  if (!READ.test(name)) block(`judge 는 MCP 읽기 도구만 쓴다: ${tool}`);
}

process.exit(0);
