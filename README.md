# 자격증 학습노트

여러 자격증 문제풀이를 한 곳에서 관리하는 학습 웹앱. GitHub Pages(호스팅) + Supabase(로그인·학습기록 저장) 조합.

> 📘 **새 대화방/프로젝트에서 이어서 작업하시나요?** [`docs/PROJECT_GUIDE.md`](./docs/PROJECT_GUIDE.md) 를 먼저 읽어주세요.
> 4개 저장소(do/a/b/c) 구조, 마스터 엔진(`engine/`) 위치, 빌드 방법이 정리되어 있습니다.

## 폴더 구조

```
index.html              허브 페이지 (로그인 → 자격증 목록)
assets/
  hub.css / hub.js       허브 화면
  app.css / app.js       공통 학습엔진 (모든 자격증이 공유)
  supabase-client.js     Supabase 연결 설정 (URL/anon key)
  certs-registry.js      자격증 목록 — 새 자격증 추가 시 여기에 한 줄 추가
certs/
  arch-siljak/
    index.html           건축기사 실기 학습 페이지
    data.js               문제/이미지 데이터
```

## GitHub Pages에 배포하기

1. 이 폴더 전체를 GitHub 저장소에 커밋·푸시
2. 저장소 **Settings → Pages** → Source를 `main` 브랜치(루트)로 설정
3. 몇 분 후 `https://<아이디>.github.io/<저장소명>/` 에서 접속 가능

## Supabase 설정 마무리 (배포 후 1회)

배포된 실제 주소가 나오면 Supabase 대시보드 **Authentication → URL Configuration**에서:
- **Site URL**: `https://<아이디>.github.io/<저장소명>/`
- **Redirect URLs**에 같은 주소 추가

이걸 해줘야 이메일로 받은 로그인 링크가 실제 사이트로 정확히 돌아옵니다.

## 동작 방식 요약

- 학습 페이지(`certs/*/index.html`)는 로그인이 안 되어 있으면 허브로 돌려보내요 (로그인 후 원래 보던 자격증으로 자동 복귀)
- 로그인하면 `assets/storage.js`가 Supabase의 `user_progress` 테이블에서 그 계정·그 자격증의 학습기록을 불러와 화면에 반영해요
- 이후 문제를 풀 때마다(`saveStore()` 호출 시점) 로컬 저장은 즉시, 클라우드 저장은 1.2초 디바운스 후 자동으로 일어나요
- 화면 하단에 작게 동기화 상태("동기화 중…", "동기화 완료")가 잠깐 표시돼요

## 현재 등록된 자격증

- `arch-siljak` — 건축기사 실기 (1,792문항)
- `waterproof-siljak` — 방수산업기사 실기 (159문항)
- `safety-siljak` — 산업안전기사 필답형 (778문항)

## 새 자격증 추가하는 법 (다음 자격증부터)

1. `certs/<새자격증id>/` 폴더 생성
2. 그 안에 `data.js` (EXAM_CONFIG, UNIT_TAXONOMY, IMAGES, SAMPLE_DATA 형식은 `certs/arch-siljak/data.js` 참고)와 `index.html`(`certs/arch-siljak/index.html` 복사 후 title만 수정) 작성
3. `assets/certs-registry.js`에 새 항목 한 줄 추가

app.js/app.css는 그대로 재사용되므로 새로 만들 필요 없어요.

