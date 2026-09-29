#!/usr/bin/env node
// PreToolUse guard — judge 전용 (Bash · MCP).
// judge 는 `node harness/scripts/verify.mjs …` 만 실행하고, MCP 는 읽기 도구만 쓴다.
// 다른 에이전트·메인 세션 호출은 그대로 통과. 차단 = exit 2 + stderr
import { readFileSync } from 'node:fs';
import { isDigestCode } from './lib/digest.mjs';

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
  if (/--(init|proceed|reopen|figma=|rules=)/.test(cmd)) block('judge 는 판정만 한다 — init·proceed·reopen 은 오케스트레이터가 사용자 지시로만');
}

if (tool.endsWith('__use_figma')) {
  // Figma 는 verify.mjs --figma-code 가 출력한 digest 코드 그대로만 (노드 수정 코드 차단)
  if (!isDigestCode(input.tool_input?.code)) block('judge 의 use_figma 는 `verify.mjs <slug> --figma-code` 출력 코드를 한 글자도 바꾸지 않고 실행할 때만 허용된다');
  process.exit(0);
}

if (tool.startsWith('mcp__')) {
  const name = tool.split('__').pop();
  const READ = /^(get_|read|fetch|search|list|query_|whoami)/;
  if (!READ.test(name)) block(`judge 는 MCP 읽기 도구만 쓴다: ${tool}`);
}

process.exit(0);
