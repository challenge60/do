#!/usr/bin/env node
/*
  build/apply-overrides.js
  ------------------------
  관리자·편집자가 Supabase question_overrides 테이블에 쌓아둔 수정사항을
  해당 자격증의 certs/<certId>/data.js(SAMPLE_DATA) 원본에 직접 병합한다.

  이 스크립트 자체는 Supabase에 접속하지 않는다(이 저장소는 정적 배포라
  DB 자격증명을 스크립트에 넣어두는 게 안전하지 않기 때문). 대신, Supabase에서
  아래 쿼리로 뽑은 결과를 JSON 파일로 저장해서 인자로 넘겨주면 된다.

    select question_id, question, answer, images, tags,
           unit_major, unit_minor, year, round, no, points
    from public.question_overrides
    where cert_id = '<certId>';

  사용법:
    node build/apply-overrides.js <certId> <overrides.json> [--exclude=id1,id2,...]

  예시:
    node build/apply-overrides.js concrete-siljak /tmp/overrides_concrete-siljak.json \
      --exclude=con-0001,con-0002,con-0003

  동작:
    1. certs/<certId>/data.js를 그대로 certs/<certId>/backup/data-<UTC타임스탬프>.js로 백업
    2. overrides.json의 각 행을 question_id 기준으로 SAMPLE_DATA와 매칭해서,
       값이 null이 아닌 필드만 덮어씀 (null/미제공 필드는 원본 값 유지 —
       "이 필드는 안 건드렸다"는 뜻이지 "비워라"는 뜻이 아니기 때문)
    3. --exclude로 지정한 question_id는 병합 대상에서 제외 (예: 테스트하다 남은
       임시값 등 실제 데이터가 아닌 것으로 확인된 행)
    4. 현재 SAMPLE_DATA에 없는 question_id(= 이미 지워졌거나 id가 재정비된 경우)는
       "고아(orphan)"로 분류해 건너뛰고 목록으로 보고
    5. data.js 상단에 병합 시각·건수·백업 경로·제외/고아 내역을 주석으로 남김
    6. 새 data.js를 씀 (build-hub.js는 별도로 실행해야 함 — 이 스크립트는
       data.js만 갱신하고 캐시버스팅/버전 스탬프는 건드리지 않는다)

  주의: 이 스크립트를 실행한 뒤에는 반드시 다음을 확인할 것
    - node --check certs/<certId>/data.js  (문법 확인)
    - node build/build-hub.js              (허브 재빌드)
    - git diff로 실제 변경 내용 검토 후 commit/push
*/

const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error("[apply-overrides] 오류:", msg);
  process.exit(1);
}

function kstStamp() {
  const utcMs = Date.now();
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}` +
    `-${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}${p(kst.getUTCSeconds())}`
  );
}

// ---------- 인자 파싱 ----------
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v === undefined ? true : v];
    })
);

const certId = positional[0];
const overridesPath = positional[1];
if (!certId || !overridesPath) {
  fail(
    "사용법: node build/apply-overrides.js <certId> <overrides.json> [--exclude=id1,id2]"
  );
}
const excludeIds = new Set(
  (flags.exclude || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const repoRoot = path.join(__dirname, "..");
const dataPath = path.join(repoRoot, "certs", certId, "data.js");
if (!fs.existsSync(dataPath)) fail(`certs/${certId}/data.js 가 없습니다.`);
if (!fs.existsSync(overridesPath)) fail(`${overridesPath} 파일이 없습니다.`);

// ---------- data.js 파싱 (CERT_ID / EXAM_CONFIG / UNIT_TAXONOMY / IMAGES / SAMPLE_DATA) ----------
const code = fs.readFileSync(dataPath, "utf8");

function extract(name, nextName) {
  const re = new RegExp(
    `const ${name} = ([\\s\\S]*?);\\s*\\n\\s*\\nconst ${nextName}`
  );
  const m = code.match(re);
  if (!m) fail(`data.js에서 ${name} 블록을 못 찾았습니다.`);
  return m[1];
}
function extractLast(name) {
  const re = new RegExp(`const ${name} = ([\\s\\S]*);\\s*$`);
  const m = code.match(re);
  if (!m) fail(`data.js에서 ${name} 블록을 못 찾았습니다.`);
  return m[1];
}

const headerEnd = code.indexOf("const CERT_ID");
if (headerEnd === -1) fail("data.js에서 CERT_ID를 못 찾았습니다.");
const header = code.slice(0, headerEnd);

const certIdRaw = extract("CERT_ID", "EXAM_CONFIG");
const examConfigRaw = extract("EXAM_CONFIG", "UNIT_TAXONOMY");
const taxonomyRaw = extract("UNIT_TAXONOMY", "IMAGES");
const imagesRaw = extract("IMAGES", "SAMPLE_DATA");
const sampleDataRaw = extractLast("SAMPLE_DATA");

let sampleData;
try {
  sampleData = JSON.parse(sampleDataRaw);
} catch (e) {
  fail("SAMPLE_DATA JSON 파싱 실패: " + e.message);
}

const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
if (!Array.isArray(overrides)) fail("overrides 파일은 배열이어야 합니다.");

// ---------- 백업 ----------
const ts = kstStamp();
const backupDir = path.join(repoRoot, "certs", certId, "backup");
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `data-${ts}.js`);
fs.writeFileSync(backupPath, code, "utf8");

// ---------- 병합 ----------
const byId = new Map(sampleData.map((d) => [d.id, d]));
const FIELD_MAP = [
  ["question", "question"],
  ["answer", "answer"],
  ["images", "images"],
  ["tags", "tags"],
  ["unit_major", "unitMajor"],
  ["unit_minor", "unitMinor"],
  ["year", "year"],
  ["round", "round"],
  ["no", "no"],
  ["points", "points"],
];

const applied = [];
const orphan = [];
const excluded = [];

for (const ov of overrides) {
  const qid = ov.question_id;
  if (excludeIds.has(qid)) {
    excluded.push(qid);
    continue;
  }
  const target = byId.get(qid);
  if (!target) {
    orphan.push(qid);
    continue;
  }
  const changed = [];
  for (const [src, dst] of FIELD_MAP) {
    const v = ov[src];
    if (v !== null && v !== undefined) {
      target[dst] = v;
      changed.push(dst);
    }
  }
  applied.push({ id: qid, fields: changed });
}

// ---------- 새 data.js 작성 ----------
let mergeNote =
  `//\n// [관리자/편집자 수정사항 반영: ${ts} (KST)]\n` +
  `// Supabase question_overrides 기준 ${overrides.length}건 중 ${applied.length}건을 이 파일에 직접 반영했습니다.\n` +
  `// 반영 전 원본은 backup/data-${ts}.js 에 그대로 보관돼 있습니다.\n`;
if (orphan.length) {
  mergeNote += `// (참고: id가 더 이상 존재하지 않아 반영 못한 항목 ${orphan.length}건 — ${JSON.stringify(orphan)})\n`;
}
if (excluded.length) {
  mergeNote += `// (참고: --exclude로 지정해 의도적으로 제외한 항목 ${excluded.length}건 — ${JSON.stringify(excluded)})\n`;
}

const newCode =
  header +
  mergeNote +
  `const CERT_ID = ${certIdRaw};\n\n` +
  `const EXAM_CONFIG = ${examConfigRaw};\n\n` +
  `const UNIT_TAXONOMY = ${taxonomyRaw};\n\n` +
  `const IMAGES = ${imagesRaw};\n\n` +
  `const SAMPLE_DATA = ${JSON.stringify(sampleData)};\n`;

fs.writeFileSync(dataPath, newCode, "utf8");

// ---------- 결과 리포트 ----------
console.log(`[apply-overrides] ${certId}`);
console.log(`  백업:   ${path.relative(repoRoot, backupPath)}`);
console.log(`  적용:   ${applied.length}건`);
if (excluded.length) console.log(`  제외:   ${excluded.length}건 — ${excluded.join(", ")}`);
if (orphan.length) console.log(`  고아:   ${orphan.length}건 — ${orphan.join(", ")}`);
console.log(
  `\n다음 순서로 확인하세요:\n  node --check certs/${certId}/data.js\n  node build/build-hub.js\n  git diff certs/${certId}/data.js`
);
