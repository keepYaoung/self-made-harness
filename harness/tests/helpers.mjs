// 테스트용 실행 폴더 생성기 — 도메인별 "전부 통과" 기준 실행을 만들고, 테스트가 한 곳씩 망가뜨린다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { figmaDigest } from '../scripts/lib/digest.mjs';

export const HARNESS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = path.resolve(HARNESS, '..');
const VERIFY = path.join(HARNESS, 'scripts/verify.mjs');

export function tmpRoot() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));
  fs.mkdirSync(path.join(d, 'runs'));
  fs.mkdirSync(path.join(d, 'app/docs/qa'), { recursive: true });
  return d;
}

export function write(root, slug, rel, content) {
  const p = path.join(root, 'runs', slug, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

export function verify(root, slug, stage, ...extra) {
  const args = [VERIFY, slug, `--runs-dir=${path.join(root, 'runs')}`, `--app-repo=${path.join(root, 'app')}`, ...extra];
  if (stage) args.push(`--stage=${stage}`);
  const r = spawnSync('node', args, { encoding: 'utf8' });
  const rp = path.join(root, 'runs', slug, 'p4-check/report.json');
  const report = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : null;
  const gate = (id) => report?.gates.find((g) => g.id === id);
  return { code: r.status, out: r.stdout + r.stderr, report, gate };
}

export function approve(root, slug) {
  const r = spawnSync('node', [VERIFY, slug, '--hash', `--runs-dir=${path.join(root, 'runs')}`], { encoding: 'utf8' });
  write(root, slug, 'approval.md', `approved: yes\ninputs_sha256: ${r.stdout.trim()}\n`);
}

// 단색 PNG (RGB). patch: { x, y, w, h, rgb } 로 일부 칠하기
export function png(w, h, rgb = [0xfd, 0xfd, 0xfd], patch = null) {
  const row = Buffer.alloc(1 + w * 3);
  const raw = Buffer.alloc((1 + w * 3) * h);
  for (let y = 0; y < h; y++) {
    row[0] = 0;
    for (let x = 0; x < w; x++) {
      const c = patch && x >= patch.x && x < patch.x + patch.w && y >= patch.y && y < patch.y + patch.h ? patch.rgb : rgb;
      row[1 + x * 3] = c[0]; row[2 + x * 3] = c[1]; row[3 + x * 3] = c[2];
    }
    row.copy(raw, y * row.length);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ── 도메인별 "전부 통과" 실행 ───────────────────────────────
export const UX = '1.1.2-ux-menubar';
export const SS = '1.1.2-screenshots';
export const QA = '1.1.2-qa';

export function figmaNodes() {
  return [
    { id: '1:1', name: 'menubar.panel', type: 'FRAME', fills: ['#FFFFFF'], spacing: [12, 16], radius: [20], fontSize: null, text: null, height: 480 },
    { id: '1:2', name: 'title', type: 'TEXT', fills: ['#333333'], spacing: [], radius: [], fontSize: 16, text: '복사한 클립이 여기 모여요', height: 22 },
    { id: '1:3', name: 'connect.cta', type: 'FRAME', fills: ['#61BF72'], spacing: [16], radius: [12], fontSize: null, text: null, height: 52 },
    { id: '1:4', name: 'cta-label', type: 'TEXT', fills: ['#FFFFFF'], spacing: [], radius: [], fontSize: 18, text: '기기 연결하기', height: 24 },
  ];
}

export const figmaJson = (nodes) => ({ file_key: 'abc', frame_ids: ['1:1'], nodes });
// judge 가 Figma 에서 받았을 지문 = 기준선 노드의 지문
export const liveDigest = (nodes = figmaNodes()) => `--figma-digest=${figmaDigest(figmaJson(nodes))}`;

export function goodUx(root) {
  const s = UX;
  write(root, s, 'p1-collect/scope.md', '| ID | 기능 | 근거 |\n|---|---|---|\n| F-01 | 클립 목록 | TODO 3 |\n| F-02 | 기기 연결 | TODO 4 |\n');
  const refs = Array.from({ length: 5 }, (_, i) => `| ${i + 1} | App${i + 1} | 패널 | https://uibowl.io/s/${i + 1} | 여백 |`).join('\n');
  write(root, s, 'p2-design/references.md', `| # | 앱 | 화면 | 출처 URL | 반영 포인트 |\n|---|---|---|---|---|\n${refs}\n`);
  write(root, s, 'p2-design/screens.md', '| 화면 | 흐름 | 기능 ID | 텍스트 |\n|---|---|---|---|\n| 메뉴바 패널 | 기타 | F-01 | 복사한 클립이 여기 모여요 |\n| 기기 연결 | 연결 | F-02 | 종단간 암호화(E2EE)로 안전하게 연결해요. MacBook Pro 도 돼요 |\n');
  write(root, s, 'p2-design/spec.md', '| 요소 | 카피 |\n|---|---|\n| 제목 | 복사한 클립이 여기 모여요 |\n| CTA | 기기 연결하기 |\n');
  write(root, s, 'p3-make/figma.json', JSON.stringify(figmaJson(figmaNodes()), null, 2));
  approve(root, s);
}

export function copyCsv(rows) {
  const q = (v) => `"${String(v).replaceAll('"', '""')}"`;
  return 'platform,slot,lang,headline,sub,feature_id,headline_lines\n' + rows.map((r) => [r.platform, r.slot, r.lang, q(r.headline), q(r.sub ?? ''), r.feature_id ?? 'F-01', r.headline_lines ?? ''].join(',')).join('\n') + '\n';
}

export function goodCopyRows() {
  const text = { en: ['Copy once, paste anywhere', 'End-to-end encrypted'], ko: ['한 번 복사, 어디서나 붙여넣기', '종단간 암호화'], ja: ['一度コピー、どこでも貼り付け', 'エンドツーエンド暗号化'] };
  const rows = [];
  for (const lang of ['en', 'ko', 'ja']) for (let n = 1; n <= 5; n++) rows.push({ platform: 'aos', slot: n, lang, headline: text[lang][0], sub: n === 1 ? text[lang][1] : '', headline_lines: 1 });
  return rows;
}

let blank = null;
export function goodScreenshots(root) {
  const s = SS;
  blank ??= png(1024, 1920);
  write(root, s, 'p1-collect/scope.md', '| ID | 기능 | 근거 |\n|---|---|---|\n| F-01 | 동기화 | 릴리즈 노트 |\n');
  write(root, s, 'p2-design/copy.csv', copyCsv(goodCopyRows()));
  write(root, s, 'p3-make/raw/cap1.png', blank);
  for (const lang of ['en', 'ko', 'ja']) for (let n = 1; n <= 5; n++) write(root, s, `p3-make/out/${lang}-str-scrnsht${n}.png`, blank);
  approve(root, s);
}

export function qaSheet({ stat = '4항목 (P0 2 / P1 1 / P2 1)', scopeHeader = '| 영역 | 섹션 | 근거 |', extraRow = '', item1 = '화면 꺼짐 장시간 수신' } = {}) {
  return `# 1.1.2 QA 시트

작성 2026-09-29 · 상태: **${stat}**

## 범위

${scopeHeader}
|---|---|---|
| 백그라운드 유지 | W | TODO 7 |
| 공지 배너 | NB | TODO 10 |

# W. 백그라운드 유지 ⭐

| ID | 항목 | 절차 | 기대 | 우선 | 결과 |
|---|---|---|---|---|---|
| W-01 | **${item1}** | 화면 끄고 30분 방치 → 전송 | 도착 | **P0** | |
| W-02 | 스와이프 후 수신 | 최근 앱 제거 → 전송 | 도착 | P1 | |
${extraRow}
# NB. 공지 배너

| ID | 항목 | 절차 | 기대 | 우선 | 결과 |
|---|---|---|---|---|---|
| NB-01 | 배너 다국어 | 언어 6개 전환 | 넘치지 않음 | P0 | |
| NB-02 | 버전 타겟 | 1.1.1 기기에서 확인 | 안 보임 | P2 | |
`;
}

export function goodQa(root) {
  const s = QA;
  write(root, s, 'p1-collect/scope.md', '| 영역 | 섹션 | 근거 |\n|---|---|---|\n| 백그라운드 유지 | W | TODO 7 |\n');
  write(root, s, 'p2-design/items.md', '초안\n');
  write(root, s, 'p3-make/qa-1.1.2.md', qaSheet());
  fs.writeFileSync(path.join(root, 'app/docs/qa/qa-1.1.1.md'), '| ID | 항목 | 절차 | 기대 | 우선 | 결과 |\n|---|---|---|---|---|---|\n| X-01 | 예전 항목 | a | b | P1 | |\n');
  const boxes = ['W-01', 'W-02', 'NB-01', 'NB-02'].map((id) => `- [ ]  **${id}** …`).join('\n');
  write(root, s, 'p5-derive/qa-1.1.2-notion.md', `# 체크리스트\n\n${boxes}\n`);
  write(root, s, 'p5-derive/sync-log.md', 'page: https://notion.so/x\nnotion_items: 4\n');
  write(root, s, 'p5-derive/publish.json', '{"copy":[]}\n');
  write(root, s, 'p5-derive/qa-1.1.2-essential.csv', 'ID,항목\nW-01,a\nNB-01,b\n');
  approve(root, s);
}

// ── 이벤트 시트 ─────────────────────────────────────────
export const EV = '1.1.2-events';
const EVENT_TOOLS = path.join(HARNESS, 'scripts/event-tools.mjs');
export function eventTools(root, cmd, slug = EV) {
  return spawnSync('node', [EVENT_TOOLS, cmd, slug, `--runs-dir=${path.join(root, 'runs')}`, `--app-repo=${path.join(root, 'app')}`], { encoding: 'utf8' });
}
export const CHANGES_HEAD = '| 구분 | event_name | category | 설명 | properties | platform | purpose | 스펙 ID |\n|---|---|---|---|---|---|---|---|\n';
export function goodEvents(root) {
  const app = (rel, text) => { const p = path.join(root, 'app', rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
  app('docs/events/amplitude_events.csv', 'event_name,category,description_ko,properties,platform,implemented\n'
    + 'app_started,lifecycle,앱 시작,"platform, version",both,yes\n'
    + 'clipboard_sent,clipboard,클립보드 전송,"content_length, content_type",both,yes\n'
    + 'fakedoor_needs,funnel,유료 기능 fake door,source(history_cap_card|device_limit),mac,yes\n'
    + 'pin_generated,pin_auth,PIN 생성 (소거),,mac,removed\n');
  app('android/app/src/main/java/A.kt', 'fun a() { logAmplitudeEvent("app_started"); Amplitude.getInstance().logEvent("clipboard_sent") }\n');
  app('mac/Sources/B.swift', 'func b() { AnalyticsManager.shared.track("fakedoor_needs"); track("paste_stack_completed") }\n');
  write(root, EV, 'p1-collect/scope.md', '| ID | 키 스펙 | 근거 |\n|---|---|---|\n| K-01 | 붙여넣기 스택 | release-notes-1.1.2.md 12행 |\n');
  write(root, EV, 'p2-design/changes.md', CHANGES_HEAD + '| 추가 | paste_stack_completed | clipboard | 붙여넣기 스택 완료 | item_count, source(menu\\|hotkey\\|…) | mac | 스택 기능 사용 빈도 | K-01 |\n');
  const r = eventTools(root, 'apply');
  if (r.status !== 0) throw new Error(r.stderr);
  write(root, EV, 'p3-make/events-1.1.2.md', '초안 — 검토 필요\n\n## 목적\n- paste_stack_completed — 스택 기능 사용 빈도\n\n## 퍼널\n- 해당 없음: 순서 있는 경로 없음\n\n## 질문\n- paste_stack_completed.source 의 나머지 값(…)\n\n## 커버리지\n- 설정 화면은 범위 밖\n');
  write(root, EV, 'p4-check/amplitude-live.json', JSON.stringify({ range_days: 30, events: { app_started: 10, clipboard_sent: 5, fakedoor_needs: 2, paste_stack_completed: 1 } }));
  approve(root, EV);
}
export const csvOf = (root) => fs.readFileSync(path.join(root, 'runs', EV, 'p3-make/amplitude_events.csv'), 'utf8');
