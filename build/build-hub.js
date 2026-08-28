#!/usr/bin/env node
/**
 * build-hub.js
 * ------------
 * "마스터 엔진"(engine/app.js, engine/app.css, engine/cert-template.html)을
 * 허브(do) repo의 실제 배포 위치로 반영하는 빌드 스크립트.
 *
 * 사용법:
 *   node build/build-hub.js
 *
 * 하는 일:
 *   1. engine/app.js  -> assets/app.js   로 복사
 *   2. engine/app.css -> assets/app.css  로 복사
 *   3. build/certs.config.json 에 등록된 각 자격증에 대해
 *      engine/cert-template.html 을 읽어 {{TITLE_TEXT}}, {{MARK}}, {{SUB}}, {{COUNT}}
 *      를 치환한 뒤 certs/<id>/index.html 로 저장
 *
 * 주의:
 *   - certs/<id>/data.js 는 이 스크립트가 건드리지 않음 (문항 데이터는 별도 관리)
 *   - 새 자격증을 추가하려면: certs/<id>/data.js 를 만들고,
 *     build/certs.config.json 과 assets/certs-registry.js 에 항목을 추가한 뒤 이 스크립트 실행
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(ROOT, 'engine');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CERTS_DIR = path.join(ROOT, 'certs');
const CONFIG_PATH = path.join(ROOT, 'build', 'certs.config.json');

function log(msg) {
  console.log(`[build-hub] ${msg}`);
}

// ---------- APP_VERSION 자동 갱신 ----------
// engine/app.js 안의 'const APP_VERSION = "..."'을 빌드 시점의 타임스탬프로 자동 교체한다.
// 이걸 수동으로 관리하면(전에 그랬던 것처럼) 매번 깜빡하기 쉽고, 그러면 화면 하단 버전
// 표시가 안 바뀌는 것뿐 아니라 앱에 이미 내장된 "새 버전 나왔어요" 자동 알림 배너
// (checkForNewVersion, engine/app.js 하단)도 조용히 무력화된다 — 버전 문자열이 그대로면
// "달라졌다"고 감지할 방법이 없기 때문. 그래서 빌드할 때마다 무조건 새로 찍히게 만든다.
function stampAppVersion(jsContent) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}`;
  return jsContent.replace(/const APP_VERSION = "[^"]*"/, `const APP_VERSION = "${stamp}"`);
}

// ---------- 캐시 무효화(cache-busting) ----------
// 브라우저가 assets/app.css, assets/hub.js 같은 파일을 예전 버전으로 캐시해둔 채 계속 쓰는
// 문제를 막기 위해, HTML 안의 <link>/<script> 경로에 파일 내용 기반 해시(?v=xxxxxxxx)를 붙인다.
// 파일 내용이 바뀌면 해시도 자동으로 바뀌므로, 사람이 버전 번호를 수동으로 올릴 필요가 없다.
function addCacheBusting(html, htmlDir) {
  return html.replace(
    /(href|src)="((?:\.\.\/)*assets\/[^"?]+\.(?:css|js))(?:\?v=[a-f0-9]+)?"/g,
    (match, attr, relPath) => {
      const absPath = path.resolve(htmlDir, relPath);
      let hash = "0";
      try {
        const buf = fs.readFileSync(absPath);
        hash = crypto.createHash("md5").update(buf).digest("hex").slice(0, 8);
      } catch (e) {
        // 파일을 못 찾으면(외부 CDN 등은 애초에 이 정규식에 안 걸림) 그냥 캐시버스팅 없이 둔다
      }
      return `${attr}="${relPath}?v=${hash}"`;
    }
  );
}

function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // 1) engine -> assets 복사 (app.js, app.css)
  const appJsSrc = path.join(ENGINE_DIR, 'app.js');
  const appCssSrc = path.join(ENGINE_DIR, 'app.css');
  const appJsDst = path.join(ASSETS_DIR, 'app.js');
  const appCssDst = path.join(ASSETS_DIR, 'app.css');

  const stampedAppJs = stampAppVersion(fs.readFileSync(appJsSrc, 'utf8'));
  fs.writeFileSync(appJsDst, stampedAppJs, 'utf8');
  log(`app.js  복사 완료 (버전 타임스탬프 자동 갱신) -> ${path.relative(ROOT, appJsDst)}`);
  fs.copyFileSync(appCssSrc, appCssDst);
  log(`app.css 복사 완료 -> ${path.relative(ROOT, appCssDst)}`);

  // 2) cert-template.html -> 각 certs/<id>/index.html
  const templatePath = path.join(ENGINE_DIR, 'cert-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  for (const cert of config.certs) {
    let html = template
      .split('{{TITLE_TEXT}}').join(cert.titleText)
      .split('{{MARK}}').join(cert.mark)
      .split('{{SHORT_MARK}}').join(cert.shortMark || cert.mark)
      .split('{{SUB}}').join(cert.sub)
      .split('{{SHORT_SUB}}').join(cert.shortSub || cert.sub)
      .split('{{COUNT}}').join(String(cert.count));

    const outDir = path.join(CERTS_DIR, cert.id);
    if (!fs.existsSync(outDir)) {
      throw new Error(
        `certs/${cert.id} 폴더가 없습니다. data.js를 먼저 추가해주세요.`
      );
    }
    html = addCacheBusting(html, outDir);
    const outPath = path.join(outDir, 'index.html');
    fs.writeFileSync(outPath, html, 'utf8');
    log(`certs/${cert.id}/index.html 생성 완료 (캐시버스팅 적용)`);
  }

  // 3) 허브 자체 정적 파일(index.html, admin.html)도 캐시버스팅 적용
  //    (이 파일들은 engine 템플릿 대상이 아니라 직접 편집하는 파일이라, 내용은 안 건드리고
  //     assets/*.css, assets/*.js 참조 경로에 해시만 갱신한다)
  for (const staticFile of ['index.html', 'admin.html', 'ranking.html']) {
    const filePath = path.join(ROOT, staticFile);
    if (!fs.existsSync(filePath)) continue;
    const original = fs.readFileSync(filePath, 'utf8');
    const updated = addCacheBusting(original, ROOT);
    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8');
      log(`${staticFile} 캐시버스팅 갱신`);
    }
  }

  log('허브 빌드 완료. git status로 변경사항을 확인한 뒤 커밋/푸시하세요.');
}

main();
