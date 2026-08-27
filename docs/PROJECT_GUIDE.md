# 자격증 학습 앱 — 프로젝트 안내 문서

이 문서는 새 대화방/프로젝트에서 이어서 작업할 때, 처음부터 다시 설명하지 않아도
바로 맥락을 파악할 수 있도록 만든 참고 자료입니다. **이 문서를 새 프로젝트의
프로젝트 지식(project knowledge)에 업로드**해두면 Claude가 매번 읽고 작업을 이어갈 수 있습니다.

---

## 1. 전체 구조 (한눈에)

건축기사 실기 등 자격증 시험 대비 학습 앱. **4개의 GitHub 저장소**로 배포됩니다.

| 저장소 | 성격 | 배포 URL | 특징 |
|---|---|---|---|
| `challenge60/do` | 허브 (Supabase 연동, 3개 자격증 통합) | https://challenge60.github.io/do/ | 로그인/클라우드 동기화 O |
| `challenge60/a` | 건축기사 실기 단독형 | https://challenge60.github.io/a/ | 오프라인, 로그인 없음 |
| `challenge60/b` | 방수산업기사 실기 단독형 | https://challenge60.github.io/b/ | 오프라인, 로그인 없음 |
| `challenge60/c` | 산업안전기사 필답형 단독형 | https://challenge60.github.io/c/ | 오프라인, 로그인 없음 |

**중요: 이 4곳은 자동으로 동기화되지 않습니다.** 대신 `challenge60/do` 저장소 안에
**빌드 시스템**이 있어서, 스크립트 한 번 실행으로 4곳 모두에 반영할 수 있습니다.

---

## 2. 기능 수정 시 반드시 여기부터 — "마스터 엔진"

`challenge60/do` 저장소의 **`/engine/` 폴더**가 유일한 단일 소스(source of truth)입니다.

```
challenge60/do (repo)
├── engine/                          ← ⭐ 여기가 마스터. 기능 수정은 항상 여기서.
│   ├── app.js                       ← 학습 엔진 로직 (SRS, 통계, TTS, 뷰 전환 등 전부)
│   ├── app.css                      ← 스타일 전체
│   ├── cert-template.html           ← 허브(do)용 화면 틀 (전체 목록 링크 포함)
│   └── standalone-body-template.html← 단독형(a/b/c)용 화면 틀 (허브 링크 없음)
│
├── build/
│   ├── certs.config.json            ← 자격증별 메타데이터(제목/문항수 등) 설정
│   ├── build-hub.js                 ← engine → do의 assets/, certs/*/index.html 반영
│   ├── build-standalone.js          ← engine + data.js → 단일 HTML 생성 (build/output/)
│   └── output/                      ← build-standalone.js 실행 결과물 (여기서 a/b/c로 복사)
│
├── assets/                          ← build-hub.js가 자동 생성 (직접 수정 X)
│   ├── app.js, app.css              ← engine/에서 복사됨
│   ├── hub.js, hub.css              ← 허브(로그인/목록 화면) 전용 — engine 대상 아님, 별도 수정
│   ├── storage.js                   ← Supabase 클라우드 동기화 (1.2초 debounce)
│   ├── supabase-client.js           ← Supabase 프로젝트 연결 정보
│   └── certs-registry.js            ← 허브 화면에 표시될 자격증 목록
│
└── certs/<id>/
    ├── data.js                      ← 문항 데이터 (CERT_ID, EXAM_CONFIG, UNIT_TAXONOMY,
    │                                    IMAGES, SAMPLE_DATA 정의 — engine과 무관, 직접 관리)
    └── index.html                   ← build-hub.js가 자동 생성 (직접 수정 X)
```

### 수정 워크플로

1. `engine/app.js` 또는 `engine/app.css`에서 기능/디자인 수정
2. 저장소 로컬 클론 후 실행:
   ```bash
   node build/build-hub.js         # do 저장소 반영 (assets/, certs/*/index.html)
   node build/build-standalone.js  # build/output/*.html 생성
   ```
3. `build/output/arch-siljak.html` → `challenge60/a`의 `index.html`로 복사
   `build/output/waterproof-siljak.html` → `challenge60/b`의 `index.html`로 복사
   `build/output/safety-siljak.html` → `challenge60/c`의 `index.html`로 복사
4. 4개 저장소 각각 git commit + push

> Claude에게 "engine/app.js에서 OO 기능 고쳐서 4곳 다 반영해줘"라고 요청하면
> 이 과정 전체를 대신 수행합니다.

### 허브 전용 화면(hub.js, hub.css)은 별도

로그인 화면, 자격증 목록 화면은 `assets/hub.js` / `assets/hub.css`에 있으며
**engine의 빌드 대상이 아닙니다.** (단독형 a/b/c에는 애초에 이 화면이 없기 때문)
허브 로그인/목록 화면만 고칠 땐 `do` 저장소에서 이 파일들을 직접 수정하면 됩니다.

### 새 자격증 추가 시

1. `certs/<새ID>/data.js` 작성 (CERT_ID, EXAM_CONFIG, UNIT_TAXONOMY, IMAGES, SAMPLE_DATA 포함)
2. `build/certs.config.json`에 항목 추가 (id, mark, sub, titleText, count, yearRange, standaloneRepo)
3. `assets/certs-registry.js`에 항목 추가 (허브 화면 카드 노출용)
4. `node build/build-hub.js` 실행 → `certs/<새ID>/index.html` 자동 생성
5. 필요하면 새 단독형 저장소도 만들어서 `build-standalone.js` 결과물 배포

---

## 3. 기술 스택 / 인프라

- **인증**: Supabase 이메일 매직링크/OTP (허브 `do`에만 해당, 단독형엔 없음)
- **클라우드 동기화**: `assets/storage.js`, 1.2초 디바운스로 Supabase에 저장
- **데이터**: 문항은 `certs/<id>/data.js`에 WebP 이미지를 base64로 인라인
- **배포**: GitHub Pages (각 저장소 Settings → Pages, main 브랜치)
- **GitHub Pages URL을 바꾸면**: Supabase 대시보드 → Authentication → URL Configuration에
  새 URL을 등록해야 매직링크 로그인이 정상 작동함

---

## 4. 현재 상태 (기록 시점 기준)

- `challenge60/do` 최신 커밋: `10eaf29` (빌드 시스템 추가)
- 이전에 있었던 중대 버그(모두 수정 완료):
  - `app.css` 맨 앞에 문자열 `<style>`이 잘못 남아 있어 전체 CSS 변수가 무효화되던 문제
  - HTML 조각화 과정에서 남은 닫히지 않은 `<script>` 태그로 페이지 파싱이 깨지던 문제
  - PWA 설치 코드 예외처리 누락으로 이후 스크립트 전체가 죽던 문제
- LS_KEY(로컬스토리지 키)는 이제 **모든 배포본에서 `CERT_ID` 기반으로 통일**됨
  (예전엔 단독형이 `EXAM_CONFIG.markText` 기반이라 허브와 로직이 갈라져 있었음)

---

## 5. GitHub 접근 관련

- 이 작업들은 사용자가 대화 중 GitHub PAT(개인 액세스 토큰)를 제공하면 Claude가
  git clone/commit/push로 직접 처리하는 방식으로 진행되어 왔음
- **PAT는 대화가 끝나면 사라지므로 매번 다시 제공하거나(보안상 사용 후 폐기 권장),**
  **claude.ai → 설정(Settings) → 커넥터(Connectors) → GitHub 연결**을 해두면
  앞으로는 토큰 없이 계정 전체에서 자동으로 GitHub 저장소 접근이 가능해짐
  (모바일 앱에서는 직접 연결이 안 되고, 브라우저로 `claude.ai/settings/connectors`에서 해야 함)

---

## 6. 검증 습관 (중요)

지난 세션들에서 "고쳤다"는 말만 믿고 실제 확인 없이 넘어갔다가 실제로는
버그가 있었던 사례가 여러 번 있었습니다. 앞으로 기능을 수정할 때는:
- Playwright(chromium)로 실제 페이지를 렌더링해서 콘솔 에러, 배경색 등 시각적 요소 확인
- 로컬 정적 서버(Node http 모듈)로 실제 스크립트 로딩 순서까지 재현해서 테스트
- "빌드 성공" 로그만 보고 끝내지 말고, 실제 결과 파일을 열어서든 렌더링해서든 확인

이 습관을 새 대화방에서도 유지해 주세요.
