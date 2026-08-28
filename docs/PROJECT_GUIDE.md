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
- **Supabase 프로젝트**: `fcxpzpdsqwzwaiwhjzqn` (challenge60's Project, ap-northeast-2)

### Supabase 테이블/함수 목록

| 이름 | 종류 | 용도 |
|---|---|---|
| `user_progress` | 테이블 | 사용자별 학습기록(진도·오답·즐겨찾기·개인 문제수정 등), `store` 객체 그대로 저장 |
| `profiles` | 테이블 | 닉네임, 관심 자격증, 승인여부(`approved`), 등급(`role`) |
| `admins` | 테이블 | 관리자로 지정된 계정의 user_id 목록 (대시보드 접근 등 진짜 관리자 권한) |
| `cert_meta` | 테이블 | 자격증별 총 문항수 (랭킹 진도율 계산용, `certs.config.json`과 값이 같아야 함) |
| `question_overrides` | 테이블 | 관리자/편집자가 고친 문제/정답/이미지 (전체 사용자 공용, cert_id+question_id가 PK) |
| `question_comments` | 테이블 | 오답의견(문제별 공개 댓글) |
| `admin_get_summary()` | RPC | 관리자 전용 — 자격증별 사용자 수·용량 요약 |
| `admin_get_user_stats()` | RPC | 관리자 전용 — 계정별 닉네임·등급·가입일·최근활동·용량 상세 |
| `admin_get_pending_approvals()` | RPC | 관리자 전용 — 승인 대기 중인 가입자 목록 |
| `admin_set_approval(user_id, approved)` | RPC | 관리자 전용 — 가입 승인/거절 처리 |
| `admin_get_commented_questions()` | RPC | 관리자 전용 — 오답의견 달린 문제 목록(최신순) |
| `admin_export_backup()` | RPC | 관리자 전용 — DB 전체를 JSON으로 export |
| `get_rankings()` | RPC | 로그인 사용자 전체 — 3개 자격증 합산 랭킹(풀이수/정답률/진도율/종합) |
| `get_cert_rankings()` | RPC | 로그인 사용자 전체 — 자격증별 전체 순위(풀이수/정답률/진도율) |
| `get_cert_top_rankers()` | RPC | 로그인 사용자 전체 — 자격증별 TOP3만 (허브 카드 표시용) |
| `shorten-url` | Edge Function | 링크 단축 중계(서버 대 서버라 CORS 문제 없음). is.gd→v.gd 순서로 시도, 둘 다 실패하면 원본 링크 반환 |

관리자 전용 RPC들은 모두 `SECURITY DEFINER`로 만들어져 있고, 함수 맨 앞에서
`auth.uid()`가 `admins` 테이블에 있는지 직접 확인해서 관리자가 아니면 예외를 던짐.
**즉 권한 체크가 앱 코드가 아니라 DB 쪽에 있어서**, admin.html 주소를 직접 열어도
관리자가 아니면 데이터가 안 나옴.

---

## 3-1. GitHub Pages 배포 문제 (한 번 실제로 겪었음 — 꼭 읽어볼 것)

**증상**: `main`에 아무리 push해도 라이브 사이트(challenge60.github.io/do/)가 몇 시간~며칠 전
상태에서 전혀 안 바뀜. 캐시 문제인 줄 알고 한참 헤맸으나 실제 원인은 따로 있었음.

**원인**: GitHub 저장소 Settings → Pages → **"Build and deployment" → "Source"**가 어느 시점에
`"Deploy from a branch"`가 아니라 **`"GitHub Actions"`**로 바뀌어 있었음. 이 저장소엔 Actions
워크플로 파일이 없어서, Source가 이렇게 되어 있으면 **아무리 push해도 실제 배포가 전혀 트리거되지 않음**
(과거에 마지막으로 "Deploy from a branch"였을 때 배포된 상태로 영구히 멈춰있게 됨).

**확인 방법**: `https://github.com/challenge60/do/settings/pages`에서 Source 확인.
`main` / `(root)`로 되어 있어야 정상.

API로도 확인 가능 (단, 인증 없인 요청 제한에 잘 걸리므로 PAT로 인증해서 호출 권장):
```bash
curl -s -H "Authorization: token <PAT>" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/challenge60/do/pages"
# source.branch가 "main"인지 확인

curl -s -H "Authorization: token <PAT>" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/challenge60/do/pages/builds/latest"
# commit 필드가 방금 push한 커밋 해시와 같은지, status가 "built"인지 확인
```

**해결**: Source를 "Deploy from a branch"로 되돌리고 branch를 `main`으로 선택 후 저장.
**주의**: 이렇게 설정만 바꿔도 자동으로 재빌드되지 않음 — 새로 커밋 하나를 push해야
그 시점부터 다시 정상적으로 빌드됨 (설정 변경 자체는 재빌드 트리거가 아님).

이 사고 때문에 그날 세션 안에서 수많은 기능(로그인 방식 변경, 관리자 대시보드 등)이
전부 push까지는 됐는데 실제 사이트엔 한참 반영이 안 됐던 적이 있음. **앞으로 "분명 코드는
고쳤는데 실제 화면엔 하나도 안 바뀐다"는 신고가 오면 캐시보다 먼저 이걸 의심할 것.**

---

## 3-2. 캐시 관련 대응 (이미 되어 있음)

- **CSS/JS 파일**: `build-hub.js`의 `addCacheBusting()`이 파일 내용 기반 MD5 해시를
  `?v=xxxxxxxx` 형태로 자동으로 붙여줌. 파일이 바뀌면 해시도 바뀌어서 브라우저가 무조건
  새로 받아감. 사람이 버전을 수동으로 관리할 필요 없음.
- **HTML 문서 자체**: `index.html`, `admin.html`, `ranking.html`, 각 자격증 페이지,
  standalone 배포본 전부에 `Cache-Control: no-cache` 계열 메타태그가 들어있음.
  (메타태그는 실제 HTTP 헤더보다 약하지만, GitHub Pages는 커스텀 헤더 설정을 지원 안 해서
  이게 최선. 그래도 안 바뀌면 하드 리프레시나 캐시 삭제 필요할 수 있음)



## 4. 관리자 시스템 (문제 데이터 수정 & 대시보드)

일반 사용자의 "문제 수정" 기능(연필 아이콘)은 원래 `store.edits`에 저장되어
**그 사람만 보는 개인 오버레이**였음. 여기에 "관리자 수정 → 전체 사용자 기본값" 레이어를
한 단계 추가함.

### 데이터 우선순위 (문제 하나를 화면에 그릴 때)

```
원본(data.js의 SAMPLE_DATA)  <  관리자 수정(question_overrides)  <  내 개인 수정(store.edits)
```

즉 **그 문제를 개인적으로 이미 고친 적이 있는 사용자는 계속 자기 수정본을 봄** — 관리자가
고쳐도 영향받지 않음. 이 문제를 안 고친 사용자에게만 관리자 수정본이 기본값으로 보임.
(엔진에서는 `engine/app.js`의 `getData()` / `withEdits()` / `adminOverrideFor()` 가 이 병합을 처리)

### 관리자 지정 방법

Supabase `admins` 테이블에 그 계정의 `user_id`를 한 줄 추가하면 됨 (그 계정이 한 번이라도
허브에 로그인해서 `auth.users`에 존재해야 함). 예:
```sql
insert into public.admins (user_id)
select id from auth.users where email = '등록할이메일@example.com';
```

### 관리자가 문제를 고치는 흐름

1. 관리자 계정으로 허브(`do`) 로그인 → 평소와 똑같은 편집 UI(연필 아이콘)로 문제/정답/이미지 수정
2. 저장 버튼을 누르면 **개인 수정은 항상 먼저 저장됨** (기존 동작과 동일)
3. 이어서 확인창이 뜸: "이 수정을 이 문제의 기본값으로 적용할까요? (개인적으로 이미 수정한
   사용자는 영향받지 않습니다)" → 확인하면 `question_overrides`에 upsert되어 **즉시 전체 반영**
   (배포/빌드 필요 없음)
4. 단독형(a/b/c)에는 Supabase가 없어서 이 기능이 아예 동작하지 않음(원본 data.js 그대로 표시) —
   관리자 문제 수정은 **허브(do)에서만** 유효함

### 관리자 대시보드 (`admin.html`)

허브에 관리자 계정으로 로그인하면 화면 우측 상단에 **"🛠 관리자"** 버튼이 나타남
(`assets/hub.js`의 `checkIsAdmin()`이 확인). 대시보드에서 볼 수 있는 것:

- 전체 가입자 수, 전체 학습기록 용량
- 자격증별 사용자 수 · 용량
- **계정별 상세 표(용량 많은 순 정렬)**: 이메일, 가입일, 최근 활동일, 사용 중인 자격증, 사용 용량
- **DB 백업 버튼**: 누르면 학습기록·관리자수정·가입자 목록 전체를 JSON 파일로 즉시 다운로드
  (`admin_export_backup()` RPC 호출 → 브라우저가 파일 다운로드, 서버에 별도 저장은 안 함)
- **원본 문제 데이터 백업**: 자격증별 `data.js`(문제·정답·이미지 전부) 개별 다운로드 링크 +
  전체 자격증을 ZIP 하나로 한 번에 받는 버튼 (JSZip 사용, 이미 배포된 정적 파일을 그대로 fetch)
  — Supabase DB 백업과는 별개 항목. `data.js`는 git으로도 버전관리되지만, 클릭 한 번으로
  로컬 사본을 챙길 수 있게 만든 것
- **코드 백업 링크**: 4개 저장소(do/a/b/c) 각각 GitHub ZIP 다운로드 링크
  (코드는 git 커밋마다 이미 버전 관리되고 있지만, 만약을 위한 로컬 사본용)

관련 파일: `admin.html`, `assets/admin.js`, `assets/admin.css`
(engine 빌드 대상 아님 — hub.js/hub.css처럼 `do` 저장소에서 직접 수정)

### 백업 습관 권장

- **DB 백업(학습기록·관리자수정·가입자)**: 대시보드에서 월 1회 정도 JSON 다운로드 받아서
  로컬/클라우드 드라이브에 보관 추천 (Supabase는 git처럼 버전 이력이 없는 살아있는 데이터라,
  여기서만 챙길 수 있는 백업)
- **원본 문제 데이터(data.js)**: 자주는 아니어도 가끔(예: 분기 1회) ZIP으로 받아서 보관 추천
- **코드 백업**: 매 커밋이 곧 백업이지만, GitHub 자체 장애 등 극단적 상황 대비해서
  가끔 ZIP 다운로드로 로컬에 받아두는 것도 나쁘지 않음

---

## 5. PWA 설치 관련 알려진 제약사항 (중요)

**"허브(My도전)나 자격증 중 하나를 설치하면 나머지 설치 버튼이 안 뜨는" 현상은 우리 코드
버그가 아니라 크롬 자체의 알려진 동작입니다.** (참고: web.dev "Build multiple Progressive
Web Apps on the same domain")

같은 origin(`challenge60.github.io`) 안에 범위(scope)가 겹치는 여러 PWA가 있을 때,
그중 하나라도 설치되면 크롬은 그 범위에 포함되는 다른 페이지들을 "이미 설치된 앱의 일부"로
판단해서 `beforeinstallprompt` 이벤트 자체를 더 이상 안 띄웁니다. 우리 앱들은:
- `challenge60.github.io/do/` — 허브(My도전), scope: `/do/` (전체를 아우름)
- `challenge60.github.io/do/certs/<id>/` — 각 자격증, scope: `/do/certs/<id>/` (허브 범위에 포함됨)

이라서, 허브를 먼저 설치하면 그 안에 포함된 자격증 페이지들의 설치 배너가 억제됩니다.

**해결/우회 방법 (코드로 완전히 없앨 수 없는 브라우저 제약이라 안내로 대응)**:
1. **설치 순서 팁**: 범위가 좁은 것(자격증)부터 먼저 설치하고, 범위가 가장 넓은 허브(My도전)를
   맨 마지막에 설치하면 이 문제를 피할 수 있음
2. 자동 배너가 안 뜨면 **브라우저 메뉴(⋮) → "홈 화면에 추가"**로 수동 설치 시도 (자동 배너가
   억제된 상황에서도 대부분 이 경로는 동작함)
3. 설치 버튼 클릭 시 뜨는 안내 문구(`engine/app.js`, `assets/hub.js`의 alert 메시지)에
   이미 이 팁이 포함되어 있음

근본적으로 이 제약을 완전히 없애려면 자격증별로 서로 다른 서브도메인(예: arch.내도메인.com)을
쓰는 방법뿐인데, 이는 GitHub Pages 무료 호스팅 범위를 벗어나 커스텀 도메인 구매·DNS 설정이
필요한 큰 변경이라 당장은 하지 않음.

## 6. 닉네임 · 학습 랭킹 · 오답의견

### 닉네임 (profiles 테이블)
- 이메일은 절대 공개되지 않고, 랭킹/오답의견에는 **닉네임**만 표시됨
- 허브 로그인 후 사용자 정보 줄의 "닉네임 설정하기"에서 등록 (2자 이상, 중복 불가)
- 닉네임을 등록해야 랭킹에 집계됨 (안 하면 랭킹 미참여)

### 학습 랭킹 (ranking.html)
- 3개 자격증을 합산한 지표: **풀이수 / 정답률 / 진도율 / 종합점수** 4개 탭
- 종합점수 = 진도율 50% + 정답률 50%
- `get_rankings()` RPC가 `user_progress.data`(jsonb)에서 `progress`(진도), `solvedTotal`,
  `correctTotal`을 집계함. 진도율 계산에 쓰이는 전체 문항수는 `cert_meta` 테이블에 있음
  — **새 자격증을 추가하거나 문항수가 바뀌면 `cert_meta`도 같이 갱신해야 함**:
  ```sql
  insert into public.cert_meta (cert_id, question_count) values ('새자격증id', 문항수)
  on conflict (cert_id) do update set question_count = excluded.question_count;
  ```

### 오답의견 (question_comments 테이블)
- 문제 화면 툴바의 💬 아이콘 → 그 문제를 보는 모든 로그인 사용자에게 공개되는 댓글판
- 누구나 읽기 가능, 본인 글만 삭제 가능(관리자는 전체 삭제 가능 — 부적절한 글 관리용)
- **허브(do)에서만 동작.** standalone(a/b/c)은 Supabase가 없어서 💬 아이콘 자체가 안 보임
  (`engine/app.js`에서 `typeof supabaseClient !== "undefined"`로 자동 분기됨, 별도 처리 불필요)

## 7. 현재 상태 (기록 시점 기준)

- `challenge60/do` 최신 커밋: `afd4632` (닉네임·랭킹·오답의견 추가)
- 관리자 계정: `smckwz@gmail.com`
- 이전에 있었던 중대 버그(모두 수정 완료):
  - `app.css` 맨 앞에 문자열 `<style>`이 잘못 남아 있어 전체 CSS 변수가 무효화되던 문제
  - HTML 조각화 과정에서 남은 닫히지 않은 `<script>` 태그로 페이지 파싱이 깨지던 문제
  - PWA 설치 코드 예외처리 누락으로 이후 스크립트 전체가 죽던 문제
- LS_KEY(로컬스토리지 키)는 이제 **모든 배포본에서 `CERT_ID` 기반으로 통일**됨
  (예전엔 단독형이 `EXAM_CONFIG.markText` 기반이라 허브와 로직이 갈라져 있었음)

---

## 8. GitHub 접근 관련

- 이 작업들은 사용자가 대화 중 GitHub PAT(개인 액세스 토큰)를 제공하면 Claude가
  git clone/commit/push로 직접 처리하는 방식으로 진행되어 왔음
- **PAT는 대화가 끝나면 사라지므로 매번 다시 제공하거나(보안상 사용 후 폐기 권장),**
  **claude.ai → 설정(Settings) → 커넥터(Connectors) → GitHub 연결**을 해두면
  앞으로는 토큰 없이 계정 전체에서 자동으로 GitHub 저장소 접근이 가능해짐
  (모바일 앱에서는 직접 연결이 안 되고, 브라우저로 `claude.ai/settings/connectors`에서 해야 함)
- Supabase도 마찬가지로 MCP 커넥터(`Supabase:*` 도구)를 통해 테이블/함수를 직접
  만들고 조회할 수 있음 (이번 관리자 시스템도 이 방식으로 구축함)

---

## 9. 검증 습관 (중요)

지난 세션들에서 "고쳤다"는 말만 믿고 실제 확인 없이 넘어갔다가 실제로는
버그가 있었던 사례가 여러 번 있었습니다. 앞으로 기능을 수정할 때는:
- Playwright(chromium)로 실제 페이지를 렌더링해서 콘솔 에러, 배경색 등 시각적 요소 확인
- 로컬 정적 서버(Node http 모듈)로 실제 스크립트 로딩 순서까지 재현해서 테스트
- "빌드 성공" 로그만 보고 끝내지 말고, 실제 결과 파일을 열어서든 렌더링해서든 확인

이 습관을 새 대화방에서도 유지해 주세요.

---

## 10. 이 문서 관리 원칙

**이 문서는 살아있는 문서입니다.** 새로운 기능을 추가하거나 구조를 바꿀 때마다
Claude에게 "이것도 매뉴얼에 반영해줘"라고 요청하면, 이 문서를 최신 상태로
업데이트하고 `challenge60/do` 저장소의 `docs/PROJECT_GUIDE.md`로 다시 커밋·푸시합니다.
문서가 오래돼서 실제 코드와 어긋나면 새 대화방에서 엉뚱한 방향으로 작업할 위험이 있으니,
큰 변경 후에는 꼭 이 문서 업데이트까지 한 세트로 요청해 주세요.

