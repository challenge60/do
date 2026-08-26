// 자격증 목록 레지스트리.
// 새 자격증을 추가할 때: certs/<id>/data.js, certs/<id>/index.html을 만든 뒤 여기에 한 줄 추가하면
// 허브 화면에 자동으로 카드가 나타납니다.
const CERTS_REGISTRY = [
  {
    id: "arch-siljak",
    name: "건축기사 실기",
    subtitle: "필답형 · 시공/구조/재료",
    path: "certs/arch-siljak/index.html",
    questionCount: 1792,
  },
  {
    id: "waterproof-siljak",
    name: "방수산업기사 실기",
    subtitle: "필답형 · 방수시공",
    path: "certs/waterproof-siljak/index.html",
    questionCount: 159,
  },
  {
    id: "safety-siljak",
    name: "산업안전기사 필답형",
    subtitle: "필답형 · 산업안전",
    path: "certs/safety-siljak/index.html",
    questionCount: 778,
  },
];
