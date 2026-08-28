#!/usr/bin/env node
/**
 * build-standalone.js
 * --------------------
 * "마스터 엔진"(engine/app.js, engine/app.css, engine/standalone-body-template.html)과
 * 각 자격증의 certs/<id>/data.js 를 조합하여, Supabase 없이 동작하는
 * 단일 HTML 파일(오프라인 standalone 배포본)을 생성한다.
 *
 * 사용법:
 *   node build/build-standalone.js
 *
 * 출력 위치:
 *   build/output/<id>.html   (각각 challenge60/a, challenge60/b, challenge60/c 의
 *                              index.html 로 복사해서 커밋하면 됨)
 *
 * 조합 방식:
 *   1. <head> ~ <style> : cert-template.html의 head 메타태그 + engine/app.css를 인라인
 *   2. <body>            : engine/standalone-body-template.html (허브 링크 없는 버전)
 *   3. <script>          : certs/<id>/data.js 내용 + engine/app.js 내용을 하나의
 *                          인라인 스크립트로 합침 (Supabase/스토리지 스크립트는 제외 - 오프라인 앱이므로)
 *
 * 주의:
 *   - LS_KEY는 app.js 안에서 data.js가 정의하는 CERT_ID를 사용하므로
 *     별도 처리 없이 자격증별로 자동으로 분리된다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(ROOT, 'engine');
const CERTS_DIR = path.join(ROOT, 'certs');
const CONFIG_PATH = path.join(ROOT, 'build', 'certs.config.json');
const OUTPUT_DIR = path.join(ROOT, 'build', 'output');

function log(msg) {
  console.log(`[build-standalone] ${msg}`);
}

function buildOne(cert, appCss, appJs, bodyTemplate) {
  const dataJsPath = path.join(CERTS_DIR, cert.id, 'data.js');
  if (!fs.existsSync(dataJsPath)) {
    throw new Error(`certs/${cert.id}/data.js 가 없습니다.`);
  }
  const dataJs = fs.readFileSync(dataJsPath, 'utf8');

  const body = bodyTemplate
    .split('{{MARK}}').join(cert.mark)
    .split('{{SUB}}').join(cert.sub)
    .split('{{SHORT_SUB}}').join(cert.shortSub || cert.sub)
    .split('{{COUNT}}').join(String(cert.count))
    .split('{{YEAR_RANGE}}').join(cert.yearRange || '');

  const inlineScript = [
    '<script>',
    dataJs,
    appJs,
    '</script>',
  ].join('\n');

  const html = [
    '<!DOCTYPE html>',
    '<html lang="ko"><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">',
    '<meta http-equiv="Pragma" content="no-cache">',
    '<meta http-equiv="Expires" content="0">',
    `<title>My도전. ${cert.mark} ${cert.shortSub || cert.sub}</title>`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    `<meta name="apple-mobile-web-app-title" content="${cert.shortMark || cert.mark}노트">`,
    '<meta name="theme-color" content="#243c3d">',
    '<style>',
    appCss,
    '</style>',
    '</head>',
    body,
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>',
    inlineScript,
    '</body></html>',
    '',
  ].join('\n');

  return html;
}

function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const appCss = fs.readFileSync(path.join(ENGINE_DIR, 'app.css'), 'utf8');
  // build-hub.js와 동일하게 빌드 시점 타임스탬프를 APP_VERSION에 자동으로 찍어서,
  // 화면 버전 표시와 "새 버전 나왔어요" 자동 알림 배너가 매 배포마다 정확히 갱신되게 한다.
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}`;
  const appJs = fs.readFileSync(path.join(ENGINE_DIR, 'app.js'), 'utf8')
    .replace(/const APP_VERSION = "[^"]*"/, `const APP_VERSION = "${stamp}"`);
  const bodyTemplate = fs.readFileSync(
    path.join(ENGINE_DIR, 'standalone-body-template.html'),
    'utf8'
  );

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const cert of config.certs) {
    const html = buildOne(cert, appCss, appJs, bodyTemplate);
    const outPath = path.join(OUTPUT_DIR, `${cert.id}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    const sizeMb = (Buffer.byteLength(html, 'utf8') / (1024 * 1024)).toFixed(1);
    log(`${cert.id}.html 생성 완료 (${sizeMb}MB) -> standaloneRepo: ${cert.standaloneRepo}`);
  }

  log('빌드 완료. build/output/<id>.html 파일을 각 standalone repo(a/b/c)의 index.html로 복사해서 커밋하세요.');
}

main();
