#!/usr/bin/env node
// PreToolUse guard (Agent · Task) — 사용자 확인 대기(review_after) 중에는 작업 에이전트를 부르지 않는다.
// judge 등 작업 에이전트가 아닌 호출은 통과. 해제: 사용자 진행 지시 → verify.mjs <slug> --proceed, 수정 → --reopen=<단계>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runState } from './lib/stage.mjs';

const WORK_AGENTS = new Set(['collector', 'planner', 'maker', 'publisher']);
const RUNS = path.join(process.env.CLAUDE_PROJECT_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), 'runs');

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (!WORK_AGENTS.has(String(input?.tool_input?.subagent_type ?? ''))) process.exit(0);
if (!fs.existsSync(RUNS)) process.exit(0);

const waiting = fs.readdirSync(RUNS).map((s) => [s, runState(RUNS, s)]).filter(([, st]) => st?.awaiting_review).map(([s, st]) => `${s}(${st.awaiting_review})`);
if (waiting.length) {
  process.stderr.write(`[guard-review] 사용자 확인 대기 중: ${waiting.join(', ')} — 산출물을 보여 드리고 진행 지시를 받은 뒤 verify.mjs <slug> --proceed (수정이면 --reopen=<단계>)\n`);
  process.exit(2);
}
process.exit(0);
