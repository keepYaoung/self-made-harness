// 실행 상태 → 지금 쓸 수 있는 단계 폴더 (guard-write · save-blocks 공용)
import fs from 'node:fs';
import path from 'node:path';

export const STAGES = ['P1', 'P2', 'P3', 'HUMAN', 'P4', 'P5'];
export const FOLDER_OF = { P1: 'p1-collect', P2: 'p2-design', P3: 'p3-make', P4: 'p4-check', P5: 'p5-derive' };

export function runState(runsDir, slug) {
  const p = path.join(runsDir, slug, 'state.json');
  if (!fs.existsSync(p)) return null;
  const st = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { ...st, next: STAGES.find((s) => !(st.passed ?? []).includes(s)) ?? null };
}
