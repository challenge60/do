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

const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(ROOT, 'engine');
const ASSETS_DIR = path.join(ROOT, 'assets');
const CERTS_DIR = path.join(ROOT, 'certs');
const CONFIG_PATH = path.join(ROOT, 'build', 'certs.config.json');

function log(msg) {
  console.log(`[build-hub] ${msg}`);
}

function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // 1) engine -> assets 복사 (app.js, app.css)
  const appJsSrc = path.join(ENGINE_DIR, 'app.js');
  const appCssSrc = path.join(ENGINE_DIR, 'app.css');
  const appJsDst = path.join(ASSETS_DIR, 'app.js');
  const appCssDst = path.join(ASSETS_DIR, 'app.css');

  fs.copyFileSync(appJsSrc, appJsDst);
  log(`app.js  복사 완료 -> ${path.relative(ROOT, appJsDst)}`);
  fs.copyFileSync(appCssSrc, appCssDst);
  log(`app.css 복사 완료 -> ${path.relative(ROOT, appCssDst)}`);

  // 2) cert-template.html -> 각 certs/<id>/index.html
  const templatePath = path.join(ENGINE_DIR, 'cert-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  for (const cert of config.certs) {
    const html = template
      .split('{{TITLE_TEXT}}').join(cert.titleText)
      .split('{{MARK}}').join(cert.mark)
      .split('{{SHORT_MARK}}').join(cert.shortMark || cert.mark)
      .split('{{SUB}}').join(cert.sub)
      .split('{{COUNT}}').join(String(cert.count));

    const outDir = path.join(CERTS_DIR, cert.id);
    if (!fs.existsSync(outDir)) {
      throw new Error(
        `certs/${cert.id} 폴더가 없습니다. data.js를 먼저 추가해주세요.`
      );
    }
    const outPath = path.join(outDir, 'index.html');
    fs.writeFileSync(outPath, html, 'utf8');
    log(`certs/${cert.id}/index.html 생성 완료`);
  }

  log('허브 빌드 완료. git status로 변경사항을 확인한 뒤 커밋/푸시하세요.');
}

main();
