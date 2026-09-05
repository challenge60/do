// 자격증 목록 레지스트리.
// 새 자격증을 추가할 때: certs/<id>/data.js, certs/<id>/index.html을 만든 뒤 여기에 한 줄 추가하면
// 허브 화면에 자동으로 카드가 나타납니다.
// shortCode: 짧은 공유 링크(challenge60.github.io/do/?q=<shortCode>-<문항ID>)에 쓰이는 알파벳 1글자.
//            standalone 저장소(challenge60/a, /b, /c)의 알파벳과 맞춰뒀음. 새 자격증 추가 시 겹치지 않게 지정.
const CERTS_REGISTRY = [
  {
    id: "arch-siljak",
    name: "건축기사 실기",
    subtitle: "필답형 · 시공/구조/재료",
    path: "certs/arch-siljak/index.html",
    questionCount: 1792,
    shortCode: "a",
  },
  {
    id: "waterproof-siljak",
    name: "방수산업기사 실기",
    subtitle: "필답형 · 방수시공",
    path: "certs/waterproof-siljak/index.html",
    questionCount: 161,
    shortCode: "b",
  },
  {
    id: "safety-siljak",
    name: "산업안전기사 필답형",
    subtitle: "필답형 · 산업안전",
    path: "certs/safety-siljak/index.html",
    questionCount: 778,
    shortCode: "c",
  },
  {
    id: "ergonomics-pildap",
    name: "인간공학기사 필답",
    subtitle: "필답형 · 인간공학",
    path: "certs/ergonomics-pildap/index.html",
    questionCount: 438,
    shortCode: "e",
  },
  {
    id: "concrete-siljak",
    name: "콘크리트기사 실기",
    subtitle: "필답형 · 콘크리트공사",
    path: "certs/concrete-siljak/index.html",
    questionCount: 214,
    shortCode: "f",
  },
  {
    id: "csafe",
    name: "건설안전기사 실기",
    subtitle: "필답형·작업형 · 건설안전",
    path: "certs/csafe/index.html",
    questionCount: 905,
    shortCode: "g",
    // 결측 3건 보완 + 이미지 추출 작업이 끝날 때까지 준비중으로 노출.
    // 관리자/편집자(profiles.editor_certs에 "csafe" 포함)는 그대로 접근해서 작업 계속 가능.
    status: "coming_soon",
  },
];
