
/* ============ 앱 버전 & 출력 파일명 — 절대 누락 금지 ============
   [1] 화면 제목 옆 버전 표시: "버전 번호"가 아니라 "수정 시각 타임스탬프"를 버전처럼 쓴다.
       형식: YY.MM.DD.HH.MM (24시간제, 예: 26.08.07.21.05 = 2026년 8월 7일 21시 05분)
       파일을 새로 수정/생성할 때마다 이 값을 그 시점의 타임스탬프로 반드시 교체할 것.
   [2] 완성본을 내보낼 때 파일명도 반드시 타임스탬프를 포함해야 한다.
       형식: smckwz_건축기사필답노트_YY_MM_DD_HH_MM.html (위 버전 값과 동일한 시각, 언더바 구분)
       두 규칙 다 매번 빠뜨리기 쉬우니 파일을 건드릴 때마다 이 주석부터 확인할 것. */
const APP_VERSION = "26.08.17.21.10";

/* ============ PWA 설치(앱처럼 구동) ============ */
(function(){
  // 1) 아이콘을 캔버스로 즉석 생성 (별도 이미지 파일 없이 매니페스트에 사용)
  function buildIcon(size){
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f3d3e';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#d98e3f';
    ctx.font = 'bold ' + Math.round(size * 0.30) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('건축', size / 2, size * 0.42);
    ctx.font = 'bold ' + Math.round(size * 0.13) + 'px sans-serif';
    ctx.fillStyle = '#f4ede0';
    ctx.fillText('필답노트', size / 2, size * 0.66);
    return c.toDataURL('image/png');
  }

  // 2) 매니페스트를 동적으로 만들어 <head>에 연결 (홈 화면 추가 시 '설치' 로 인식되게 함)
  try{
    const icon192 = buildIcon(192);
    const icon512 = buildIcon(512);
    const manifest = {
      name: "건축기사 실기 필답 노트",
      short_name: "건축기사 필답노트",
      start_url: location.origin + location.pathname + location.search,
      scope: location.origin + location.pathname.replace(/[^/]*$/, ''),
      display: "standalone",
      orientation: "portrait",
      background_color: "#faf7f0",
      theme_color: "#0f3d3e",
      icons: [
        { src: icon192, sizes: "192x192", type: "image/png" },
        { src: icon512, sizes: "512x512", type: "image/png" },
        { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const manifestURL = URL.createObjectURL(manifestBlob);
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if(!manifestLink){
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;
  }catch(e){ /* 매니페스트 생성 실패 시 무시하고 계속 진행 */ }

  // 3) 서비스워커 등록 (설치 조건 보강 + 최소 오프라인 대응)
  if('serviceWorker' in navigator){
    try{
      const swCode = "self.addEventListener('install',e=>self.skipWaiting());" +
                     "self.addEventListener('activate',e=>self.clients.claim());" +
                     "self.addEventListener('fetch',e=>{});";
      const swBlob = new Blob([swCode], { type: 'application/javascript' });
      const swURL = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swURL).catch(()=>{});
    }catch(e){}
  }

  // 4) 설치 버튼 동작
  const installBtn = document.getElementById('installBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let deferredPrompt = null;

  if(installBtn && !isStandalone){
    if(isIOS){
      // iOS Safari는 beforeinstallprompt를 지원하지 않으므로 안내 문구로 대체
      installBtn.style.display = 'flex';
      installBtn.textContent = '📲 홈 화면에 추가';
      installBtn.addEventListener('click', function(){
        alert('Safari 하단 공유 버튼(⬆️)을 누른 뒤\n"홈 화면에 추가"를 선택하면 앱처럼 설치돼요.');
      });
    } else {
      window.addEventListener('beforeinstallprompt', function(e){
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'flex';
      });
      installBtn.addEventListener('click', async function(){
        if(!deferredPrompt) return;
        installBtn.disabled = true;
        deferredPrompt.prompt();
        try{ await deferredPrompt.userChoice; }catch(e){}
        deferredPrompt = null;
        installBtn.style.display = 'none';
        installBtn.disabled = false;
      });
      window.addEventListener('appinstalled', function(){
        installBtn.style.display = 'none';
        deferredPrompt = null;
      });
    }
  }
})();

/* ============ 자격증 설정 ============ */
/* 새 자격증 앱을 만들 때는 이 EXAM_CONFIG와 아래 SAMPLE_DATA만 교체하면 됩니다. */
/* EXAM_CONFIG moved to certs/<cert-id>/data.js — loaded as a global before app.js */


/* ============ 건축기사 실기 기출문제 데이터 (2011~2026, 1,281문항) ============ */
/* IMAGES moved to certs/<cert-id>/data.js — loaded as a global before app.js */

let customImages = {};
/* 사진 여러 장을 그대로 base64로 저장하면 localStorage 용량(약 5~10MB)을 금방 초과해
   "저장 안됨" 현상이 생긴다. 업로드 시 가로/세로 최대 1600px, JPEG 품질 0.82로 리사이즈·재압축해
   1장당 용량을 크게 줄인다. */
/* 이미지 저장 표준 기준(2026.08.07 확정): 최대 변 1000px, WebP, 품질 0.82
   — 새로 추가하는 이미지와 크롭 이미지 모두 이 기준을 따른다. */
const IMAGE_STD_MAXDIM = 1000;
const IMAGE_STD_QUALITY = 0.82;
function compressImageFile(file, maxDim, quality){
  maxDim = maxDim || IMAGE_STD_MAXDIM;
  quality = quality || IMAGE_STD_QUALITY;
  return new Promise((resolve)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try{
          let dataUrl = canvas.toDataURL("image/webp", quality);
          if(!dataUrl.startsWith("data:image/webp")){ dataUrl = canvas.toDataURL("image/jpeg", quality); }
          resolve(dataUrl);
        }catch(e){
          resolve(reader.result); // 압축 실패 시 원본이라도 사용
        }
      };
      img.onerror = ()=> resolve(reader.result);
      img.src = reader.result;
    };
    reader.onerror = ()=> resolve(null);
    reader.readAsDataURL(file);
  });
}
function imgSrc(entry){
  if(!entry) return null;
  if(entry.indexOf('data:')===0) return entry;
  if(customImages[entry]) return customImages[entry];
  if(IMAGES[entry]) return IMAGES[entry];
  return null;
}
function renderImages(images){
  if(!images || !images.length) return '';
  return images.map(entry=>{
    const src = imgSrc(entry);
    return src ? `<img src="${src}" alt="문제 이미지" class="q-image">` : `<span class="missing-img">이미지 누락</span>`;
  }).join('');
}

/* SAMPLE_DATA moved to certs/<cert-id>/data.js — loaded as a global before app.js */


/* ============ 저장소 (localStorage) ============ */
const TAG_GROUP = {"골재": "콘크리트공사", "시멘트": "콘크리트공사", "혼화재": "재료", "AE제": "재료", "방청제": "재료", "감수제": "재료", "유동화제": "재료", "팽창재": "재료", "실리카퓸": "재료", "플라이애시": "재료", "고로슬래그": "재료", "잔골재율": "재료", "물시멘트비": "재료", "슬럼프": "재료", "공기량": "콘크리트공사", "압축강도": "재료", "인장강도": "재료", "흡수율": "재료", "단위중량": "재료", "알칼리골재반응": "재료", "염분함유량": "재료", "방수제": "재료", "방청도료": "재료", "복층유리": "재료", "로이유리": "재료", "강화유리": "재료", "접합유리": "재료", "자기질타일": "재료", "도기질타일": "재료", "화강암": "재료", "대리석": "재료", "테라조": "재료", "인조석": "재료", "실란트": "재료", "코킹": "재료", "단열재": "재료", "방음재": "재료", "방화재": "재료", "내화재료": "재료", "흙막이": "토공사", "어스앵커": "토공사", "시트파일": "토공사", "슬러리월": "토공사", "지하연속벽": "토공사", "언더피닝": "토공사", "보일링": "토공사", "히빙": "토공사", "파이핑": "토공사", "지반개량": "토공사", "웰포인트": "토공사", "샌드드레인": "토공사", "페이퍼드레인": "토공사", "동다짐": "토공사", "그라우팅": "토공사", "약액주입": "토공사", "표준관입시험": "토공사", "베인시험": "토공사", "평판재하시험": "토공사", "지내력시험": "토공사", "프리보링": "토공사", "SIP공법": "토공사", "PHC파일": "토공사", "강관파일": "토공사", "부마찰력": "토공사", "부동침하": "토공사", "동바리": "거푸집공사", "유로폼": "거푸집공사", "갱폼": "거푸집공사", "슬립폼": "거푸집공사", "슬라이딩폼": "거푸집공사", "트래블링폼": "거푸집공사", "콜드조인트": "철근콘크리트공사", "블리딩": "철근콘크리트공사", "레이턴스": "철근콘크리트공사", "크리프": "철근콘크리트공사", "건조수축": "철근콘크리트공사", "중성화": "철근콘크리트공사", "철근이음": "철근콘크리트공사", "겹침이음": "철근콘크리트공사", "가스압접": "철근콘크리트공사", "커플러": "철근콘크리트공사", "정착길이": "철근콘크리트공사", "배근": "철근콘크리트공사", "스터럽": "철근콘크리트공사", "띠철근": "철근콘크리트공사", "재료분리": "콘크리트공사", "균열": "철근콘크리트공사", "철근가공": "철근콘크리트공사", "콘크리트타설": "철근콘크리트공사", "콘크리트헤드": "콘크리트공사", "크리트헤드": "철근콘크리트공사", "화란식쌓기": "조적공사", "불식쌓기": "조적공사", "미식쌓기": "조적공사", "치장줄눈": "조적공사", "통줄눈": "조적공사", "막힌줄눈": "조적공사", "압착공법": "타일공사", "개량압착공법": "타일공사", "밀착공법": "타일공사", "떠붙임공법": "타일공사", "벤토나이트방수": "방수공사", "시멘트액체방수": "방수공사", "결로": "방수공사", "언더컷": "철골공사", "오버랩": "철골공사", "블로홀": "철골공사", "크레이터": "철골공사", "슬래그감싸들기": "철골공사", "토크관리법": "철골공사", "너트회전법": "철골공사", "초음파탐상법": "철골공사", "방사선투과법": "철골공사", "자기분말탐상법": "철골공사", "침투탐상법": "철골공사", "스터드용접": "철골공사", "데크플레이트": "철골공사", "스틱월": "창호및유리공사", "유닛월": "창호및유리공사", "윈도우월": "창호및유리공사", "PERT": "공정관리", "CPM": "공정관리", "주공정선": "공정관리", "여유시간": "공정관리", "자원배당": "공정관리", "간트차트": "공정관리", "파레토도": "품질관리", "특성요인도": "품질관리", "히스토그램": "품질관리", "체크시트": "품질관리", "산점도": "품질관리", "층별": "품질관리", "지명경쟁입찰": "계약제도", "일반경쟁입찰": "계약제도", "실비정산보수가산식": "계약제도", "정액도급": "계약제도", "단가도급": "계약제도", "BLT": "계약제도", "턴키": "계약제도", "성능발주방식": "계약제도", "온통기초": "구조", "독립기초": "구조", "복합기초": "구조", "전단벽": "구조", "내진설계": "구조", "프리스트레스트콘크리트": "구조", "이형철근": "구조", "슬래브": "구조", "캔틸레버": "구조", "반력": "구조역학", "전단력": "구조역학", "휨모멘트": "구조역학", "처짐": "구조역학", "좌굴": "구조역학", "단면2차모멘트": "구조역학", "트러스": "구조역학", "수준측량": "측량", "삼각측량": "측량", "평판측량": "측량", "등고선": "측량", "토탈스테이션": "측량", "GPS측량": "측량", "기초공사": "토공사", "레미콘": "콘크리트공사", "붙이기공법": "타일공사", "혼화재료": "콘크리트공사", "철근물량산출": "철근콘크리트공사", "네트워크공정표": "공정관리", "백화현상": "조적공사", "파이프구조": "철골공사", "벽돌쌓기순서": "조적공사", "공사계약방식": "계약제도", "비계": "가설공사", "타설이음부": "철근콘크리트공사", "VE": "공정관리", "비파괴검사": "철골공사", "피복두께": "철근콘크리트공사", "커튼월": "창호및유리공사", "입찰순서": "계약제도", "슬럼프기준": "콘크리트공사", "하절기콘크리트": "콘크리트공사", "지반개량공법": "토공사", "현장배합": "콘크리트공사", "용접부명칭": "철골공사", "외벽방수": "방수공사", "전단강도": "토공사", "시멘트저장": "콘크리트공사", "철물용어": "금속공사", "영식쌓기": "조적공사", "한중콘크리트": "콘크리트공사", "자원평준화": "공정관리", "도급방식": "계약제도", "진동다짐": "콘크리트공사", "측정기구": "토공사", "보일링현상": "토공사", "PDCA": "품질관리", "횡력보강": "목공사", "콘크리트명칭": "콘크리트공사", "할증률": "적산", "용접결함": "철골공사", "배합설계순서": "콘크리트공사", "벽돌수량": "적산", "철골중량": "적산", "레미콘규격": "콘크리트공사", "커튼월방식": "창호및유리공사", "콘크리트및거푸집량": "적산", "거푸집종류": "거푸집공사", "용접용어": "철골공사", "용접방식": "철골공사", "흙의연경도": "토공사", "샌드드레인공법": "토공사", "레미콘품질검사": "콘크리트공사", "BOT방식": "계약제도", "공간쌓기": "조적공사", "배합설계계산": "콘크리트공사", "창호용어": "창호및유리공사", "EVMS": "공정관리", "벽돌쌓기종류": "조적공사", "시트방수순서": "방수공사", "PS콘크리트": "콘크리트공사", "내화피복공법": "철골공사", "언더피닝공법": "토공사", "분말도시험법": "콘크리트공사", "옥상방수물량": "방수공사", "벽돌수량계산": "적산", "특수콘크리트분류": "콘크리트공사", "바닥돌깔기": "마감공사", "칼럼쇼트닝": "철골공사", "VE추진절차": "공정관리", "수의계약": "계약제도", "강제창호제작순서": "철골공사", "브레인스토밍": "공정관리", "시방서분류": "계약제도", "강관비계부속철물": "가설공사", "CM방식": "계약제도", "유동화콘크리트": "콘크리트공사", "CM계약유형": "계약제도", "줄눈": "콘크리트공사", "조립률": "콘크리트공사", "벽돌소요량": "조적공사", "바깥방수시공순서": "방수공사", "속빈블록치수": "조적공사", "지반탈수공법": "토공사", "TQC 7도구": "시공관리", "독립기초재료량": "적산", "JIT": "시공관리", "측압": "콘크리트공사", "3S시스템": "시공관리", "BOT": "계약제도", "BTO": "계약제도", "지반조사순서": "토공사", "주각부시공순서": "철골공사", "철근간격": "철근콘크리트공사", "거푸집존치기간": "콘크리트공사", "접합방식": "철골공사", "돌붙임시공순서": "석공사", "강판물량산출": "철골공사", "모르타르용도": "미장공사", "CALS": "시공관리", "EC": "시공관리", "LCC": "시공관리", "거푸집역할": "콘크리트공사", "TQC도구": "시공관리", "붙임공법": "타일공사", "VE절차": "시공관리", "줄기초물량산출": "철근콘크리트공사", "트러스철골량산출": "철골공사", "보링": "토공사", "시멘트비중시험": "재료", "조립식공법": "시공관리", "단열재요구조건": "재료", "공사자원분류": "시공관리", "표준품셈": "시공관리", "소운반": "시공관리", "페이퍼조인트": "계약제도", "기준점": "측량", "예민비": "토공사", "성능발주": "계약제도", "CM": "계약제도", "장비": "콘크리트공사", "터파기물량산출": "토공사", "공정관리용어": "시공관리", "TES": "계약제도", "정초식": "시공관리", "상량식": "시공관리", "보강블록구조사춤": "조적공사", "각종Joint": "콘크리트공사", "기초상부고름질": "철골공사", "고력볼트장점": "철골공사", "원가계산기준용어": "시공관리", "기둥공사흐름도": "철골공사", "비계면적산출": "가설공사", "고력볼트등급": "철골공사", "PSC공법순서": "콘크리트공사", "배근가능개수": "철근콘크리트공사"};
const LS_KEY = "arch_exam_app_v1";
function loadStore(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const s = JSON.parse(raw);
      if(!s.edits) s.edits = {};
      if(!("examConfig" in s)) s.examConfig = null;
      if(!s.setRepeats) s.setRepeats = {};
      return s;
    }
  }catch(e){}
  return {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:null, setRepeats:{}};
}
let store = loadStore();
function saveStore(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(store));
    return true;
  }catch(e){
    // localStorage 용량 초과(특히 이미지 여러 장 첨부 시) 등 저장 실패 시 조용히 무시하지 않고 알림
    console.error("저장 실패:", e);
    alert("저장에 실패했습니다. 이미지 용량이 너무 커서 브라우저 저장공간(약 5~10MB)을 초과했을 가능성이 높습니다.\n이미지를 줄이거나 더 작은 이미지로 다시 시도해주세요.");
    return false;
  }
}

/* ============ 단원 체계 (10 대단원 / 소단원) — 건축시공실무 교재 목차 기준 ============ */
/* UNIT_TAXONOMY moved to certs/<cert-id>/data.js — loaded as a global before app.js */

function unitMajorList(){ return UNIT_TAXONOMY.map(u=>u.major); }
function unitMinorsOf(major){ const g = UNIT_TAXONOMY.find(u=>u.major===major); return g ? g.minors : []; }
function majorOfMinor(minor){ const g = UNIT_TAXONOMY.find(u=>u.minors.includes(minor)); return g ? g.major : null; }

function getData(){
  const base = store.customData && store.customData.length ? store.customData : SAMPLE_DATA;
  if(!store.edits || !Object.keys(store.edits).length) return base;
  return base.map(q => store.edits[q.id] ? {...q, ...store.edits[q.id]} : q);
}
function withEdits(q){
  return (q && store.edits && store.edits[q.id]) ? {...q, ...store.edits[q.id]} : q;
}

/* ============ 활성 자격증 설정 적용 (기본 EXAM_CONFIG 또는 가져온 데이터의 examConfig) ============ */
function activeExamConfig(){
  return store.examConfig || EXAM_CONFIG;
}
function applyExamConfig(){
  const cfg = activeExamConfig();
  document.title = cfg.titleText;
  document.querySelector(".brand .mark").textContent = cfg.markText;
  document.querySelector(".brand .sub").textContent = cfg.subtitle;
  const verEl = document.querySelector(".brand .ver");
  if(verEl) verEl.textContent = `Ver. ${APP_VERSION}`;
}

/* ============ 중복 제거 + 빈도 계산 ============ */
function normText(t){ return (t||"").replace(/\s+/g,"").replace(/[.,·、]/g,""); }
/* 리스트 미리보기용: {{img:N}} 표시가 그대로 노출되지 않도록 제거 */
function previewText(t){ return (t||"").replace(/\{\{img:\d+\}\}/g, "").trim(); }

/* ---- 문제/정답 읽어주기 (Web Speech API) ---- */
let ttsVoicesReady = false;
if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged = ()=>{ ttsVoicesReady = true; };
}
function pickKoreanVoice(){
  if(!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find(v=>v.lang==="ko-KR") || voices.find(v=>v.lang&&v.lang.startsWith("ko")) || null;
}
function stripForSpeech(text){
  return (text||"")
    .replace(/\{\{img:\d+\}\}/g, "그림 참고, ")
    .replace(/\s+/g, " ")
    .trim();
}
function speakText(text, btn){
  if(!("speechSynthesis" in window)){
    alert("이 브라우저는 음성 읽기를 지원하지 않습니다.");
    return;
  }
  if(speechSynthesis.speaking){
    speechSynthesis.cancel();
    if(btn){ btn.classList.remove("speaking"); btn.textContent = btn.dataset.label || "🔊 읽어주기"; }
    return;
  }
  const clean = stripForSpeech(text);
  if(!clean) return;
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "ko-KR";
  const v = pickKoreanVoice();
  if(v) utter.voice = v;
  utter.rate = 0.95;
  if(btn){
    btn.dataset.label = btn.textContent;
    btn.classList.add("speaking");
    btn.textContent = "⏹ 읽기 중지";
    utter.onend = ()=>{ btn.classList.remove("speaking"); btn.textContent = btn.dataset.label; };
    utter.onerror = ()=>{ btn.classList.remove("speaking"); btn.textContent = btn.dataset.label; };
  }
  speechSynthesis.speak(utter);
}

/* ============ 수동 중복 지정 (사용자가 직접 연결한 문항) ============ */
function getManualLinks(id){
  const e = store.edits && store.edits[id];
  return (e && Array.isArray(e.manualLinks)) ? e.manualLinks.slice() : [];
}
function setManualLinks(id, links){
  if(!store.edits) store.edits = {};
  if(!store.edits[id]) store.edits[id] = {};
  store.edits[id].manualLinks = links;
  saveStore();
}
function toggleManualLink(idA, idB){
  if(!idA || !idB || idA===idB) return;
  const a = getManualLinks(idA);
  const b = getManualLinks(idB);
  if(a.includes(idB)){
    setManualLinks(idA, a.filter(x=>x!==idB));
    setManualLinks(idB, b.filter(x=>x!==idA));
  }else{
    setManualLinks(idA, [...a, idB]);
    setManualLinks(idB, [...b, idA]);
  }
}
/* 여러 문항을 한 번에 서로 연결(클리크)한다 */
function linkGroup(ids){
  if(!store.edits) store.edits = {};
  ids.forEach(a=>{
    if(!store.edits[a]) store.edits[a] = {};
    if(!Array.isArray(store.edits[a].manualLinks)) store.edits[a].manualLinks = [];
    ids.forEach(b=>{
      if(a!==b && !store.edits[a].manualLinks.includes(b)) store.edits[a].manualLinks.push(b);
    });
  });
  saveStore();
}
/* 특정 문항을 연결된 그룹 전체에서 해제한다 */
function clearManualLinks(id){
  if(!store.edits) store.edits = {};
  const links = getManualLinks(id);
  links.forEach(otherId=>{
    if(store.edits[otherId] && Array.isArray(store.edits[otherId].manualLinks)){
      store.edits[otherId].manualLinks = store.edits[otherId].manualLinks.filter(x=>x!==id);
    }
  });
  if(!store.edits[id]) store.edits[id] = {};
  store.edits[id].manualLinks = [];
  saveStore();
}

/* ============ 자동(텍스트 유사) + 수동 연결을 합친 그룹핑 ============ */
function buildCombinedGroups(data){
  const parent = {};
  const find = x => (parent[x]===x) ? x : (parent[x]=find(parent[x]));
  const union = (a,b) => { const ra=find(a), rb=find(b); if(ra!==rb) parent[ra]=rb; };
  data.forEach(q=> parent[q.id]=q.id);

  const byKey = {};
  data.forEach(q=>{
    const key = normText(q.question).slice(0,40);
    (byKey[key] ||= []).push(q.id);
  });
  Object.values(byKey).forEach(ids=>{ for(let i=1;i<ids.length;i++) union(ids[0], ids[i]); });

  // 완전히 똑같진 않지만(숫자·쉼표·오탈자 등 사소한 표기 차이) 사실상 같은 문제인 경우를 추가로 묶는다.
  // 정규화한 문제 텍스트를 정렬한 뒤 인접한 항목끼리만 비교하므로 1587문항 규모에서도 가볍게 동작한다.
  const normed = data.map(q=>({id:q.id, norm:normText(q.question).slice(0,120)})).sort((a,b)=>
    a.norm < b.norm ? -1 : a.norm > b.norm ? 1 : 0
  );
  const NEAR_DUP_THRESHOLD = 87;
  for(let i=0;i<normed.length-1;i++){
    for(let j=i+1;j<Math.min(i+4, normed.length);j++){
      if(find(normed[i].id) === find(normed[j].id)) continue;
      const a = normed[i].norm, b = normed[j].norm;
      const maxLen = Math.max(a.length, b.length, 1);
      const dist = levenshtein(a, b);
      const s = (1 - dist/maxLen) * 100;
      if(s >= NEAR_DUP_THRESHOLD) union(normed[i].id, normed[j].id);
    }
  }

  const idSet = new Set(data.map(q=>q.id));
  data.forEach(q=>{
    getManualLinks(q.id).forEach(otherId=>{ if(idSet.has(otherId)) union(q.id, otherId); });
  });

  const groups = {};
  data.forEach(q=>{ (groups[find(q.id)] ||= []).push(q); });
  return Object.values(groups);
}

/* 그룹 내에서 가장 최근에 출제된 연도·회차를 구한다 (전역 정렬 기준의 동점자 처리용) */
function latestOccurrence(group){
  let best = group[0];
  group.forEach(x=>{
    const xy = x.year||0, xr = x.round||0;
    const by = best.year||0, br = best.round||0;
    if(xy > by || (xy===by && xr > br)) best = x;
  });
  return best;
}

/* ============ 전역 정렬 기준: 중복 출제빈도 높은 순 → 동일 빈도면 최근 출제 문제 순 ============
   이 기준은 단원별/소단원별/빈도순/전체목록 등 문항 리스트를 보여주는 모든 화면에 공통 적용된다. */
function dedupeWithFrequency(data){
  return buildCombinedGroups(data).map(g=>{
    // 대표로 보여줄 문항은 항상 그룹 내 최신 출제(연도·회차 기준)를 우선한다.
    const base = latestOccurrence(g);
    const years = [...new Set(g.map(x=>x.year))].sort();
    return {...base, frequency:g.length, yearsAppeared:years, latestYear:base.year||0, latestRound:base.round||0};
  }).sort((a,b)=>{
    if(b.frequency !== a.frequency) return b.frequency - a.frequency;
    if(b.latestYear !== a.latestYear) return b.latestYear - a.latestYear;
    return b.latestRound - a.latestRound;
  });
}

/* ============ 문항별 출제빈도 + 최근출제 매핑 (목록 전체는 유지하되 빈도만 표시할 때 사용) ============ */
function questionFrequencyMap(data){
  const map = {};
  buildCombinedGroups(data).forEach(g=>{
    g.forEach(q=> map[q.id] = g.length);
  });
  return map;
}
function questionRecencyMap(data){
  const map = {};
  buildCombinedGroups(data).forEach(g=>{
    const latest = latestOccurrence(g);
    g.forEach(q=> map[q.id] = latest);
  });
  return map;
}

/* ============ 문자열 유사도 (레벤슈타인) ============ */
function levenshtein(a,b){
  a=a||""; b=b||"";
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},()=>new Array(n+1).fill(0));
  for(let i=0;i<=m;i++) dp[i][0]=i;
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
function strSimilarity(a,b){
  const na=normText(a), nb=normText(b);
  if(!na && !nb) return 100;
  const dist = levenshtein(na,nb);
  const maxLen = Math.max(na.length, nb.length,1);
  return Math.max(0, Math.round((1 - dist/maxLen)*100));
}

/* ============ 채점 ============ */
function gradeAnswer(q, userInput){
  if(q.type==="계산형" && typeof q.calcAnswer==="number"){
    const nums = (userInput.match(/-?\d+(\.\d+)?/g)||[]).map(Number);
    if(nums.length===0) return {score:0, keywordHits:[], keywordMiss:q.keywords||[], mode:"calc"};
    const best = nums.reduce((p,c)=> Math.abs(c-q.calcAnswer)<Math.abs(p-q.calcAnswer)?c:p);
    const tolerance = Math.max(0.01, Math.abs(q.calcAnswer)*0.02);
    const diff = Math.abs(best - q.calcAnswer);
    const score = diff<=tolerance ? 100 : Math.max(0, Math.round(100 - (diff/Math.max(Math.abs(q.calcAnswer),1))*100));
    return {score, keywordHits:[], keywordMiss:[], mode:"calc"};
  }
  const kws = q.keywords||[];
  const normInput = normText(userInput);
  const hits = kws.filter(k=> normInput.includes(normText(k)));
  const miss = kws.filter(k=> !hits.includes(k));
  const kwPct = kws.length ? (hits.length/kws.length)*100 : 0;
  const simPct = strSimilarity(userInput, q.answer);
  const score = Math.round(kwPct*0.65 + simPct*0.35);
  return {score, keywordHits:hits, keywordMiss:miss, mode:"text"};
}
function scoreTier(score){
  if(score>=75) return {cls:"good", label:"정답으로 인정"};
  if(score>=40) return {cls:"mid", label:"부분 정답"};
  return {cls:"bad", label:"오답"};
}

/* ============ SRS (Leitner) ============ */
const BOX_INTERVAL_DAYS = [0,1,3,7,14,30,60];
function todayStr(){ return new Date().toISOString().slice(0,10); }
function addDays(dateStr, days){
  const d = new Date(dateStr); d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
/* 다른 메뉴에서 한 번이라도 학습한(store.progress 기록이 있는) 문제 중
   복습 예정일(next)이 오늘이거나 지난 문제만 대상으로 한다.
   단, 현재 오답노트(store.wrong)에 있는 문제는 제외한다 — 오답노트는 맞힐 때까지
   상시 재도전하는 공간이고, 오늘복습은 "이미 맞혀서 익힌 문제를 망각곡선에 맞춰
   장기기억으로 굳히는" 공간으로 역할을 분리한다.
   정렬: ①연체일수(오늘-next, 클수록 잊어버릴 위험이 큼) 내림차순 → ②박스 레벨(낮을수록 취약) 오름차순 */
function getSRSQueue(){
  const t = todayStr();
  const tMs = new Date(t).getTime();
  const qs = getData().filter(q=>{
    const p = store.progress[q.id];
    return p && p.next<=t && !store.wrong[q.id];
  });
  qs.sort((a,b)=>{
    const pa = store.progress[a.id], pb = store.progress[b.id];
    const overdueA = tMs - new Date(pa.next).getTime();
    const overdueB = tMs - new Date(pb.next).getTime();
    if(overdueB !== overdueA) return overdueB - overdueA;
    return pa.box - pb.box;
  });
  return qs;
}
function recordResult(qid, score){
  const p = store.progress[qid] || {box:0, next:todayStr(), history:[]};
  const isGood = score>=75;
  if(isGood){
    p.box = Math.min(p.box+1, BOX_INTERVAL_DAYS.length-1);
  }else{
    p.box = 0;
    store.wrong[qid] = true;
  }
  if(score>=75 && store.wrong[qid]) delete store.wrong[qid];
  p.next = addDays(todayStr(), BOX_INTERVAL_DAYS[p.box]);
  p.history.push({date:todayStr(), score});
  store.progress[qid] = p;

  store.solvedTotal += 1;
  if(isGood) store.correctTotal += 1;

  const last = store.streak.last;
  const t = todayStr();
  if(last !== t){
    if(last === addDays(t,-1)) store.streak.count += 1;
    else store.streak.count = 1;
    store.streak.last = t;
  }
  saveStore();
}
function toggleBookmark(qid){
  if(store.bookmarks[qid]) delete store.bookmarks[qid];
  else store.bookmarks[qid] = true;
  saveStore();
}

/* ============ 상태/렌더 ============ */
let state = { view:"home", queue:[], idx:0, examAnswers:{}, examTimeLeft:0, examTimer:null, unitFilter:null, yearFilter:null, studyMode:"exam", voiceDelay:3 };
let isAdminUnlocked = false;
/* ③ 외부 백업 병합 결과: 용량이 커서(이미지 포함 시 수 MB) localStorage에 저장하지 않고
   이 변수에만 잠시 담아둔다. 새로고침하면 사라지므로, 병합 직후 ④번으로 바로 내보내야 한다. */
let pendingMergedData = null;
const app = document.getElementById("app");

function setView(v){
  if(v !== "card"){
    if("speechSynthesis" in window) speechSynthesis.cancel();
    if(gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    voiceSessionToken++;
    voicePaused = false;
    voicePhase = null;
    releaseWakeLockNow();
  }
  state.view = v;
  document.querySelectorAll("nav.bottom button").forEach(b=>b.classList.toggle("on", b.dataset.view===v));
  const appEl0 = document.getElementById("app");
  if(appEl0) appEl0.scrollTop = 0;
  render();
  if(appEl0) appEl0.scrollTop = 0;
}
document.querySelectorAll("nav.bottom button").forEach(b=>{
  b.addEventListener("click", ()=> setView(b.dataset.view));
});
document.querySelector(".brand").addEventListener("click", ()=> setView("home"));

function headerMeta(){
  const data = getData();
  const years = [...new Set(data.map(d=>d.year))].sort();
  const left = document.getElementById("headerMetaLeft");
  const right = document.getElementById("headerMetaRight");
  if(left) left.textContent = `Ver.${APP_VERSION}`;
  if(right) right.textContent = data.length
    ? `${years[0]}–${years[years.length-1]} (${data.length}문항)`
    : `데이터 없음`;
}

/* ---- 하위 페이지 제목/뒤로가기/우측버튼을 헤더의 page-bar 영역에 표시 ---- */
function setPageBar(title, opts){
  opts = opts || {};
  const bar = document.getElementById("pageBar");
  const metaRow = document.getElementById("metaRow");
  const brand = document.querySelector("header.top .brand");
  const header = document.querySelector("header.top");
  metaRow.style.display = "none";
  brand.style.display = "none";
  header.classList.add("compact");
  bar.style.display = "flex";
  bar.innerHTML = `
    <button class="back-arrow" id="pageBarBack">←</button>
    <h2>${escapeHtml(title)}</h2>
    ${opts.rightHtml || ""}
  `;
  bar.querySelector("#pageBarBack").addEventListener("click", ()=>{
    if(opts.onBack) opts.onBack(); else setView("home");
  });
  if(opts.rightId && opts.rightClick){
    const btn = bar.querySelector("#"+opts.rightId);
    if(btn) btn.addEventListener("click", opts.rightClick);
  }
}
function clearPageBar(){
  const bar = document.getElementById("pageBar");
  const metaRow = document.getElementById("metaRow");
  const brand = document.querySelector("header.top .brand");
  const header = document.querySelector("header.top");
  bar.style.display = "none";
  bar.innerHTML = "";
  metaRow.style.display = "";
  brand.style.display = "";
  header.classList.remove("compact");
}

/* ---- 일자별 문제풀이 개수 · 정답률 집계 (store.progress[*].history 기반) ---- */
function dailyStats(days){
  const map = {};
  Object.values(store.progress || {}).forEach(p=>{
    if(!p || !p.history) return;
    p.history.forEach(h=>{
      if(!h || !h.date) return;
      if(!map[h.date]) map[h.date] = {count:0, correct:0};
      map[h.date].count++;
      if(h.score>=75) map[h.date].correct++;
    });
  });
  const today = new Date();
  const result = [];
  for(let i=days-1;i>=0;i--){
    const d = new Date(today);
    d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const rec = map[key] || {count:0, correct:0};
    const pct = rec.count ? Math.round((rec.correct/rec.count)*100) : null;
    result.push({date:key, count:rec.count, pct, isToday: i===0});
  }
  return result;
}

function daysUntilTarget(dateStr){
  const target = new Date(dateStr+"T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((target-today)/86400000);
}
function ddayHtml(){
  if(!store.targetDate){
    return `🎯 목표일 설정`;
  }
  const d = daysUntilTarget(store.targetDate);
  const label = d===0 ? "D-DAY" : (d>0 ? `D-${d}` : `D+${Math.abs(d)}`);
  return `<b class="dday-badge">${label}</b>`;
}
function openDdayModal(){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>🎯 목표(시험)일 설정</h3>
      <p style="font-size:0.8rem;color:var(--muted);line-height:1.5;margin-top:4px;">시험일을 지정하면 홈 화면 상단에 D-day가 표시돼요.</p>
      <input type="date" id="ddayInput" class="search-box" style="margin-top:14px;" value="${store.targetDate||''}">
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn primary" id="ddaySaveBtn">저장</button>
        <button class="btn" id="ddayClearBtn">삭제</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", close);
  let mouseDownOnOverlay110 = false;
  overlay.addEventListener("mousedown", e=>{ mouseDownOnOverlay110 = (e.target===overlay); });
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay && mouseDownOnOverlay110) close(); mouseDownOnOverlay110 = false; });
  overlay.querySelector("#ddaySaveBtn").addEventListener("click", ()=>{
    const val = overlay.querySelector("#ddayInput").value;
    store.targetDate = val || null;
    saveStore();
    close();
    render();
  });
  overlay.querySelector("#ddayClearBtn").addEventListener("click", ()=>{
    store.targetDate = null;
    saveStore();
    close();
    render();
  });
}

function unitStats(){
  const data = getData();
  const present = new Set(data.map(d=>d.unitMajor));
  const units = unitMajorList().filter(m=>present.has(m));
  return units.map(u=>{
    const qs = data.filter(d=>d.unitMajor===u);
    const solved = qs.filter(q=>store.progress[q.id]).length;
    const correct = qs.filter(q=> store.progress[q.id] && store.progress[q.id].history.slice(-1)[0] && store.progress[q.id].history.slice(-1)[0].score>=75).length;
    const pct = qs.length ? Math.round((correct/qs.length)*100) : 0;
    return {unit:u, total:qs.length, pct};
  });
}

function renderHome(){
  if(!getData().length){
    app.innerHTML = `
      <div class="section-card" style="text-align:center;padding:36px 20px;">
        <div style="font-size:2.2rem;">📭</div>
        <h3 style="margin-top:10px;">아직 문항 데이터가 없어요</h3>
        <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-top:8px;">
          이 앱은 빈 껍데기 상태입니다. 설정에서 자격증 데이터 파일(전체 백업 또는 문제 데이터)을 불러오면 바로 학습을 시작할 수 있어요.
        </p>
        <button class="btn primary" id="goSettingsEmpty" style="margin-top:16px;">⚙️ 설정에서 데이터 불러오기</button>
      </div>
    `;
    app.querySelector("#goSettingsEmpty").addEventListener("click", ()=> setView("settings"));
    return;
  }
  const acc = store.solvedTotal ? Math.round((store.correctTotal/store.solvedTotal)*100) : 0;
  const wrongCount = Object.keys(store.wrong).length;
  const us = unitStats();
  const ds = dailyStats(7);
  const maxCount = Math.max(1, ...ds.map(d=>d.count));
  const dowNames = ["일","월","화","수","목","금","토"];
  const srsCount = getSRSQueue().length;
  app.innerHTML = `
    <div class="home-search-bar">
      <span class="search-ic">🔍</span>
      <input id="homeSearchBox" placeholder="키워드로 문제 검색 (내용/정답)" autocomplete="off">
    </div>
    <div id="homeSearchResults"></div>

    <div class="stat-summary-row" id="statSummaryRow">
      <div class="ss-scroll">
        <span class="ss-item dday-item" id="ddayItem">${ddayHtml()}</span>
        <span class="ss-item"><b>${acc}%</b>정답률</span>
        <span class="ss-item"><b>${store.solvedTotal}</b>풀이</span>
        <span class="ss-item"><b>${wrongCount}</b>오답</span>
        <span class="ss-item">🔥<b>${store.streak.count||0}일</b></span>
        <span class="ss-item">⏰<b>${srsCount}</b>복습</span>
      </div>
      <button class="ss-more" id="statMoreBtn"><span>자세히</span><span class="arrow">▾</span></button>
    </div>
    <div class="stat-detail-wrap" id="statDetailWrap">
      <div class="stat-card" style="margin-top:8px;">
        <div class="daily-stats" style="margin-top:0;padding-top:0;border-top:none;">
          <div class="ds-title">최근 7일 · 일자별 풀이 수 / 정답률</div>
          <div class="ds-bars">
            ${ds.map(d=>{
              const h = d.count ? Math.max(6, Math.round((d.count/maxCount)*40)) : 3;
              const dow = dowNames[new Date(d.date+"T00:00:00").getDay()];
              const tip = `${d.date} · ${d.count}문제${d.pct!==null ? " · 정답률 "+d.pct+"%" : ""}`;
              return `<div class="ds-bar-col" title="${tip}">
                <div class="ds-count">${d.count ? d.count : ""}</div>
                <div class="ds-bar ${d.count?"has-data":""} ${d.isToday?"today":""}" style="height:${h}px"></div>
                <div class="ds-day">${dow}</div>
              </div>`;
            }).join("")}
          </div>
        </div>

        <button class="unit-toggle" id="unitToggleBtn"><span>단원별 정답률 보기</span><span class="arrow">▾</span></button>
        <div class="unit-list-wrap" id="unitListWrap">
          ${us.map(u=>`
            <div class="unit-row">
              <div class="unit-name">${u.unit}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${u.pct}%"></div></div>
              <div class="unit-pct">${u.pct}%</div>
            </div>`).join("")}
        </div>

        <button class="unit-toggle" id="dupStatBtn" style="margin-top:10px;"><span>📊 전체 중복 출제 통계 보기</span><span class="arrow">▸</span></button>

        <button class="reset-link" id="resetBtn">학습기록 초기화</button>
      </div>
    </div>

    <div class="grid" id="homeGrid">
      <button class="tile" data-go="srs"><span class="emoji">⏰</span><span class="t-title">오늘 복습</span><span class="t-desc">${srsCount}문제 · 간격 반복(SRS) 대상</span></button>
      <button class="tile" data-go="year"><span class="emoji">📅</span><span class="t-title">연도별 기출</span><span class="t-desc">연도(회차)별로 그대로 풀기</span></button>
      <button class="tile" data-go="unit"><span class="emoji">📚</span><span class="t-title">단원별 연습</span><span class="t-desc">대단원 선택, 즉시 채점</span></button>
      <button class="tile" data-go="freq"><span class="emoji">📊</span><span class="t-title">빈도순 연습</span><span class="t-desc">중복 제거 후 자주 나온 순</span></button>
      <button class="tile" data-go="exam"><span class="emoji">📝</span><span class="t-title">실전 모의고사</span><span class="t-desc">단원 랜덤 출제, 타이머 후 일괄 채점</span></button>
      <button class="tile" data-go="wrong"><span class="emoji">🔁</span><span class="t-title">오답노트</span><span class="t-desc">${wrongCount ? wrongCount+"문제 대기 중" : "틀린 문제가 없습니다"}</span></button>
      <button class="tile" data-go="bookmark"><span class="emoji">⭐</span><span class="t-title">즐겨찾기</span><span class="t-desc">${Object.keys(store.bookmarks).length}문제 저장됨</span></button>
      <button class="tile" data-go="browse"><span class="emoji">📋</span><span class="t-title">전체 문제 목록</span><span class="t-desc">검색·필터로 문제 찾아보기</span></button>
      <button class="tile wide" data-go="settings"><span class="emoji">⚙️</span><span class="t-title">설정 · 데이터 관리</span><span class="t-desc">기출문제 데이터 추가/교체</span></button>
    </div>
  `;
  app.querySelector("#ddayItem").addEventListener("click", openDdayModal);
  app.querySelector("#statMoreBtn").addEventListener("click", ()=>{
    const wrap = app.querySelector("#statDetailWrap");
    const btn = app.querySelector("#statMoreBtn");
    const open = wrap.classList.toggle("open");
    btn.classList.toggle("open", open);
    btn.querySelector("span").textContent = open ? "접기" : "자세히";
  });
  app.querySelector("#unitToggleBtn").addEventListener("click", ()=>{
    const wrap = app.querySelector("#unitListWrap");
    const btn = app.querySelector("#unitToggleBtn");
    const open = wrap.classList.toggle("open");
    btn.classList.toggle("open", open);
    btn.querySelector("span").textContent = open ? "단원별 정답률 접기" : "단원별 정답률 보기";
  });
  app.querySelector("#dupStatBtn").addEventListener("click", openDupStatModal);
  app.querySelector("#resetBtn").addEventListener("click", ()=>{
    if(confirm("모든 학습기록(정답률, 오답노트, 즐겨찾기, SRS 진행도)을 초기화할까요?")){
      store = {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:store.customData, edits:store.edits, examConfig:store.examConfig, targetDate:store.targetDate};
      saveStore(); render();
    }
  });
  app.querySelectorAll("[data-go]").forEach(b=> b.addEventListener("click", ()=> setView(b.dataset.go)));
  app.querySelector("#homeSearchBox").addEventListener("input", renderHomeSearchResults);
}

/* ---- 메인화면 문제 검색 (동일 형태 문제를 빈도별로 묶어서 표시) ---- */
function renderHomeSearchResults(){
  const box = document.getElementById("homeSearchBox");
  const resultsEl = document.getElementById("homeSearchResults");
  const gridEl = document.getElementById("homeGrid");
  const statRowEl = document.getElementById("statSummaryRow");
  const statDetailEl = document.getElementById("statDetailWrap");
  if(!box || !resultsEl) return;
  const kw = box.value.trim().toLowerCase();
  if(!kw){
    resultsEl.innerHTML = "";
    if(gridEl) gridEl.style.display = "";
    if(statRowEl) statRowEl.style.display = "";
    if(statDetailEl) statDetailEl.style.display = "";
    return;
  }
  if(gridEl) gridEl.style.display = "none";
  if(statRowEl) statRowEl.style.display = "none";
  if(statDetailEl) statDetailEl.style.display = "none";
  const nkw = normText(kw);
  // 동일/유사 형태의 문제를 빈도별로 묶은 뒤 검색어로 필터링
  const grouped = dedupeWithFrequency(getData()).filter(q=>
    (q.question+q.answer+(q.note||"")+" "+(q.tags||[]).join(" ")).toLowerCase().includes(kw) ||
    normText(q.question+q.answer+(q.note||"")).includes(nkw)
  );
  if(!grouped.length){
    resultsEl.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div>검색 결과가 없습니다.</div>`;
    return;
  }
  resultsEl.innerHTML = `
    <div class="section-title">${grouped.length}건 · 동일 형태 문제는 빈출로 묶어 표시</div>
    ${grouped.map(q=>{
      const yrs = (q.yearsAppeared||[q.year]).join(", ");
      return `
      <div class="card-list-item" data-id="${q.id}">
        <div class="row1">
          <span>${q.unitMajor}${q.unitMinor ? " · "+q.unitMinor : ""}</span>
          <span class="stat-pill correct">${freqStars(q.frequency||1)}</span>
        </div>
        <div class="q-preview">${(q.images&&q.images.length) ? "🖼️ " : ""}${escapeHtml(previewText(q.question))}</div>
        <div class="row1" style="margin-top:6px;"><span>출제: ${yrs}년</span></div>
        ${renderTagChips(q)}
      </div>`;
    }).join("")}
  `;
  resultsEl.querySelectorAll(".card-list-item").forEach(el=>{
    el.addEventListener("click", (e)=>{
      const tagTarget = e.target.closest && e.target.closest(".tag-chip[data-tag]");
      if(tagTarget){ openTagBrowse(tagTarget.dataset.tag); return; }
      openCardModal(el.dataset.id);
    });
  });
}

let unitPickerTab = "unit"; // "unit" | "keyword" — 단원별 연습 화면 상단 탭

function renderUnitPicker(){
  const data = getData();
  const dedupedAll = dedupeWithFrequency(data);
  const presentMajors = new Set(data.map(d=>d.unitMajor));
  const presentMinors = new Set(data.map(d=>d.unitMinor).filter(Boolean));
  const majors = unitMajorList().filter(m=>presentMajors.has(m));

  const countFor = (field, value) => dedupedAll.filter(q=>q[field]===value).length;
  // 2회 이상 출제된 키워드만 모두 품질(개수 제한 없음)을 번도순으로
  function topKeywords(field, value){
    const kwFreq = {};
    data.filter(d=>d[field]===value).forEach(d=>(d.tags||[]).forEach(t=> kwFreq[t]=(kwFreq[t]||0)+1));
    return Object.keys(kwFreq).filter(t=>kwFreq[t]>=2).sort((a,b)=>kwFreq[b]-kwFreq[a]).map(t=>[t,kwFreq[t]]);
  }

  setPageBar("단원별 연습");

  const unitTabHtml = majors.map(major=>{
    const minors = unitMinorsOf(major).filter(m=>presentMinors.has(m));
    return `
    <div class="unit-major-block compact">
      <div class="unit-major-title">
        <span>${escapeHtml(major)}</span>
        <span class="major-count">${countFor('unitMajor',major)}문항</span>
      </div>
      <div class="chip-row compact">
        <button class="chip compact major-chip-inline" data-unit="${escapeHtml(major)}">전체${repeatBadgeHtml("unit", major)}</button>
        ${minors.map(m=>`<button class="chip compact" data-unit-minor="${escapeHtml(m)}">${escapeHtml(m)}<small>${countFor('unitMinor',m)}</small>${repeatBadgeHtml("unitMinor", m)}</button>`).join("")}
      </div>
    </div>`;
  }).join("");

  const allMinorsInOrder = majors.flatMap(mj=>unitMinorsOf(mj).filter(m=>presentMinors.has(m)));
  const keywordTabHtml = allMinorsInOrder.map(u=>{
    const kws = topKeywords("unitMinor", u);
    const shown = kws.slice(0,10);
    const rest = kws.slice(10);
    const chipHtml = ([t,c])=>`<span class="tag-chip" data-tag="${escapeHtml(t)}" data-unit-tag="${escapeHtml(u)}" data-unit-tag-field="unitMinor">#${escapeHtml(t)}<b>${c}</b>${repeatBadgeHtml("tag", `#${t}`)}</span>`;
    return `
    <div class="unit-kw-group" data-unit-group="${escapeHtml(u)}">
      <div class="unit-kw-head">
        <span class="unit-kw-name">${escapeHtml(u)}</span>
        <span class="unit-kw-count">${countFor('unitMinor',u)}문항 · 키워드 ${kws.length}개</span>
      </div>
      <div class="unit-kw-chip-wrap">
        ${shown.map(chipHtml).join("") || `<span style="font-size:0.78rem;color:var(--muted);">키워드 정보 없음(2회 이상 출제된 키워드 없음)</span>`}
        ${rest.length ? `<span class="unit-kw-chip-wrap-more" style="display:none;">${rest.map(chipHtml).join("")}</span><button class="kw-more-btn" data-more-toggle="1" data-count="${rest.length}">+${rest.length}개 더보기 ▾</button>` : ""}
      </div>
    </div>`;
  }).join("");

  app.innerHTML = `
    <div class="section-card unit-list">
      <h3>학습할 단원을 선택하세요</h3>
      <div class="unit-level-toggle">
        <button data-tab="unit" class="${unitPickerTab==='unit'?'active':''}">단원별</button>
        <button data-tab="keyword" class="${unitPickerTab==='keyword'?'active':''}">키워드별</button>
      </div>
      ${unitPickerTab === "unit" ? unitTabHtml : `
        <p style="font-size:0.78rem;color:var(--muted);margin:2px 0 10px;">소단원마다 가장 자주 나온 핵심 키워드 상위 10개예요. 키워드를 누르면 관련 문항을 모아 볼 수 있어요.</p>
        <div class="unit-kw-tree">${keywordTabHtml}</div>
      `}
    </div>
  `;

  app.querySelectorAll("[data-tab]").forEach(b=>{
    b.addEventListener("click", ()=>{ unitPickerTab = b.dataset.tab; renderUnitPicker(); });
  });
  app.querySelectorAll("[data-unit]").forEach(b=>{
    b.addEventListener("click", ()=> openModeModal(dedupedAll.filter(q=>q.unitMajor===b.dataset.unit), "unit", b.dataset.unit, "unit"));
  });
  app.querySelectorAll("[data-unit-minor]").forEach(b=>{
    b.addEventListener("click", ()=> openModeModal(dedupedAll.filter(q=>q.unitMinor===b.dataset.unitMinor), "unitMinor", b.dataset.unitMinor, "unit"));
  });
  app.querySelectorAll("[data-more-toggle]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const wrap = btn.previousElementSibling;
      const expanded = wrap.style.display === "contents";
      wrap.style.display = expanded ? "none" : "contents";
      btn.textContent = expanded ? `+${btn.dataset.count}개 더보기 ▾` : `접기 ▴`;
    });
  });
  // 키워드를 탭하면 목록이 아니라 연습/시험/음성학습 선택 메뉴가 띄도록 함
  app.querySelectorAll("[data-unit-tag]").forEach(chip=>{
    chip.addEventListener("click", (e)=>{
      e.stopPropagation();
      const tag = chip.dataset.tag, unit = chip.dataset.unitTag, field = chip.dataset.unitTagField;
      const qs = dedupedAll.filter(q=> q[field]===unit && (q.tags||[]).includes(tag));
      openModeModal(qs, "tag", `#${tag}`, "unit");
    });
  });
}

/* 문제 번호(no) 기준 오름차순 정렬 — "1,2,3...10,11" 처럼 숫자로 비교 (문자열 비교로는 1,10,11...2 순이 되어버리는 문제 방지) */
function sortByNo(list){
  return [...list].sort((a,b)=>{
    const na = String(a.no||""), nb = String(b.no||"");
    const numA = parseInt((na.match(/^\d+/)||["0"])[0], 10);
    const numB = parseInt((nb.match(/^\d+/)||["0"])[0], 10);
    if(numA !== numB) return numA - numB;
    return na.localeCompare(nb);
  });
}

function renderYearPicker(){
  const data = getData();
  const multiRound = datasetHasMultiRound(data);
  const combos = {};
  data.forEach(d=>{
    const key = d.year + "-" + (d.round||1);
    if(!combos[key]) combos[key] = {year:d.year, round:d.round||1, count:0};
    combos[key].count++;
  });
  const comboList = Object.values(combos).sort((a,b)=> b.year-a.year || b.round-a.round);
  setPageBar(multiRound ? "연도·회차별" : "연도별");
  app.innerHTML = `
    <div class="section-card">
      <h3>${multiRound ? "연도·회차를 선택하세요" : "연도를 선택하세요"}</h3>
      <div class="chip-row chip-grid chip-grid-year">${comboList.map(c=>`<button class="chip" data-year="${c.year}" data-round="${c.round}">${c.year}년${multiRound?" "+c.round+"회":""}${repeatBadgeHtml("year", `${c.year}년${multiRound?" "+c.round+"회":""}`)}</button>`).join("")}</div>
    </div>
  `;
  app.querySelectorAll("[data-year]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const y = Number(b.dataset.year), r = Number(b.dataset.round);
      const lbl = `${y}년${multiRound?" "+r+"회":""}`;
      openModeModal(sortByNo(data.filter(q=> q.year===y && (q.round||1)===r)), "year", lbl, "year");
    });
  });
}

function renderWrongList(){
  const wrongQs = getData().filter(q=>store.wrong[q.id]);
  if(!wrongQs.length){
    setPageBar("오답노트");
    app.innerHTML = `<div class="section-card"><div class="empty-note">틀린 문제가 없습니다 🎉</div></div>`;
    return;
  }
  state.studyMode = "exam";
  startQueue(wrongQs, "wrong");
}

function renderBookmarkList(){
  const qs = getData().filter(q=>store.bookmarks[q.id]);
  if(!qs.length){
    setPageBar("즐겨찾기");
    app.innerHTML = `<div class="section-card"><div class="empty-note">즐겨찾기한 문제가 없습니다</div></div>`;
    return;
  }
  state.studyMode = "exam";
  startQueue(qs, "bookmark");
}

function renderSRSList(){
  const qs = getSRSQueue();
  setPageBar("오늘 복습");
  if(!qs.length){
    app.innerHTML = `<div class="section-card"><div class="empty-note">오늘 복습할 문제가 없습니다. 잘하고 있어요!</div></div>`;
    return;
  }
  app.innerHTML = `<div class="section-card"><div class="empty-note">${qs.length}문항을 복습할 준비가 되었어요.</div></div>`;
  openModeModal(qs, "srs", `${qs.length}문항`);
}

function freqStars(freq){
  const stars = "★".repeat(Math.min(freq,5));
  return freq>5 ? `${stars}(${freq}회)` : `${stars} (${freq}회)`;
}

/* ---- 출제 핵심 키워드 태그 클라우드 (빈도별 화면 하단) ---- */
function buildTagCloudEntries(data, limit){
  const freq = {};
  data.forEach(d=>(d.tags||[]).forEach(t=> freq[t]=(freq[t]||0)+1));
  return Object.entries(freq).filter(([,c])=>c>=2).sort((a,b)=>b[1]-a[1]).slice(0, limit||60);
}
function renderTagCloudHtml(entries){
  if(!entries.length) return "";
  const counts = entries.map(e=>e[1]);
  const maxC = Math.max(...counts), minC = Math.min(...counts);
  const sizeFor = c=>{
    if(maxC===minC) return "1.3";
    const t = (c-minC)/(maxC-minC);
    return (0.95 + t*1.35).toFixed(2);
  };
  // 빨강→주황→노랑→초록→파랑→남색→보라 순으로 순위에 따라 색상이 매끄럽게 이어지도록 HSL 그라데이션 적용
  const n = Math.max(entries.length - 1, 1);
  const hueFor = i => Math.round((i / n) * 275); // 0(빨강) ~ 275(보라) 구간을 균등 분배
  return entries.map(([t,c],i)=>`<span class="tag-cloud-item" data-cloud-tag="${escapeHtml(t)}" style="font-size:${sizeFor(c)}rem;color:hsl(${hueFor(i)},72%,42%);">#${escapeHtml(t)}<span class="cnt">${c}</span></span>`).join("");
}

function renderFreqList(){
  const list = dedupeWithFrequency(getData());
  if(!list.length){
    setPageBar("빈도순 연습");
    app.innerHTML = `<div class="section-card"><div class="empty-note">문제가 없습니다</div></div>`;
    return;
  }
  const tiers = {};
  list.forEach(q=>{
    const tier = Math.min(q.frequency, 5);
    (tiers[tier] ||= []).push(q);
  });
  // 1회(★1개) 출제 문제는 최근 출제 문제 순(연도·회차 내림차순)으로 정렬
  if(tiers[1]){
    tiers[1] = tiers[1].slice().sort((a,b)=>{
      if((b.year||0) !== (a.year||0)) return (b.year||0) - (a.year||0);
      return (b.round||0) - (a.round||0);
    });
  }
  const tierKeys = Object.keys(tiers).map(Number).sort((a,b)=> b-a);
  const cloudEntries = buildTagCloudEntries(getData(), 60);
  setPageBar("빈도순 연습");
  app.innerHTML = `
    <div class="section-card">
      <h3>출제 빈도별로 골라 학습하세요</h3>
      <p style="font-size:0.8rem;color:var(--muted);line-height:1.5;">전체 ${getData().length}문항 중 같은 문제 대표 ${list.length}문항을 출제 횟수별로 모았어요. 1회만 출제된 문제(★)는 최근 출제 순으로 정렬됩니다.</p>
      <div class="chip-row chip-grid chip-grid-freq" style="margin-top:10px;">
        <button class="chip" data-tier="all">전체<small>${list.length}문항</small>${repeatBadgeHtml("freq", `전체 ${list.length}문항`)}</button>
        ${tierKeys.map(t=>{
          const lbl = (t===5 ? "★★★★★(5회 이상)" : freqStars(t)) + ` · ${tiers[t].length}문항` + (t===1 ? " · 최근순" : "");
          return `<button class="chip" data-tier="${t}">${t===5 ? "★★★★★ (5회 이상)" : "★".repeat(t)+" ("+t+"회)"}<small>${tiers[t].length}문항</small>${repeatBadgeHtml("freq", lbl)}</button>`;
        }).join("")}
      </div>
    </div>
    ${cloudEntries.length ? `
    <div class="section-card tag-cloud-card">
      <h3>출제 핵심 키워드</h3>
      <p style="font-size:0.78rem;color:var(--muted);">자주 나온 키워드일수록 크게 표시돼요. 키워드를 누르면 관련 문항을 모아 볼 수 있어요.</p>
      <div class="tag-cloud-wrap">${renderTagCloudHtml(cloudEntries)}</div>
    </div>
    ` : ``}
  `;
  app.querySelectorAll("[data-tier]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const t = b.dataset.tier;
      if(t==="all"){ openModeModal(list, "freq", `전체 ${list.length}문항`, "freq"); return; }
      const tier = Number(t);
      const group = tiers[tier];
      const label = (tier===5 ? "★★★★★(5회 이상)" : freqStars(tier)) + ` · ${group.length}문항` + (tier===1 ? " · 최근순" : "");
      openModeModal(group, "freq", label, "freq");
    });
  });
  app.querySelectorAll("[data-cloud-tag]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const tag = el.dataset.cloudTag;
      const qs = list.filter(q=> (q.tags||[]).includes(tag));
      openModeModal(qs, "tag", `#${tag}`, "freq");
    });
  });
}

/* ---- 회차별 중복문제 비율 통계 ---- */
function buildRoundKeysChrono(data){
  const set = new Set();
  data.forEach(q=> set.add(q.year + "-" + (q.round||1)));
  return [...set].sort((a,b)=>{
    const [ay,ar]=a.split("-").map(Number), [by,br]=b.split("-").map(Number);
    return ay-by || ar-br;
  });
}
function roundKeyLabel(key){
  const [y,r] = key.split("-");
  return `${y}년 ${r}회`;
}
function renderRoundOverlapTableHtml(baseKey){
  const data = getData();
  const groups = buildCombinedGroups(data);
  const idToGroup = {};
  groups.forEach((g,gi)=> g.forEach(q=> idToGroup[q.id]=gi));
  const roundKeys = buildRoundKeysChrono(data);
  const byRound = {};
  data.forEach(q=>{ const key = q.year+"-"+(q.round||1); (byRound[key] ||= []).push(q); });
  const startIdx = Math.max(0, roundKeys.indexOf(baseKey));
  let rows = "";
  for(let i=startIdx; i<roundKeys.length; i++){
    const key = roundKeys[i];
    const qs = byRound[key];
    const total = qs.length;
    const prevGroupIds = i>0 ? new Set(byRound[roundKeys[i-1]].map(q=>idToGroup[q.id])) : new Set();
    const allPrevGroupIds = new Set();
    for(let j=0;j<i;j++) byRound[roundKeys[j]].forEach(q=> allPrevGroupIds.add(idToGroup[q.id]));
    const dupPrev = qs.filter(q=> prevGroupIds.has(idToGroup[q.id])).length;
    const dupAll = qs.filter(q=> allPrevGroupIds.has(idToGroup[q.id])).length;
    const pctPrev = total ? Math.round(dupPrev/total*100) : 0;
    const pctAll = total ? Math.round(dupAll/total*100) : 0;
    rows += `<tr>
      <td>${roundKeyLabel(key)}</td>
      <td>${total}</td>
      <td>${dupAll} (${pctAll}%)</td>
      <td>${dupPrev} (${pctPrev}%)</td>
    </tr>`;
  }
  return `
    <table class="round-overlap-table">
      <thead><tr><th>년회차</th><th>출제문항</th><th>누적 중복(%)</th><th>직전회차 중복(%)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ---- 전체기출 대비 중복 출제 비율 ---- */
function renderOverallDupStatHtml(data){
  const groups = buildCombinedGroups(data);
  const total = data.length;
  const uniqueCount = groups.length;
  const dupCount = total - uniqueCount;
  const pct = total ? Math.round(dupCount/total*100) : 0;
  return `
    <div class="overall-dup-box" style="display:flex;align-items:center;gap:14px;padding:12px;background:var(--card2,rgba(255,255,255,0.05));border-radius:12px;">
      <div style="font-size:1.8rem;font-weight:800;color:var(--accent,#4da3ff);white-space:nowrap;">${pct}%</div>
      <div style="font-size:0.82rem;color:var(--muted);line-height:1.5;">
        전체 <b>${total}문항</b> 중 서로 다른 유형(대표 문제)은 <b>${uniqueCount}개</b>예요.<br>
        즉 <b>${dupCount}문항(${pct}%)</b>은 과거 다른 회차에 이미 출제됐던 문제가 형태를 바꿔 다시 나온 중복 출제 문항이에요.
      </div>
    </div>
  `;
}

/* ---- 기준 년도 이전 출제 여부 중복률 ---- */
function buildYearKeysChrono(data){
  const set = new Set();
  data.forEach(q=> set.add(q.year));
  return [...set].sort((a,b)=> a-b);
}
function renderYearDupTableHtml(baseYear){
  const data = getData();
  const groups = buildCombinedGroups(data);
  const idToGroup = {};
  groups.forEach((g,gi)=> g.forEach(q=> idToGroup[q.id]=gi));
  const base = Number(baseYear);
  const preBaseGroupIds = new Set();
  data.forEach(q=>{ if(q.year < base) preBaseGroupIds.add(idToGroup[q.id]); });
  const yearKeys = buildYearKeysChrono(data).filter(y=> y>=base);
  const byYear = {};
  data.forEach(q=>{ (byYear[q.year] ||= []).push(q); });
  let rows = "";
  let totalAll = 0, dupAll = 0;
  yearKeys.forEach(y=>{
    const qs = byYear[y] || [];
    const total = qs.length;
    const dup = qs.filter(q=> preBaseGroupIds.has(idToGroup[q.id])).length;
    const pct = total ? Math.round(dup/total*100) : 0;
    totalAll += total; dupAll += dup;
    rows += `<tr>
      <td>${y}년</td>
      <td>${total}</td>
      <td>${dup} (${pct}%)</td>
    </tr>`;
  });
  const pctAll = totalAll ? Math.round(dupAll/totalAll*100) : 0;
  rows += `<tr style="font-weight:700;">
    <td>${base}년~ 전체</td>
    <td>${totalAll}</td>
    <td>${dupAll} (${pctAll}%)</td>
  </tr>`;
  return `
    <table class="round-overlap-table">
      <thead><tr><th>연도</th><th>출제문항</th><th>${base}년 이전 중복(%)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ---- 전체 중복 출제 통계 모달: 죽어있던 통계 3종(전체 비율/연도별/회차별)을 홈에서 볼 수 있게 연결 ---- */
function openDupStatModal(){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  const data = getData();
  const yearKeys = buildYearKeysChrono(data);
  const roundKeys = buildRoundKeysChrono(data);
  const baseYear = yearKeys[0];
  const baseRoundKey = roundKeys[0];
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:640px;">
      <span class="close-x">✕</span>
      <h3>📊 전체 중복 출제 통계</h3>
      ${renderOverallDupStatHtml(data)}
      <h4 style="margin-top:16px;font-size:0.88rem;">연도별 중복 출제 비율 (${baseYear}년 이전 출제 기준)</h4>
      <div style="max-height:220px;overflow-y:auto;">${renderYearDupTableHtml(baseYear)}</div>
      <h4 style="margin-top:16px;font-size:0.88rem;">회차별 중복 출제 비율</h4>
      <div style="max-height:220px;overflow-y:auto;">${renderRoundOverlapTableHtml(baseRoundKey)}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".close-x").addEventListener("click", ()=> overlay.remove());
}

/* ---- 플래시카드 큐 ---- */
function queueSessionKey(mode, label){ return mode + "::" + (label||""); }

/* ---- 연습모드 / 시험모드 선택 ---- */
function openModeModal(list, mode, label, returnView){
  if(!list.length){ setView(returnView || "home"); return; }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>학습 방식을 선택하세요</h3>
      <div class="mode-choice-row">
        <button class="btn primary" id="modePractice">📖 연습모드<small>문제와 정답을 처음부터 함께 보며 학습해요</small></button>
        <button class="btn ghost" id="modeExam">📝 시험모드<small>정답을 가리고 먼저 풀어본 뒤 확인해요 (기존 방식)</small></button>
        <button class="btn ghost" id="modeVoice">🔊 음성학습모드<small>문제를 읽고 잠시 후 정답을 읽어준 뒤, 자동으로 다음 문제로 넘어가요 (대기시간은 화면에서 1~10초로 조절 가능)</small></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#modePractice").addEventListener("click", ()=>{
    state.studyMode = "practice"; close(); startQueue(list, mode, label, returnView);
  });
  overlay.querySelector("#modeExam").addEventListener("click", ()=>{
    state.studyMode = "exam"; close(); startQueue(list, mode, label, returnView);
  });
  overlay.querySelector("#modeVoice").addEventListener("click", ()=>{
    state.studyMode = "voice"; close(); startQueue(list, mode, label, returnView);
  });
}

function startQueue(list, mode, label, returnView){
  if(!list.length){ setView(returnView || "home"); return; }
  state.returnView = returnView || null;
  const key = queueSessionKey(mode, label);
  const sess = store.session && store.session[key];
  let startIdx = 0;
  if(sess && sess.total === list.length && sess.idx > 0 && sess.idx < list.length - 1){
    const resume = confirm(`이 세트는 ${sess.idx+1}번째 문항까지 학습했어요.\n\n확인: 이어서 하기\n취소: 처음부터 하기`);
    if(resume) startIdx = sess.idx;
  }
  state.queue = list;
  state.idx = startIdx;
  state.mode = mode;
  state.modeLabel = label || "";
  state.view = "card";
  renderCard();
}

/* ---- 회독수(반복 학습 횟수): 연도별/단원별/빈도순/키워드별 세트를 끝까지 정상적으로 다 보면 1 증가 ---- */
function recordQueueCompletion(){
  if(!["year","unit","unitMinor","freq","tag"].includes(state.mode)) return;
  if(!store.setRepeats) store.setRepeats = {};
  const key = queueSessionKey(state.mode, state.modeLabel);
  store.setRepeats[key] = (store.setRepeats[key]||0) + 1;
  saveStore();
}
const REPEAT_COLORS = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#3498db","#9b59b6","#8e44ad"];
function repeatBadgeHtml(mode, label){
  if(!store.setRepeats) return "";
  const n = store.setRepeats[queueSessionKey(mode, label)] || 0;
  if(!n) return "";
  const color = REPEAT_COLORS[(n-1)%REPEAT_COLORS.length];
  return `<span class="repeat-badge" style="background:${color}" title="${n}회독 완료">${n}</span>`;
}

function saveQueueSession(){
  if(!store.session) store.session = {};
  store.session[queueSessionKey(state.mode, state.modeLabel)] = {idx: state.idx, total: state.queue.length};
  saveStore();
}

function questionAccuracy(qid){
  const p = store.progress[qid];
  if(!p || !p.history || !p.history.length) return null;
  const correct = p.history.filter(h=>h.score>=75).length;
  return Math.round((correct/p.history.length)*100);
}

function renderCard(){
  const q = withEdits(state.queue[state.idx]);
  const allData = getData();
  const multiRound = datasetHasMultiRound(allData);
  const dupYears = buildDuplicateIndex(allData)[q.id];
  const mainLabel = yearRoundLabel(q, multiRound);
  // 연도-회차-문항번호 (배점) 형식으로 한 태그에 합쳐서 표시. 예: 22-2-20 (4)
  const combinedTag = `<span class="tag freq">${mainLabel}${q.no?`-${q.no}`:""}${q.points?` (${q.points})`:""}</span>`;
  const acc = questionAccuracy(q.id);
  const accTag = acc!==null ? `<span class="tag acc ${acc<50?'low':''}">정답률 ${acc}%</span>` : "";
  // 별점 + 실제 출제 연도-회차 목록(최신순)을 하나의 태그로 합쳐서 표시. 예: ★★★( 22-2,18-1,11-1 )
  const starDupTag = (dupYears && dupYears.length>1) ? (()=>{
    const sorted = [...dupYears].sort((a,b)=>{
      const [ay,ar] = a.split("-").map(Number);
      const [by,br] = b.split("-").map(Number);
      if(by!==ay) return by-ay;
      return (br||1)-(ar||1);
    });
    const stars = "★".repeat(Math.min(sorted.length,5));
    return `<span class="tag star-freq">${stars}( ${sorted.join(",")} )</span>`;
  })() : "";
  const titleLabel = state.modeLabel ? `${modeTitle(state.mode)} · ${state.modeLabel}` : modeTitle(state.mode);
  const isPractice = state.studyMode === "practice";
  const isVoice = state.studyMode === "voice";
  const modeTag = isVoice ? `<span class="tag mode">🔊 음성학습모드</span>` : (["unit","unitMinor","year","freq"].includes(state.mode) ? `<span class="tag mode">${isPractice ? "📖 연습모드" : "📝 시험모드"}</span>` : "");
  setPageBar(titleLabel, {
    rightHtml: `<button class="pdf-mini" id="pdfBtn" title="현재 세트 PDF로 저장">🖨 PDF</button>`,
    rightId: "pdfBtn",
    rightClick: ()=> exportListToPDF(state.queue, titleLabel, state.studyMode === "exam"),
    // 연도별·단원별·빈도순 목록에서 들어온 경우 홈이 아니라 해당 목록 화면으로 돌아간다
    onBack: ()=>{ saveQueueSession(); setView(state.returnView || (state.mode==="unitMinor" ? "unit" : (["unit","year","freq"].includes(state.mode) ? state.mode : "home"))); }
  });
  app.innerHTML = `
    <div class="meta-row">
      <div class="tag-row" style="margin-bottom:0;">
        <select class="tag idx idx-select" id="idxSelect" title="문항 번호를 선택해서 바로 이동">
          ${state.queue.map((_,i)=>`<option value="${i}" ${i===state.idx?'selected':''}>${i+1}/${state.queue.length}</option>`).join("")}
        </select>
        ${modeTag}
        ${combinedTag}
        ${starDupTag}
        ${accTag}
      </div>
    </div>
    <div class="card-box" id="cardBox">
      ${renderTextWithImages(q.question, q.images, q.answer)}
      <div id="answerSlot"></div>
      <textarea class="ans-input" id="ansInput" placeholder="여기에 답을 입력해보세요 (생략 가능)"></textarea>
      <div id="gradeSlot"></div>
      <div class="btn-row util-row">
        <button class="btn ghost" id="starBtn">☆ 즐겨찾기</button>
        <button class="btn ghost" id="editBtn">✏️ 수정</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="prevBtn">← 이전</button>
        <button class="btn primary" id="revealBtn">정답보기</button>
        <button class="btn ghost" id="nextBtn">다음 문제 →</button>
      </div>
      ${isVoice ? `
      <div class="voice-controls" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:4px;">
          정답까지 대기시간: <b id="voiceDelayVal">${state.voiceDelay}</b>초
        </label>
        <input type="range" id="voiceDelayRange" min="1" max="10" step="1" value="${state.voiceDelay}" style="width:100%;">
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn ghost" id="voicePauseBtn">⏸ 일시정지</button>
          <button class="btn danger" id="voiceCancelBtn" disabled>✕ 취소(수동 전환)</button>
        </div>
      </div>` : ""}
      <div class="swipe-hint">← 오른쪽으로 밀면 이전 · 왼쪽으로 밀면 다음 → · 문제 영역을 탭하면 정답 확인</div>
    </div>
  `;
  document.getElementById("prevBtn").addEventListener("click", ()=> goToCard(state.idx-1));
  document.getElementById("nextBtn").addEventListener("click", ()=> goToCard(state.idx+1));
  document.getElementById("idxSelect").addEventListener("change", (e)=> goToCard(Number(e.target.value)));
  document.getElementById("revealBtn").addEventListener("click", ()=> revealAnswer(q));
  document.getElementById("editBtn").addEventListener("click", ()=> openEditModal(q.id, ()=> renderCard()));
  const starBtnEl = document.getElementById("starBtn");
  const refreshStarBtn = ()=>{
    const on = !!store.bookmarks[q.id];
    starBtnEl.classList.toggle("active", on);
    starBtnEl.textContent = on ? "★ 즐겨찾기됨" : "☆ 즐겨찾기";
  };
  refreshStarBtn();
  starBtnEl.addEventListener("click", ()=>{ toggleBookmark(q.id); refreshStarBtn(); });
  if(isVoice){
    const delayRange = document.getElementById("voiceDelayRange");
    const delayVal = document.getElementById("voiceDelayVal");
    delayRange.addEventListener("input", ()=>{
      state.voiceDelay = parseInt(delayRange.value, 10);
      delayVal.textContent = state.voiceDelay;
    });
    document.getElementById("voicePauseBtn").addEventListener("click", ()=>{
      if(voicePaused) resumeVoiceStudy(); else pauseVoiceStudy();
    });
    document.getElementById("voiceCancelBtn").addEventListener("click", cancelVoiceStudy);
  }
  const ta = document.getElementById("ansInput");
  ta.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.ctrlKey) revealAnswer(q); });
  attachCardGestures("cardBox",
    (e)=>{
      const t = e.target;
      if(t.closest && t.closest("button,textarea,input,.mini-btn")) return;
      if(t.tagName === "IMG"){ openImageZoom(t.src); return; }
      revealAnswer(q);
    },
    ()=>{ if(state.idx < state.queue.length-1) goToCard(state.idx+1); else { recordQueueCompletion(); saveQueueSession(); snapBack(document.getElementById("cardBox")); alert("이번 세트 학습을 완료했습니다!"); setView(state.returnView || (state.mode==="unitMinor" ? "unit" : (["unit","year","freq"].includes(state.mode) ? state.mode : "home"))); } },
    ()=>{ if(state.idx > 0) goToCard(state.idx-1); else snapBack(document.getElementById("cardBox")); }
  );
  playCardEnterAnimation("cardBox");
  voiceSessionToken++;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  if(gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
  voicePaused = false;
  voicePhase = null;
  if(state.studyMode === "practice"){
    revealAnswer(q);
  } else if(state.studyMode === "voice"){
    acquireWakeLock();
    runVoiceStudy(q, voiceSessionToken);
  }
}

/* ---- 음성학습모드: 문제 읽기 → 대기시간 후 정답 읽기 → 2초 후 자동 다음 문제 (일시정지/이어서/취소 지원) ---- */
let voiceSessionToken = 0;
let voicePaused = false;
let voicePhase = null; // 'question' | 'gapAnswer' | 'answer' | 'gapNext'
let gapTimer = null;
let gapRemaining = 0;
let gapStart = 0;
let gapOnDone = null;
let wakeLock = null;
let noSleepVideo = null;
let noSleepActive = false;

/* ---- 화면 절전 방지: 우선 Wake Lock API 시도, 실패(예: https가 아닌 content:// 로컬 파일 등 보안 컨텍스트가 아닌 경우)하면
   무음 반복 영상 재생 트릭(NoSleep 방식)으로 대체한다 ---- */
function ensureNoSleepVideo(){
  if(noSleepVideo) return noSleepVideo;
  const v = document.createElement("video");
  v.setAttribute("muted", "");
  v.muted = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "");
  v.loop = true;
  v.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
  const source = document.createElement("source");
  source.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMXbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAkF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAIAAAACAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAG5bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABZG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAIAAgBIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAK/+EAGWdkAAqs2V+IiMBEAAADAAQAAAMACDxIllgBAAZo6+PLIsD9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAFigAABYoAAAAGHN0dHMAAAAAAAAAAQAAAAEAAEAAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAA0cAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAACzW1kYXQAAAKtBgX//6ncRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAABBliIQAFf/+98nvwKbr29+B";
  source.type = "video/mp4";
  v.appendChild(source);
  document.body.appendChild(v);
  // 일부 브라우저/OS가 백그라운드 최적화 등으로 재생을 임의로 멈추는 경우, 음성학습이 아직
  // 진행 중이면 즉시 다시 재생을 시도해 화면 잠김 방지 효과가 끊기지 않도록 한다.
  v.addEventListener("pause", ()=>{
    if(noSleepActive && state.view === "card" && state.studyMode === "voice" && !voicePaused){
      const p = v.play();
      if(p && p.catch) p.catch(()=>{});
    }
  });
  noSleepVideo = v;
  return v;
}
function startNoSleepFallback(){
  const v = ensureNoSleepVideo();
  const p = v.play();
  if(p && p.catch) p.catch(()=>{ /* 자동재생이 막힌 환경 - 무시 */ });
  noSleepActive = true;
}
function stopNoSleepFallback(){
  if(noSleepVideo){ try{ noSleepVideo.pause(); }catch(e){} }
  noSleepActive = false;
}
async function acquireWakeLock(){
  try{
    if("wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", ()=>{
        wakeLock = null;
        // 시스템에 의해 잠금이 풀린 경우(예: 백그라운드 전환) 음성학습이 계속 진행 중이면 대체 방식으로 전환
        if(state.view === "card" && state.studyMode === "voice" && !voicePaused && document.visibilityState === "visible"){
          startNoSleepFallback();
        }
      });
      return;
    }
  }catch(e){ /* Wake Lock API 요청 실패 - 아래 대체 방식으로 전환 */ }
  startNoSleepFallback();
}
function releaseWakeLockNow(){
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock = null; }
  stopNoSleepFallback();
}
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState === "visible" && state.view === "card" && state.studyMode === "voice" && !voicePaused){
    acquireWakeLock();
  }
});

let speakToken = 0;
let lastSpeakText = null;
let lastSpeakCallback = null;
function speakOnce(text, callback){
  if(!("speechSynthesis" in window)){ if(callback) callback(); return; }
  const clean = stripForSpeech(text);
  if(!clean){ if(callback) callback(); return; }
  const myToken = ++speakToken;
  lastSpeakText = text;
  lastSpeakCallback = callback;
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "ko-KR";
  const v = pickKoreanVoice();
  if(v) utter.voice = v;
  utter.rate = 0.95;
  utter.onend = ()=> { if(myToken===speakToken && callback) callback(); };
  utter.onerror = ()=> { if(myToken===speakToken && callback) callback(); };
  speechSynthesis.speak(utter);
}
function startGap(ms, onDone){
  voicePhase = "gap";
  gapRemaining = ms;
  gapStart = Date.now();
  gapOnDone = onDone;
  gapTimer = setTimeout(()=>{ gapTimer = null; onDone(); }, ms);
}
function runVoiceStudy(q, session){
  if(session !== voiceSessionToken) return;
  voicePhase = "question";
  speakOnce(q.question, ()=>{
    if(session !== voiceSessionToken) return;
    startGap(state.voiceDelay*1000, ()=>{
      if(session !== voiceSessionToken) return;
      revealAnswer(q);
      voicePhase = "answer";
      speakOnce(q.answer, ()=>{
        if(session !== voiceSessionToken) return;
        startGap(2000, ()=>{
          if(session !== voiceSessionToken) return;
          advanceVoiceStudy();
        });
      });
    });
  });
}
/* ---- 다음 세트 계산: 연도별/단원별/빈도순 학습을 다 마쳤을 때 이어서 넘어갈 다음 세트를 찾는다.
   태그(키워드)별 학습처럼 뒤이을 순서가 정해져 있지 않은 경우엔 null을 반환한다. ---- */
function getNextStudySet(){
  const data = getData();
  if(state.mode === "year"){
    const cur = state.queue[0];
    if(!cur) return null;
    const multiRound = datasetHasMultiRound(data);
    const combos = {};
    data.forEach(d=>{ const k = d.year+"-"+(d.round||1); if(!combos[k]) combos[k] = {year:d.year, round:d.round||1}; });
    const comboList = Object.values(combos).sort((a,b)=> b.year-a.year || b.round-a.round);
    const curKey = cur.year+"-"+(cur.round||1);
    const idx = comboList.findIndex(c=> (c.year+"-"+c.round)===curKey);
    if(idx<0 || idx>=comboList.length-1) return null;
    const nx = comboList[idx+1];
    const lbl = `${nx.year}년${multiRound?" "+nx.round+"회":""}`;
    return { list: sortByNo(data.filter(q=>q.year===nx.year && (q.round||1)===nx.round)), mode:"year", label:lbl, returnView:"year" };
  }
  if(state.mode === "unit" || state.mode === "unitMinor"){
    const majors = unitMajorList().filter(mj=> data.some(q=>q.unitMajor===mj));
    if(state.mode === "unit"){
      const idx = majors.indexOf(state.modeLabel);
      if(idx<0 || idx>=majors.length-1) return null;
      const nx = majors[idx+1];
      return { list: dedupeWithFrequency(data.filter(q=>q.unitMajor===nx)), mode:"unit", label:nx, returnView:"unit" };
    } else {
      const allMinors = majors.flatMap(mj=>unitMinorsOf(mj).filter(m=>data.some(q=>q.unitMinor===m)));
      const idx = allMinors.indexOf(state.modeLabel);
      if(idx<0 || idx>=allMinors.length-1) return null;
      const nx = allMinors[idx+1];
      return { list: dedupeWithFrequency(data.filter(q=>q.unitMinor===nx)), mode:"unitMinor", label:nx, returnView:"unit" };
    }
  }
  if(state.mode === "freq"){
    const cur = state.queue[0];
    if(!cur || cur.frequency==null) return null;
    const tier = Math.min(cur.frequency,5);
    if(tier<=1) return null;
    const nextTier = tier-1;
    const list = dedupeWithFrequency(data);
    let g = list.filter(q=>Math.min(q.frequency,5)===nextTier);
    if(!g.length) return null;
    if(nextTier===1){
      g = g.slice().sort((a,b)=>{ if((b.year||0)!==(a.year||0)) return (b.year||0)-(a.year||0); return (b.round||0)-(a.round||0); });
    }
    const lbl = (nextTier===5 ? "★★★★★(5회 이상)" : freqStars(nextTier)) + ` · ${g.length}문항` + (nextTier===1 ? " · 최근순" : "");
    return { list:g, mode:"freq", label:lbl, returnView:"freq" };
  }
  return null;
}
function backToListView(){
  state.studyMode = "practice";
  setView(state.returnView || (state.mode==="unitMinor" ? "unit" : (["unit","year","freq"].includes(state.mode) ? state.mode : "home")));
}
function showVoiceCompletionModal(){
  const next = getNextStudySet();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>이번 세트를 모두 들었습니다</h3>
      <div class="mode-choice-row">
        <button class="btn ghost" id="voiceDoneList">📋 목록으로</button>
        <button class="btn ghost" id="voiceDoneRepeat">🔁 처음부터 반복</button>
        ${next ? `<button class="btn primary" id="voiceDoneNext">⏭ 다음으로 (${next.label})</button>` : ""}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", ()=>{ close(); backToListView(); });
  overlay.querySelector("#voiceDoneList").addEventListener("click", ()=>{ close(); backToListView(); });
  overlay.querySelector("#voiceDoneRepeat").addEventListener("click", ()=>{
    close(); state.idx = 0; renderCard();
  });
  if(next){
    overlay.querySelector("#voiceDoneNext").addEventListener("click", ()=>{
      close(); startQueue(next.list, next.mode, next.label, next.returnView);
    });
  }
}
function advanceVoiceStudy(){
  if(state.idx < state.queue.length - 1){
    goToCard(state.idx+1);
  } else {
    recordQueueCompletion();
    saveQueueSession();
    releaseWakeLockNow();
    showVoiceCompletionModal();
  }
}
/* ---- 일시정지: 그 자리에서 멈춤 (재생 위치는 유지, 다음 이어서 버튼으로 재개) ---- */
function pauseVoiceStudy(){
  if(state.studyMode !== "voice" || voicePaused) return;
  voicePaused = true;
  if(voicePhase === "question" || voicePhase === "answer"){
    // speechSynthesis.pause()/resume()는 모바일 브라우저(특히 안드로이드 WebView)에서 재개가
    // 안 되는 경우가 많아, 대신 현재 발화를 취소하고 재개 시 처음부터 다시 읽어준다.
    speakToken++; // 취소로 발생하는 onend/onerror가 다음 단계로 잘못 진행되지 않도록 무효화
    if("speechSynthesis" in window) speechSynthesis.cancel();
  } else if(voicePhase === "gap" && gapTimer){
    clearTimeout(gapTimer);
    gapTimer = null;
    gapRemaining = Math.max(0, gapRemaining - (Date.now()-gapStart));
  }
  releaseWakeLockNow();
  updateVoiceControlsUI();
}
function resumeVoiceStudy(){
  if(state.studyMode !== "voice" || !voicePaused) return;
  voicePaused = false;
  if(voicePhase === "question" || voicePhase === "answer"){
    if("speechSynthesis" in window && lastSpeakText) speakOnce(lastSpeakText, lastSpeakCallback);
  } else if(voicePhase === "gap"){
    gapStart = Date.now();
    gapTimer = setTimeout(()=>{ gapTimer = null; if(gapOnDone) gapOnDone(); }, gapRemaining);
  }
  acquireWakeLock();
  updateVoiceControlsUI();
}
/* ---- 취소: 일시정지 상태에서만 가능, 이후 수동(연습모드)으로 전환 ---- */
function cancelVoiceStudy(){
  if(!voicePaused) return;
  speakToken++;
  if("speechSynthesis" in window) speechSynthesis.cancel();
  if(gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
  voicePaused = false;
  voicePhase = null;
  releaseWakeLockNow();
  state.studyMode = "practice";
  renderCard();
}
function updateVoiceControlsUI(){
  const pauseBtn = document.getElementById("voicePauseBtn");
  const cancelBtn = document.getElementById("voiceCancelBtn");
  if(!pauseBtn || !cancelBtn) return;
  pauseBtn.textContent = voicePaused ? "▶ 이어서 시작" : "⏸ 일시정지";
  cancelBtn.disabled = !voicePaused;
}

function goToCard(newIdx){
  if(newIdx < 0) return;
  if(newIdx > state.queue.length-1){
    recordQueueCompletion(); saveQueueSession();
    alert("이번 세트 학습을 완료했습니다!");
    // 세트를 어느 메뉴(단원별/연도별/빈도순 등)에서 시작했는지에 따라 그 메뉴로 돌아간다
    // (이전에는 무조건 단원별로 이동해서, 빈도순 등 다른 메뉴에서 시작한 경우 엉뚱한 화면으로 넘어갔음)
    setView(state.returnView || (state.mode==="unitMinor" ? "unit" : (["unit","year","freq"].includes(state.mode) ? state.mode : "home")));
    return;
  }
  state.idx = newIdx;
  // 카드 전환 시 이전 카드의 스크롤 위치가 남아있으면(예: 긴 문제를 아래로 읽던 중 다음 카드로 넘어갈 때)
  // 내용 영역(#app) 높이가 갑자기 줄어들면서 안드로이드 크롬 등에서 주소창이 순간적으로
  // 나타났다 사라지며 하단 네비게이션 바가 출렁이는 원인이 되므로, 렌더링 전후로
  // 스크롤 위치를 #app 기준으로 맨 위로 되돌린다(이제 body가 아니라 #app이 스크롤 컨테이너).
  const appEl1 = document.getElementById("app");
  if(appEl1) appEl1.scrollTop = 0;
  renderCard();
  if(appEl1) appEl1.scrollTop = 0;
  saveQueueSession();
}

function modeTitle(mode){
  return {unit:"단원별 연습", unitMinor:"소단원별 연습", year:"연도별 기출", wrong:"오답노트", bookmark:"즐겨찾기", srs:"오늘 복습", freq:"빈도순 연습"}[mode] || "학습";
}

function datasetHasMultiRound(data){
  const map = {};
  data.forEach(d=>{ (map[d.year] ||= new Set()).add(d.round||1); });
  return Object.values(map).some(s=>s.size>1);
}
function yearRoundLabel(q, multiRound){
  const yy = String(q.year).slice(-2);
  return multiRound ? `${yy}-${q.round||1}` : yy;
}
/* ---- 문제 수정 시 '중복 출제'로 판단되는 다른 문제 id들도 찾기 (buildDuplicateIndex와 동일 기준) ---- */
function findDuplicateIds(id){
  const data = getData();
  const groups = buildCombinedGroups(data);
  const g = groups.find(gr=> gr.some(q=>q.id===id));
  if(!g) return [];
  return g.filter(q=>q.id!==id).map(q=>q.id);
}

function buildDuplicateIndex(data){
  const multiRound = datasetHasMultiRound(data);
  const index = {};
  buildCombinedGroups(data).forEach(g=>{
    if(g.length>1){
      const labels = [...new Set(g.map(x=>yearRoundLabel(x, multiRound)))];
      g.forEach(q=> index[q.id] = labels);
    }
  });
  return index;
}

function revealAnswer(q){
  const kwHtml = (q.keywords&&q.keywords.length) ? `<div class="kw-list">핵심 키워드 참고: ${q.keywords.map(k=>`<span class="kw hit">${k}</span>`).join("")}</div>` : "";
  const noteHtml = q.note ? `<div class="note-box">${escapeHtml(q.note)}</div>` : "";

  document.getElementById("answerSlot").innerHTML = `
    <div class="answer-reveal qa-box"><span class="qa-label answer">정답</span>${inlineImagesOnly(q.answer, q.images)}</div>
    ${renderTagChips(q)}
    ${noteHtml}
    ${kwHtml}
  `;
  bindTagChips(document.getElementById("answerSlot"));
  document.getElementById("gradeSlot").innerHTML = `
    <div class="diff-note">내 답변과 비교해보고 직접 채점해주세요.</div>
    <div class="btn-row">
      <button class="btn danger" id="markX">✕ 오답</button>
      <button class="btn success" id="markO">✔ 정답</button>
    </div>
  `;
  document.getElementById("markO").addEventListener("click", ()=> selfGrade(q, true));
  document.getElementById("markX").addEventListener("click", ()=> selfGrade(q, false));
}

function selfGrade(q, isCorrect){
  const markO = document.getElementById("markO");
  const markX = document.getElementById("markX");
  if(markO.disabled) return; // 이미 채점됨 - 중복 클릭 방지
  markO.disabled = true;
  markX.disabled = true;
  markO.style.opacity = "0.5";
  markX.style.opacity = "0.5";

  const score = isCorrect ? 100 : 0;
  recordResult(q.id, score);
  const tier = isCorrect ? {cls:"good", label:"정답 처리됨"} : {cls:"bad", label:"오답노트에 저장됨"};
  document.getElementById("gradeSlot").insertAdjacentHTML("beforeend", `
    <div class="result-box ${tier.cls}" style="margin-top:10px;"><div class="result-label">${tier.label}</div></div>
  `);
  setTimeout(()=> goToCard(state.idx+1), 500);
}


/* ---- 모의고사 ---- */
function renderExamIntro(){
  const sess = store.examSession;
  const resumeHtml = (sess && sess.ids && sess.ids.length && sess.timeLeft>0) ? `
      <div class="settings-row" style="margin-top:10px;">
        <div class="label">이전에 풀던 모의고사가 있어요 (${sess.idx+1}/${sess.ids.length}번, 남은시간 ${formatTime(sess.timeLeft)})</div>
      </div>
      <button class="btn primary" id="resumeExam" style="margin-top:6px;">이어서 하기</button>
  ` : "";
  const countOptions = [10,20,25,30,35,40,45,50];
  if(!state.examCount) state.examCount = 20;
  setPageBar("실전 모의고사");
  app.innerHTML = `
    <div class="section-card">
      <h3>단원 전체 랜덤 출제</h3>
      <p style="font-size:0.88rem;color:var(--muted);line-height:1.5;">제한시간 30분, 채점은 제출 후 일괄로 확인합니다. 실제 시험처럼 답안을 먼저 다 작성한 뒤 검토하세요.</p>
      <div class="settings-row" style="margin-top:10px;">
        <div class="label">출제 문항 수</div>
        <select id="examCountSelect">
          ${countOptions.map(n=>`<option value="${n}" ${n===state.examCount?'selected':''}>${n}문항</option>`).join("")}
        </select>
      </div>
      <button class="btn primary" id="startExam" style="margin-top:10px;">${sess?'새로 시작하기':'모의고사 시작'}</button>
      ${resumeHtml}
    </div>
  `;
  app.querySelector("#examCountSelect").addEventListener("change", (e)=>{ state.examCount = Number(e.target.value); });
  app.querySelector("#startExam").addEventListener("click", ()=>{
    if(sess && !confirm("이전 진행 기록은 사라집니다. 새로 시작할까요?")) return;
    startExam();
  });
  const resumeBtn = app.querySelector("#resumeExam");
  if(resumeBtn) resumeBtn.addEventListener("click", resumeExam);
}
function startExam(){
  const count = state.examCount || 20;
  const data = [...getData()].sort(()=>Math.random()-0.5).slice(0, Math.min(count, getData().length));
  state.examQueue = data;
  state.examIdx = 0;
  state.examAnswers = {};
  state.examTimeLeft = 30*60;
  saveExamSession();
  renderExamQ();
  clearInterval(state.examTimer);
  state.examTimer = setInterval(()=>{
    state.examTimeLeft--;
    const t = document.getElementById("examTimerDisplay");
    if(t) t.textContent = formatTime(state.examTimeLeft);
    if(state.examTimeLeft % 5 === 0) saveExamSession();
    if(state.examTimeLeft<=0){ clearInterval(state.examTimer); submitExam(); }
  },1000);
}
function resumeExam(){
  const sess = store.examSession;
  if(!sess) return;
  const all = getData();
  const byId = {};
  all.forEach(q=> byId[q.id]=q);
  state.examQueue = sess.ids.map(id=> byId[id]).filter(Boolean);
  state.examIdx = Math.min(sess.idx, state.examQueue.length-1);
  state.examAnswers = sess.answers || {};
  state.examTimeLeft = sess.timeLeft;
  renderExamQ();
  clearInterval(state.examTimer);
  state.examTimer = setInterval(()=>{
    state.examTimeLeft--;
    const t = document.getElementById("examTimerDisplay");
    if(t) t.textContent = formatTime(state.examTimeLeft);
    if(state.examTimeLeft % 5 === 0) saveExamSession();
    if(state.examTimeLeft<=0){ clearInterval(state.examTimer); submitExam(); }
  },1000);
}
function saveExamSession(){
  store.examSession = {
    ids: state.examQueue.map(q=>q.id),
    idx: state.examIdx,
    answers: state.examAnswers,
    timeLeft: state.examTimeLeft
  };
  saveStore();
}
function formatTime(s){
  const m = Math.floor(s/60), sec = s%60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function renderExamQ(){
  const q = withEdits(state.examQueue[state.examIdx]);
  setPageBar("실전 모의고사", {
    onBack: ()=>{ saveCurrentExamInput(q); saveExamSession(); setView("home"); }
  });
  app.innerHTML = `
    <div class="exam-timer" id="examTimerDisplay">${formatTime(state.examTimeLeft)}</div>
    <div class="exam-nav">
      ${state.examQueue.map((eq,i)=>`<button class="exam-dot ${state.examAnswers[eq.id]!==undefined?'answered':''} ${i===state.examIdx?'cur':''}" data-idx="${i}">${i+1}</button>`).join("")}
    </div>
    <div class="meta-row" style="margin-top:12px;">
      <div class="tag-row" style="margin-bottom:0;"><span class="tag unit">${q.unitMajor}</span><span class="tag type">${q.type}</span></div>
    </div>
    <div class="card-box">
      ${renderTextWithImages(q.question, q.images, q.answer)}
      <textarea class="ans-input" id="examInput" placeholder="답안 작성">${state.examAnswers[q.id]||""}</textarea>
      <div class="btn-row">
        <button class="btn ghost" id="examPrev" ${state.examIdx===0?'disabled':''}>이전</button>
        <button class="btn primary" id="examNext">${state.examIdx===state.examQueue.length-1?'제출하기':'다음'}</button>
      </div>
    </div>
  `;
  document.getElementById("examInput").addEventListener("input", e=>{
    state.examAnswers[q.id] = e.target.value;
  });
  document.querySelectorAll(".exam-dot").forEach(d=> d.addEventListener("click", ()=>{
    saveCurrentExamInput(q); state.examIdx = Number(d.dataset.idx); saveExamSession(); renderExamQ();
  }));
  document.getElementById("examPrev").addEventListener("click", ()=>{
    saveCurrentExamInput(q); state.examIdx--; saveExamSession(); renderExamQ();
  });
  document.getElementById("examNext").addEventListener("click", ()=>{
    saveCurrentExamInput(q);
    if(state.examIdx < state.examQueue.length-1){ state.examIdx++; saveExamSession(); renderExamQ(); }
    else submitExam();
  });
}
function saveCurrentExamInput(q){
  const val = document.getElementById("examInput");
  if(val) state.examAnswers[q.id] = val.value;
}
const PARTIAL_SCORE_OPTIONS = [
  {score:0,   label:"오답",        cls:"bad"},
  {score:33,  label:"부분(1/3)",   cls:"mid"},
  {score:50,  label:"부분(1/2)",   cls:"mid"},
  {score:67,  label:"부분(2/3)",   cls:"mid"},
  {score:100, label:"정답",        cls:"good"}
];
function submitExam(){
  clearInterval(state.examTimer);
  store.examSession = null; saveStore();
  const results = state.examQueue.map(q=> ({q, input: state.examAnswers[q.id] || "", graded:null}));
  setPageBar("모의고사 채점");
  app.innerHTML = `
    <div class="section-card"><div class="empty-note" id="examSummary">각 문항의 모범답안과 내 답을 비교해서 아래 버튼으로 직접 채점해주세요. 적어야 할 항목이 2~3가지인 문제는 부분점수 버튼을 눌러주세요.</div></div>
    <div class="result-summary" id="examResultList">
      ${results.map((x,i)=>`
        <div class="result-item" id="exResult-${i}">
          ${renderTextWithImages(x.q.question, x.q.images, x.q.answer).replace('class="q-text"', 'class="q-text rq qa-box"').replace('>문제<', `>문제 ${i+1}<`)}
          <div class="answer-reveal"><b>내 답</b><br>${escapeHtml(x.input)||"(미입력)"}</div>
          <div class="answer-reveal qa-box"><span class="qa-label answer">정답</span>${inlineImagesOnly(x.q.answer, x.q.images)}</div>
          ${x.q.note ? `<div class="note-box">${escapeHtml(x.q.note)}</div>` : ""}
          <div class="score-btn-row" id="exScoreRow-${i}">
            ${PARTIAL_SCORE_OPTIONS.map(opt=>`<button type="button" class="score-btn ${opt.cls}" data-score="${opt.score}" data-i="${i}">${opt.label}<small>${opt.score}%</small></button>`).join("")}
          </div>
          <div class="graded-note" id="exGraded-${i}"></div>
        </div>`).join("")}
    </div>
  `;
  function updateSummary(){
    const graded = results.filter(x=>x.graded!==null);
    const correct = results.filter(x=> x.graded!==null && x.graded>=75).length;
    const avg = graded.length ? Math.round(graded.reduce((s,x)=> s+x.graded, 0)/graded.length) : 0;
    document.getElementById("examSummary").textContent = `채점 완료 ${graded.length}/${results.length} · 정답(75%↑) ${correct}개 · 채점된 문항 평균 ${avg}점`;
  }
  results.forEach((x,i)=>{
    const row = document.getElementById(`exScoreRow-${i}`);
    row.querySelectorAll("[data-score]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const score = Number(btn.dataset.score);
        x.graded = score;
        recordResult(x.q.id, score); // 75점 미만은 recordResult 내부 로직에 따라 자동으로 오답노트에 저장됨
        row.querySelectorAll("[data-score]").forEach(b=> b.classList.remove("selected"));
        btn.classList.add("selected");
        const box = document.getElementById(`exResult-${i}`);
        box.classList.add("graded");
        const tier = score>=75 ? {cls:"good", label:`✔ 정답 처리 (${score}점)`} : score>0 ? {cls:"mid", label:`△ 부분점수 처리 (${score}점) · 오답노트에 저장됨`} : {cls:"bad", label:"✕ 오답 처리 · 오답노트에 저장됨"};
        document.getElementById(`exGraded-${i}`).innerHTML = `<div class="result-box ${tier.cls}"><div class="result-label">${tier.label}</div></div>`;
        toast(`${i+1}번 문항 채점 완료 (${score}점)`);
        updateSummary();
      });
    });
  });
}

/* ---- 설정 ---- */
function renderSettings(){
  const cfg = activeExamConfig();
  setPageBar("설정 · 데이터 관리");
  app.innerHTML = `
    <div class="section-card">
      <div class="settings-row"><div class="label">현재 자격증</div><div>${escapeHtml(cfg.titleText)}</div></div>
      <div class="settings-row"><div class="label">현재 문항 수</div><div>${getData().length}문항</div></div>
    </div>

    <div class="section-card">
      <div class="settings-row"><div class="label">① 학습 보조 기록 초기화</div><button id="resetAll">초기화</button></div>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:4px;">문제 데이터·수정내역은 그대로 두고 정답률·오답노트·즐겨찾기·진행도·회독수만 지웁니다.</p>
    </div>

    <div class="section-card">
      <h3>② 학습데이터 초기화 · 백업 · 복원</h3>
      <div class="settings-row" style="margin-top:6px;"><div class="label">원본 내장 데이터로 초기화</div><button id="restoreSample">초기화</button></div>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:2px;">수정한 내용이 모두 사라지고 앱이 원래 내장하고 있던 문제 데이터로 되돌아갑니다.</p>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
        <div class="label" style="font-weight:700;margin-bottom:6px;">학습데이터만 백업</div>
        <p style="font-size:0.76rem;color:var(--muted);">수정한 내용이 포함된 문제 데이터를 파일로 저장합니다.</p>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.85rem;">
          <input type="checkbox" id="includeProgressChkBackup">
          학습 보조기록(정답률·오답노트·즐겨찾기·진행도·회독수)도 함께 포함
        </label>
        <div class="btn-row" style="margin-top:10px;">
          <button class="btn ghost" id="exportPackage">학습데이터만 백업</button>
        </div>
      </div>

      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
        <div class="label" style="font-weight:700;margin-bottom:6px;">외부데이터 복원</div>
        <p style="font-size:0.76rem;color:var(--muted);">다른 사람이 "학습데이터만 백업"으로 내려받은 파일을 선택하면, 그 사람의 데이터로 전환됩니다.</p>
        <input type="file" accept="application/json" id="backupFile" style="margin-top:10px;">
      </div>
    </div>

    ${isAdminUnlocked ? `
    <div class="section-card">
      <h3>③ 🔀 외부 백업 데이터 병합</h3>
      <p style="font-size:0.8rem;color:var(--muted);line-height:1.5;">
        <b>이럴 때 쓰세요:</b> 다른 기기·다른 브라우저에서 따로 수정하고 "학습데이터만 백업"으로 받아둔 JSON 파일이 있을 때,
        그 내용을 <b>지금 이 화면의 데이터와 합칩니다</b>(어느 한쪽으로 완전히 덮어쓰는 게 아니라, id가 같으면 업로드한 파일 쪽 내용으로 갱신하고
        다른 문항은 그대로 유지 + 새 문항은 추가). 병합이 끝나면 아래 ④번으로 바로 배포 파일을 뽑으시면 됩니다.
      </p>
      <input type="file" accept="application/json" id="mergeBackupFile" style="margin-top:10px;">
      <div id="mergeResultLog" style="display:none;font-size:0.78rem;background:#f4efe3;border-radius:8px;padding:10px;margin-top:10px;white-space:pre-wrap;line-height:1.6;max-height:260px;overflow-y:auto;"></div>
    </div>
    ` : ``}

    ${isAdminUnlocked ? `
    <div class="section-card">
      <h3>④ 🗂 배포용 ZIP 생성 (앱 + 현재 데이터)</h3>
      <p style="font-size:0.8rem;color:var(--muted);line-height:1.5;">
        <b>이럴 때 쓰세요:</b> 지금 이 화면(이 기기)에서 수정한 내용을 새 버전 파일로 뽑아서 GitHub 등에 올릴 때 씁니다.
        지금 이 앱(소스 코드) + 현재까지 수정된 문제 데이터를 통째로 담아, 압축을 풀기만 하면 그대로 실행되는
        새 학습 HTML 파일을 만듭니다. 어디에 풀어도 독립적으로 작동해요. (③번으로 외부 데이터를 먼저 합친 뒤 이걸 눌러도 됩니다)
      </p>
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:0.85rem;">
        <input type="checkbox" id="includeProgressChk" checked>
        내 학습기록(정답률·오답노트·즐겨찾기·진행도·회독수)도 함께 포함
      </label>
      <div class="settings-row" style="margin-top:10px;">
        <div class="label">비밀번호 (선택)</div>
        <input type="password" id="zipPassword" placeholder="설정 시 파일 여는 사람에게 요구됨" style="max-width:180px;">
      </div>
      <div style="font-size:0.74rem;color:var(--muted);margin-top:4px;">이 앱 자체 기능으로 문제 내용을 가려주는 간단한 보호 장치입니다. (탐색기·압축프로그램에서 여는 표준 zip 암호는 아니며, 소스보기로 원문이 바로 보이지 않게만 해줍니다)</div>
      <div class="btn-row" style="margin-top:10px;">
        <button class="btn primary" id="exportZipBackup">🗂 ZIP으로 백업 저장</button>
      </div>
      <div style="font-size:0.76rem;color:var(--muted);margin-top:6px;">문항 수가 많아 생성에 몇 초 정도 걸릴 수 있어요.</div>
    </div>
    ` : ``}

    <div style="text-align:center;margin-top:22px;">
      <span id="adminToggle" style="font-size:0.68rem;color:var(--line);cursor:pointer;user-select:none;">Admin</span>
    </div>
  `;
  app.querySelector("#adminToggle").addEventListener("click", ()=>{
    if(isAdminUnlocked){ isAdminUnlocked = false; renderSettings(); return; }
    const pw = prompt("비밀번호를 입력하세요");
    if(pw === null) return;
    if(pw === "2026"){ isAdminUnlocked = true; renderSettings(); }
    else if(pw !== ""){ alert("비밀번호가 올바르지 않습니다."); }
  });
  app.querySelector("#resetAll").addEventListener("click", ()=>{
    if(confirm("모든 학습기록을 초기화할까요? (문제 데이터·수정내역은 유지됩니다)")){
      store = {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:store.customData, edits:store.edits, examConfig:store.examConfig, session:{}, examSession:null, setRepeats:{}, targetDate:store.targetDate};
      saveStore(); setView("home");
    }
  });

  app.querySelector("#backupFile").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const parsed = decodeBackupPayload(reader.result);
        if(!parsed.data || !Array.isArray(parsed.data) || !parsed.data.length) throw new Error("invalid backup");
        const isFullBackup = parsed.kind === "full-backup";
        const name = (parsed.examConfig&&parsed.examConfig.titleText)||"새 자격증";
        const msg = isFullBackup
          ? `"${name}" 백업을 불러올까요? 학습기록까지 그대로 복원되며, 현재 데이터는 덮어써집니다.`
          : `"${name}" 데이터로 전환할까요? (학습기록이 없는 파일이라 현재 학습기록은 초기화됩니다.)`;
        if(!confirm(msg)) return;
        store = {
          progress: isFullBackup ? (parsed.progress||{}) : {},
          wrong: isFullBackup ? (parsed.wrong||{}) : {},
          bookmarks: isFullBackup ? (parsed.bookmarks||{}) : {},
          streak: isFullBackup ? (parsed.streak||{last:null,count:0}) : {last:null,count:0},
          solvedTotal: isFullBackup ? (parsed.solvedTotal||0) : 0,
          correctTotal: isFullBackup ? (parsed.correctTotal||0) : 0,
          setRepeats: isFullBackup ? (parsed.setRepeats||{}) : {},
          customData: parsed.data,
          edits: {},
          examConfig: parsed.examConfig || null,
          session: {},
          examSession: null
        };
        saveStore();
        applyExamConfig();
        alert(isFullBackup ? "백업을 복원했습니다." : "자격증 데이터를 전환했습니다.");
        setView("home");
      }catch(err){ alert("올바른 백업 파일이 아닙니다."); }
    };
    reader.readAsText(file);
  });

  app.querySelector("#exportPackage").addEventListener("click", ()=>{
    const includeProgress = app.querySelector("#includeProgressChkBackup").checked;
    const pkg = includeProgress ? {
      kind: "full-backup",
      version: 1,
      examConfig: activeExamConfig(),
      data: getData(),
      progress: store.progress,
      wrong: store.wrong,
      bookmarks: store.bookmarks,
      streak: store.streak,
      solvedTotal: store.solvedTotal,
      correctTotal: store.correctTotal,
      setRepeats: store.setRepeats
    } : {
      examConfig: activeExamConfig(),
      data: getData()
    };
    const json = JSON.stringify(pkg);
    const blob = new Blob([json], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0,10);
    a.download = (activeExamConfig().markText||"exam") + (includeProgress ? "_전체백업_" : "_문제데이터_") + dateStr + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  });

  app.querySelector("#restoreSample").addEventListener("click", ()=>{
    if(!confirm("이 앱의 기본 샘플 데이터로 되돌릴까요? 현재 데이터·기록은 초기화됩니다.")) return;
    store = {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:null, session:{}, examSession:null, setRepeats:{}};
    saveStore();
    applyExamConfig();
    alert("샘플 데이터로 복원했습니다.");
    setView("home");
  });

  const mergeBackupFileEl = app.querySelector("#mergeBackupFile");
  if(mergeBackupFileEl){
    mergeBackupFileEl.addEventListener("change", (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        const logEl = app.querySelector("#mergeResultLog");
        logEl.style.display = "block";
        try{
          const parsed = decodeBackupPayload(reader.result);
          if(!parsed.data || !Array.isArray(parsed.data) || !parsed.data.length) throw new Error("invalid backup");
          const currentData = getData();
          const map = {};
          currentData.forEach(q=> map[q.id] = q);
          let updated = 0, added = 0;
          const updatedList = [], addedList = [];
          parsed.data.forEach(q=>{
            const before = map[q.id];
            if(before){
              if(JSON.stringify(before) !== JSON.stringify(q)){
                updated++;
                updatedList.push(`  · [${q.id}] ${(q.question||"").slice(0,30).replace(/\n/g," ")}...`);
              }
            } else {
              added++;
              addedList.push(`  · [${q.id}] ${(q.question||"").slice(0,30).replace(/\n/g," ")}...`);
            }
            map[q.id] = q;
          });
          const merged = Object.values(map).sort((a,b)=>{
            if(a.year !== b.year) return a.year - b.year;
            if((a.round||1) !== (b.round||1)) return (a.round||1) - (b.round||1);
            const na = String(a.no||""), nb = String(b.no||"");
            const numA = parseInt((na.match(/^\d+/)||[0])[0], 10) || 0;
            const numB = parseInt((nb.match(/^\d+/)||[0])[0], 10) || 0;
            if(numA !== numB) return numA - numB;
            return na.localeCompare(nb);
          });
          const lines = [];
          lines.push(`병합 완료: 실제 내용이 바뀐 문항 ${updatedList.length}개, 신규 추가 ${added}개, 병합 후 총 ${merged.length}개`);
          if(updatedList.length){ lines.push("", "[내용이 바뀐 문항]", ...updatedList.slice(0,50)); if(updatedList.length>50) lines.push(`  ...외 ${updatedList.length-50}건 더`); }
          if(addedList.length){ lines.push("", "[새로 추가된 문항]", ...addedList.slice(0,30)); if(addedList.length>30) lines.push(`  ...외 ${addedList.length-30}건 더`); }
          lines.push("", "✅ 병합 결과를 메모리에 담아뒀습니다 (저장공간을 아끼려고 브라우저에는 저장 안 함 — 새로고침하면 사라지니, 지금 바로 아래 ④번 'ZIP으로 백업 저장'을 눌러 새 배포 파일을 뽑으세요).");
          logEl.textContent = lines.join("\n");

          pendingMergedData = merged;
        }catch(err){
          logEl.textContent = "❌ 병합 실패: 올바른 백업 파일이 아닙니다. (" + err.message + ")";
        }
      };
      reader.readAsText(file);
    });
  }

  const exportZipBtn = app.querySelector("#exportZipBackup");
  if(exportZipBtn){
    exportZipBtn.addEventListener("click", ()=>{
      const includeProgress = app.querySelector("#includeProgressChk").checked;
      const password = app.querySelector("#zipPassword").value;
      buildAndDownloadZipBackup(includeProgress, password);
    });
  }
}



function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---- 자기 완결형 ZIP 백업: 앱 소스+데이터(+학습기록)를 통째로 새 HTML로 담아 압축 ---- */
function findJsonArrayEnd(text, startIdx){
  let depth = 0, inStr = false, esc = false;
  for(let i=startIdx; i<text.length; i++){
    const ch = text[i];
    if(inStr){
      if(esc) esc = false;
      else if(ch === "\\") esc = true;
      else if(ch === '"') inStr = false;
      continue;
    }
    if(ch === '"'){ inStr = true; continue; }
    if(ch === '[' || ch === '{') depth++;
    else if(ch === ']' || ch === '}'){ depth--; if(depth===0) return i+1; }
  }
  return -1;
}
function bytesToBase64(bytes){
  let binary = "";
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
  }
  return btoa(binary);
}
function xorLockPayload(str, pw){
  const bytes = new TextEncoder().encode(str);
  const keyBytes = new TextEncoder().encode(pw);
  const out = new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  return bytesToBase64(out);
}
async function buildAndDownloadZipBackup(includeProgress, password){
  if(typeof JSZip === "undefined"){
    alert("백업 도구를 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.");
    return;
  }
  toast("백업 파일을 만드는 중입니다...");
  await new Promise(r=> setTimeout(r, 60));
  try{
    // 스냅샷 시점에 떠 있던 토스트("백업 파일을 만드는 중입니다...")가 그대로 굳어서
    // 백업 파일을 열었을 때 하단에 영구히 남는 문제를 방지: outerHTML을 찍기 전에
    // 실제 화면(DOM)의 토스트 요소를 먼저 비워둔다.
    // (주의) 예전에는 html 문자열 전체에 정규식으로 <div id="toast">...</div>를 찾아
    // 지웠는데, 이 코드 자신의 소스(정규식/치환 문자열 텍스트)도 같은 패턴을 포함하고
    // 있어서 toast div보다 먼저(스크립트 태그 안) 매칭되어 오히려 스크립트 소스가
    // 잘려나가는 문제가 있었다. 그 결과로 백업 파일을 열면 문법 오류로 스크립트 전체가
    // 실행되지 않아, 백업 당시 화면이 그대로 멈춰있고 토스트 문구만 남는 현상이 발생했다.
    const toastEl = document.getElementById("toast");
    const toastPrev = toastEl ? {text: toastEl.textContent, cls: toastEl.className} : null;
    if(toastEl){ toastEl.textContent = ""; toastEl.className = "toast"; }
    let html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    if(toastEl && toastPrev){ toastEl.textContent = toastPrev.text; toastEl.className = toastPrev.cls; }
    // 배포 시점 타임스탬프(YY.MM.DD.HH.MM) — 파일명과 화면의 Ver. 표시에 동일하게 사용
    const nowStampFn = ()=>{
      const d = new Date();
      const p = n=> String(n).padStart(2,"0");
      return `${p(d.getFullYear()%100)}.${p(d.getMonth()+1)}.${p(d.getDate())}.${p(d.getHours())}.${p(d.getMinutes())}`;
    };
    const stamp = nowStampFn();
    const verMarker = 'const APP_VERSION = "';
    const verIdx = html.indexOf(verMarker);
    if(verIdx !== -1){
      const verEnd = html.indexOf('"', verIdx + verMarker.length);
      html = html.slice(0, verIdx+verMarker.length) + stamp + html.slice(verEnd);
    }
    const marker = "const SAMPLE_DATA = ";
    const mi = html.indexOf(marker);
    const arrStart = html.indexOf("[", mi);
    const arrEnd = findJsonArrayEnd(html, arrStart);
    if(mi===-1 || arrStart===-1 || arrEnd===-1) throw new Error("data-not-found");

    // ③번에서 병합해둔 결과(pendingMergedData)가 있으면 그걸 기준으로, 없으면 평소처럼 getData()를 쓴다.
    // 병합 후 추가로 개별 문항을 수정했을 수도 있으니 store.edits는 그 위에 마저 적용한다.
    const mergedBaseData = pendingMergedData || (store.customData && store.customData.length ? store.customData : SAMPLE_DATA);
    const mergedData = (!store.edits || !Object.keys(store.edits).length) ? mergedBaseData : mergedBaseData.map(q => store.edits[q.id] ? {...q, ...store.edits[q.id]} : q);
    const newStore = includeProgress
      ? {...store, customData:null, edits:{}, session:{}, examSession:null}
      : {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:store.examConfig, session:{}, examSession:null, setRepeats:{}};

    if(password){
      // 비밀번호 지정 시: 문제/학습 데이터를 이 앱 전용의 간단한 잠금(XOR+Base64)으로 감싸서
      // 소스보기 등으로 내용이 바로 노출되지 않게 하고, 앱 실행 시 비밀번호를 입력해야 열람 가능하게 함.
      // (일반 압축프로그램이 인식하는 표준 zip 암호는 아니며, 이 앱 내부에서만 통하는 간단한 보호 장치입니다)
      const payload = JSON.stringify({data: mergedData, store: newStore});
      const locked = xorLockPayload(payload, password);
      const lockedScript = "const SAMPLE_DATA = (function(){\n"
        + "  function __xorUnlock(b64, pw){\n"
        + "    const bin = atob(b64);\n"
        + "    const bytes = new Uint8Array(bin.length);\n"
        + "    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);\n"
        + "    const keyBytes = new TextEncoder().encode(pw);\n"
        + "    const out = new Uint8Array(bytes.length);\n"
        + "    for(let i=0;i<bytes.length;i++) out[i]=bytes[i]^keyBytes[i%keyBytes.length];\n"
        + "    return new TextDecoder().decode(out);\n"
        + "  }\n"
        + "  let __parsed = null;\n"
        + "  while(__parsed === null){\n"
        + "    const __pw = prompt(\"이 백업 파일은 비밀번호로 보호되어 있습니다.\\n비밀번호를 입력하세요:\");\n"
        + "    if(__pw === null){ document.write(\"취소되었습니다. 새로고침 후 다시 시도해주세요.\"); throw new Error(\"cancelled\"); }\n"
        + "    try{ __parsed = JSON.parse(__xorUnlock(" + JSON.stringify(locked) + ", __pw)); }\n"
        + "    catch(e){ alert(\"비밀번호가 올바르지 않습니다. 다시 시도해주세요.\"); }\n"
        + "  }\n"
        + "  try{ localStorage.setItem(" + JSON.stringify(LS_KEY) + ", JSON.stringify(__parsed.store)); }catch(e){}\n"
        + "  return __parsed.data;\n"
        + "})();";
      html = html.slice(0, mi) + lockedScript + html.slice(arrEnd);
    } else {
      html = html.slice(0, arrStart) + JSON.stringify(mergedData) + html.slice(arrEnd);
      let bodyClose = html.lastIndexOf("</body>");
      // 이미 한 번 백업된 파일(시드 스크립트가 </body> 앞에 붙어있는 상태)을 다시 백업하면
      // 예전 시드 스크립트가 지워지지 않고 계속 쌓이는 문제가 있었다. 새 시드를 넣기 전에
      // </body> 바로 앞에 붙어있는 이전 시드 스크립트(들)를 먼저 제거한다.
      const seedTailRe = /\n?<script>try\{localStorage\.setItem\([\s\S]*?\);\}catch\(e\)\{\}<\/script>\n?$/;
      let head = html.slice(0, bodyClose);
      let m;
      while((m = head.match(seedTailRe))){
        head = head.slice(0, head.length - m[0].length);
      }
      html = head + html.slice(bodyClose);
      bodyClose = html.lastIndexOf("</body>");
      const seed = "<script>try{localStorage.setItem(" + JSON.stringify(LS_KEY) + "," + JSON.stringify(JSON.stringify(newStore)) + ");}catch(e){}<\/script>\n";
      html = html.slice(0, bodyClose) + seed + html.slice(bodyClose);
    }

    const cfg = activeExamConfig();
    const htmlName = (cfg.markText||"exam") + "_실기_필답노트_" + stamp + ".html";

    const zip = new JSZip();
    zip.file(htmlName, html);
    const blob = await zip.generateAsync({type:"blob", compression:"DEFLATE", compressionOptions:{level:6}});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (cfg.markText||"exam") + "_전체백업_" + stamp + ".zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 8000);
    toast("ZIP 백업이 저장되었습니다");
  }catch(err){
    console.error(err);
    alert("백업 생성 중 문제가 발생했습니다: " + err.message);
  }
}

/* ---- 선택한 문제 세트를 PDF로 저장 (인쇄 다이얼로그 이용) ---- */
function exportListToPDF(list, title, hideAnswer){
  if(!list || !list.length){ toast("내보낼 문제가 없습니다"); return; }
  const cfg = activeExamConfig();
  const bodyHtml = list.map((raw,i)=>{
    const q = withEdits(raw);
    const imgSrcs = (q.images||[]).map(fn=> imgSrc(fn));
    const used = new Set();
    const inlinePdf = (text)=>{
      return escapeHtml(text||"").replace(/\{\{img:(\d+)\}\}/g, (m, idxStr)=>{
        const idx = Number(idxStr);
        const src = imgSrcs[idx];
        if(!src) return "";
        used.add(idx);
        return `<img src="${src}" style="max-width:100%;margin:6px 0;display:block;">`;
      });
    };
    const questionHtml = inlinePdf(q.question);
    const answerHtml = inlinePdf(q.answer);
    // 문제/정답 어디에도 위치가 지정되지 않은 이미지는 문제 아래에 한 번만 표시
    const leftoverImgs = imgSrcs.map((src,idx)=> (!used.has(idx) && src) ? `<img src="${src}" style="max-width:100%;margin:6px 0;">` : "").join("");
    // 시험모드 출력은 실제 시험지처럼 정답 없이 문제와 답안 작성 여백만 넣는다
    const answerBlock = hideAnswer
      ? `<div style="margin-top:8px;border:1px solid #ccc;border-radius:6px;min-height:70px;"></div>`
      : `<div style="margin-top:8px;padding:10px;background:#f6f6f6;border-radius:6px;"><b>정답</b><br>${answerHtml}</div>`;
    return `
      <div style="page-break-inside:avoid;margin-bottom:22px;border-bottom:1px solid #ddd;padding-bottom:16px;">
        <div style="font-size:12px;color:#888;margin-bottom:4px;">${q.year}년${q.round?" "+q.round+"회":""} · ${q.unitMajor}${q.points?` · ${q.points}점`:""}</div>
        <div style="font-weight:700;margin-bottom:6px;">${i+1}. ${questionHtml}</div>
        ${leftoverImgs}
        ${answerBlock}
      </div>`;
  }).join("");
  const win = window.open("", "_blank");
  if(!win){ toast("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."); return; }
  win.document.write(`
    <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
    <title>${escapeHtml(cfg.titleText)} - ${escapeHtml(title||"")}</title>
    <style>
      body{font-family:-apple-system,'Malgun Gothic',sans-serif;padding:24px;color:#222;}
      h1{font-size:18px;margin-bottom:4px;}
      .meta{font-size:12px;color:#888;margin-bottom:20px;}
      img{max-width:100%;}
    </style>
    </head><body>
    <h1>${escapeHtml(cfg.titleText)}${hideAnswer ? " (시험지)" : ""}</h1>
    <div class="meta">${escapeHtml(title||"")} · 총 ${list.length}문항 · 출력일 ${todayStr()}</div>
    ${bodyHtml}
    </body></html>
  `);
  win.document.close();
  setTimeout(()=>{ win.focus(); win.print(); }, 400);
}

/* ---- 토스트 알림 (건축기사 앱에서 이식) ---- */
function toast(msg){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=> t.classList.remove("show"), 2200);
}

/* ---- 카드 스와이프 제스처 (건축기사 앱에서 이식) ---- */
function snapBack(el){
  el.style.transition = "transform 0.25s ease, opacity 0.25s ease";
  el.style.transform = "translateX(0) rotate(0)";
  el.style.opacity = "1";
}

/* ---- 카드 스와이프/클릭 제스처 (터치+마우스 공용, 책장 넘기기 효과) ---- */
function attachCardGestures(elId, onTap, onSwipeLeft, onSwipeRight){
  const el = document.getElementById(elId);
  if(!el) return;
  let startX=0, startY=0, dx=0, dy=0;
  let active=false, horizontalDrag=false, verticalScroll=false, mouseDown=false;

  const begin = (x,y)=>{ startX=x; startY=y; dx=0; dy=0; active=true; horizontalDrag=false; verticalScroll=false; };
  const move = (x,y)=>{
    if(!active) return;
    dx = x-startX; dy = y-startY;
    if(!horizontalDrag && !verticalScroll){
      if(Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) horizontalDrag = true;
      else if(Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) verticalScroll = true;
    }
    if(horizontalDrag){
      el.style.transition = "none";
      el.style.transform = `translateX(${dx*0.6}px) rotate(${dx*0.025}deg)`;
      el.style.opacity = String(Math.max(1 - Math.abs(dx)/450, 0.55));
    }
  };
  const end = (e)=>{
    if(!active) return;
    active = false;
    if(verticalScroll) return;
    if(horizontalDrag){
      if(Math.abs(dx) > 70){
        const dir = dx < 0 ? -1 : 1; // -1: 왼쪽으로 넘김(다음), 1: 오른쪽으로 넘김(이전)
        el.style.transition = "transform 0.22s cubic-bezier(.4,0,.2,1), opacity 0.22s ease";
        el.style.transform = `translateX(${dir*130}%) rotate(${dir*16}deg)`;
        el.style.opacity = "0";
        setTimeout(()=>{ if(dir<0) onSwipeLeft(); else onSwipeRight(); }, 170);
      } else {
        snapBack(el);
      }
      return;
    }
    if(onTap) onTap(e);
  };

  el.addEventListener("touchstart", e=>{
    if(e.touches.length!==1) return;
    begin(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive:true});
  el.addEventListener("touchmove", e=>{
    if(!active || e.touches.length!==1) return;
    move(e.touches[0].clientX, e.touches[0].clientY);
    // 가로 드래그로 판정된 순간부터는 브라우저의 세로 탄성(고무줄) 스크롤이
    // 함께 발생하지 않도록 막는다 — 이 겹침이 하단 네비게이션 바가 출렁이는 원인이었음
    if(horizontalDrag && e.cancelable) e.preventDefault();
  }, {passive:false});
  el.addEventListener("touchend", e=>{
    const isTouch = e.changedTouches && e.changedTouches[0];
    const t = isTouch ? e.target : null;
    // 이미지를 탭했을 때, 터치 후 뒤이어 발생하는 합성(ghost) click 이벤트가
    // 방금 띄운 확대창(zoom overlay)을 즉시 닫아버리는 것을 방지
    if(t && t.tagName === "IMG" && e.cancelable) e.preventDefault();
    end(isTouch ? {target: t} : e);
  });

  el.addEventListener("mousedown", e=>{
    if(e.target.closest("button,textarea,input,select,.mini-btn,.edit-image-del")) return;
    mouseDown = true;
    begin(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", e=>{
    if(!mouseDown) return;
    move(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", e=>{
    if(!mouseDown) return;
    mouseDown = false;
    end(e);
  });
}

/* ---- 이미지 확대 보기 (라이트박스) ---- */
function openImageZoom(src){
  const overlay = document.createElement("div");
  overlay.className = "zoom-overlay";
  overlay.innerHTML = `<img src="${src}" class="zoom-img">`;
  overlay.addEventListener("click", ()=> overlay.remove());
  document.body.appendChild(overlay);
}

/* ---- 카드 등장 애니메이션 (책장 넘기기 느낌) ---- */
function playCardEnterAnimation(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  el.classList.add("card-enter");
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=> el.classList.remove("card-enter"));
  });
}

/* ---- 문제/정답 텍스트에 이미지 삽입 위치({{img:N}}) 반영 렌더링 ---- */
function inlineImagesOnly(text, images){
  const safe = escapeHtml(text || "");
  if(!images || !images.length) return safe;
  return safe.replace(/\{\{img:(\d+)\}\}/g, (m, idxStr)=>{
    const idx = Number(idxStr);
    if(idx<0 || idx>=images.length) return "";
    const src = imgSrc(images[idx]);
    return src ? `<img src="${src}" alt="이미지 ${idx+1}" class="q-image inline-img">` : "";
  });
}
function renderTextWithImages(text, images, otherText){
  const safe = escapeHtml(text || "");
  if(!images || !images.length){
    return `<div class="q-text"><span class="qa-label">문제</span>${safe}</div>`;
  }
  const used = new Set();
  // 다른 필드(예: 정답)에 이미 위치가 지정된 이미지는 여기서 다시(중복으로) 보여주지 않는다
  if(otherText){
    let m2;
    const re2 = /\{\{img:(\d+)\}\}/g;
    while((m2 = re2.exec(otherText)) !== null){ used.add(Number(m2[1])); }
  }
  const withInline = safe.replace(/\{\{img:(\d+)\}\}/g, (m, idxStr)=>{
    const idx = Number(idxStr);
    if(idx<0 || idx>=images.length) return "";
    used.add(idx);
    const src = imgSrc(images[idx]);
    return src ? `<img src="${src}" alt="이미지 ${idx+1}" class="q-image inline-img">` : "";
  });
  // 문제/정답 어디에도 위치가 지정되지 않은 이미지는 기본적으로 문제 쪽에 표시한다 (박스 안쪽에 포함)
  const remainIdx = images.map((_,idx)=>idx).filter(idx=>!used.has(idx));
  const tail = remainIdx.length ? renderImages(remainIdx.map(idx=>images[idx])) : "";
  return `<div class="q-text"><span class="qa-label">문제</span>${withInline}${tail}</div>`;
}

/* 배포용으로 Base64 인코딩된 데이터 파일을 자동으로 풀어준다 */

function base64ToUtf8(str){
  return decodeURIComponent(escape(atob(str)));
}
function decodeBackupPayload(rawText){
  const parsed = JSON.parse(rawText);
  if(parsed && parsed.encoded === true && parsed.format === "base64" && parsed.payload){
    return JSON.parse(base64ToUtf8(parsed.payload));
  }
  return parsed;
}

/* ---- 전체 목록 (검색/필터) ---- */
let browseYearSelected = new Set(); // 비어있으면 전체 연도
let browseUnitSelected = new Set(); // 비어있으면 전체 대단원
let browseUnitMinorSelected = new Set(); // 비어있으면 전체 소단원 (값이 있으면 대단원 선택보다 우선 적용)
let browseTagSelected = null; // 특정 키워드 태그로 진입했을 때만 값이 채워짐 (단일 태그)
let browseSkipReset = false; // 태그 클릭으로 진입할 때 필터 초기화를 건너뛰기 위한 플래그
let linkModeActive = false;
let linkSelected = new Set();

/* ---- 주제 키워드(태그) 칩 렌더링: 클릭하면 같은 태그의 문항 목록으로 이동 ---- */
function renderTagChips(q){
  if(!q.tags || !q.tags.length) return "";
  return `<div class="tag-chip-row">${q.tags.map(t=>`<span class="tag-chip" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join("")}</div>`;
}
function bindTagChips(container){
  if(!container) return;
  container.querySelectorAll(".tag-chip[data-tag]").forEach(el=>{
    el.addEventListener("click", (e)=>{
      e.stopPropagation();
      openTagBrowse(el.dataset.tag);
    });
  });
}
/* ---- 특정 키워드 태그를 가진 문항만 모아 '전체 문제 목록' 화면으로 이동 ---- */
function openTagBrowse(tag){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  browseYearSelected = new Set();
  browseUnitSelected = new Set();
  browseUnitMinorSelected = new Set();
  browseTagSelected = tag;
  browseSkipReset = true;
  linkModeActive = false;
  linkSelected = new Set();
  setView("browse");
}

/* 연도(·회차) / 단원 선택지 목록을 만든다 */
function yearOptionsFor(data){
  const multiRound = datasetHasMultiRound(data);
  const combos = {};
  data.forEach(d=>{
    const key = d.year + "-" + (d.round||1);
    if(!combos[key]) combos[key] = {value:key, label:`${d.year}년${multiRound?" "+(d.round||1)+"회":""}`, year:d.year, round:d.round||1};
  });
  return Object.values(combos).sort((a,b)=> a.year-b.year || a.round-b.round);
}
function unitOptionsFor(data){
  const present = new Set(data.map(d=>d.unitMajor));
  return unitMajorList().filter(m=>present.has(m)).map(u=>({value:u, label:u}));
}

/* 연도를 여러 개 선택할 수 있는 팝업 필터 */
function openBrowseFilterModal(kind){
  const data = getData();
  if(kind === "unit"){ openBrowseUnitFilterModal(data); return; }
  const options = yearOptionsFor(data);
  const selectedSet = browseYearSelected;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>연도 선택 (복수 선택 가능)</h3>
      <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">아무것도 선택하지 않으면 전체가 표시됩니다.</p>
      <div class="chip-row" style="margin-top:12px;">
        <button class="chip ${selectedSet.size===0?'active':''}" data-all="1">전체</button>
        ${options.map(o=>`<button class="chip ${selectedSet.has(o.value)?'active':''}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</button>`).join("")}
      </div>
      <button class="btn primary" id="filterModalDone" style="margin-top:16px;width:100%;">확인</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=>{ overlay.remove(); renderBrowseList(); updateFilterPillLabels(); };
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#filterModalDone").addEventListener("click", close);
  const allBtn = overlay.querySelector('[data-all="1"]');
  const optButtons = overlay.querySelectorAll('[data-value]');
  allBtn.addEventListener("click", ()=>{
    selectedSet.clear();
    allBtn.classList.add("active");
    optButtons.forEach(b=>b.classList.remove("active"));
  });
  optButtons.forEach(b=>{
    b.addEventListener("click", ()=>{
      const v = b.dataset.value;
      if(selectedSet.has(v)) selectedSet.delete(v); else selectedSet.add(v);
      b.classList.toggle("active", selectedSet.has(v));
      allBtn.classList.toggle("active", selectedSet.size===0);
    });
  });
}

/* 단원 필터: 대단원(복수선택) 또는 소단원(복수선택) 중 하나의 레벨로 선택. 소단원을 하나라도 고르면 그 값이 우선 적용된다. */
function openBrowseUnitFilterModal(data){
  const presentMajors = new Set(data.map(d=>d.unitMajor));
  const presentMinors = new Set(data.map(d=>d.unitMinor).filter(Boolean));
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>단원 선택 (복수 선택 가능)</h3>
      <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">대단원 또는 소단원 중 원하는 단위로 선택하세요. 소단원을 하나라도 선택하면 소단원 기준이 우선 적용됩니다. 아무것도 선택하지 않으면 전체가 표시됩니다.</p>
      <div class="chip-row" style="margin-top:12px;">
        <button class="chip ${(browseUnitSelected.size===0 && browseUnitMinorSelected.size===0)?'active':''}" data-all="1">전체</button>
      </div>
      <div class="unit-filter-tree" style="margin-top:10px;">
        ${UNIT_TAXONOMY.filter(g=>presentMajors.has(g.major)).map(g=>`
          <div class="unit-filter-group">
            <button class="chip major-chip ${browseUnitSelected.has(g.major)?'active':''}" data-major="${escapeHtml(g.major)}">${escapeHtml(g.major)}</button>
            <div class="chip-row minor-chip-row">
              ${g.minors.filter(m=>presentMinors.has(m)).map(m=>`<button class="chip minor-chip ${browseUnitMinorSelected.has(m)?'active':''}" data-minor="${escapeHtml(m)}">${escapeHtml(m)}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      <button class="btn primary" id="filterModalDone" style="margin-top:16px;width:100%;">확인</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=>{ overlay.remove(); renderBrowseList(); updateFilterPillLabels(); };
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#filterModalDone").addEventListener("click", close);
  const allBtn = overlay.querySelector('[data-all="1"]');
  const majorButtons = overlay.querySelectorAll('[data-major]');
  const minorButtons = overlay.querySelectorAll('[data-minor]');
  const refreshAll = ()=> allBtn.classList.toggle("active", browseUnitSelected.size===0 && browseUnitMinorSelected.size===0);
  allBtn.addEventListener("click", ()=>{
    browseUnitSelected.clear(); browseUnitMinorSelected.clear();
    majorButtons.forEach(b=>b.classList.remove("active"));
    minorButtons.forEach(b=>b.classList.remove("active"));
    refreshAll();
  });
  majorButtons.forEach(b=>{
    b.addEventListener("click", ()=>{
      const v = b.dataset.major;
      if(browseUnitSelected.has(v)) browseUnitSelected.delete(v); else browseUnitSelected.add(v);
      b.classList.toggle("active", browseUnitSelected.has(v));
      refreshAll();
    });
  });
  minorButtons.forEach(b=>{
    b.addEventListener("click", ()=>{
      const v = b.dataset.minor;
      if(browseUnitMinorSelected.has(v)) browseUnitMinorSelected.delete(v); else browseUnitMinorSelected.add(v);
      b.classList.toggle("active", browseUnitMinorSelected.has(v));
      refreshAll();
    });
  });
}
/* 필터 버튼에 현재 선택 상태(전체 · N개)를 표시 */
function updateFilterPillLabels(){
  const yBtn = document.getElementById("yearFilterPill");
  const uBtn = document.getElementById("unitFilterPill");
  if(yBtn) yBtn.textContent = (browseYearSelected.size ? `연도 ${browseYearSelected.size}개` : "연도 전체") + " ▾";
  if(uBtn){
    if(browseUnitMinorSelected.size) uBtn.textContent = `소단원 ${browseUnitMinorSelected.size}개 ▾`;
    else if(browseUnitSelected.size) uBtn.textContent = `대단원 ${browseUnitSelected.size}개 ▾`;
    else uBtn.textContent = "단원 전체 ▾";
  }
}

function renderBrowseView(){
  if(browseSkipReset){
    browseSkipReset = false; // 태그 클릭으로 들어온 경우 필터를 유지한다
  }else{
    browseYearSelected = new Set();
    browseUnitSelected = new Set();
    browseUnitMinorSelected = new Set();
    browseTagSelected = null;
  }
  linkModeActive = false;
  linkSelected = new Set();
  setPageBar("전체 문제 목록", {
    rightHtml: `<button class="pdf-mini" id="linkModeToggleBtn">🔗 연결 모드</button>`,
    rightId: "linkModeToggleBtn",
    rightClick: ()=>{
      linkModeActive = !linkModeActive;
      linkSelected = new Set();
      const btn = document.getElementById("linkModeToggleBtn");
      if(btn){
        btn.textContent = linkModeActive ? "🔗 연결모드 끄기" : "🔗 연결 모드";
        btn.classList.toggle("active", linkModeActive);
      }
      renderBrowseList();
    }
  });
  app.innerHTML = `
    ${browseTagSelected ? `<div class="tag-filter-pill" id="tagFilterPill">#${escapeHtml(browseTagSelected)} 키워드로 보는 중 <span class="x" id="tagFilterClear">✕</span></div>` : ""}
    <input class="search-box" id="searchBox" placeholder="문제 내용/키워드로 검색">
    <div class="filter-pill-row">
      <button class="filter-pill" id="yearFilterPill">연도 전체 ▾</button>
      <button class="filter-pill" id="unitFilterPill">단원 전체 ▾</button>
    </div>
    <div class="section-title" id="browseCount"></div>
    <div id="browseList"></div>
    <div id="linkModeBar" style="display:none;position:sticky;bottom:0;background:var(--card);padding:10px 4px;border-top:1px solid var(--line);align-items:center;justify-content:space-between;gap:10px;z-index:5;">
      <span id="linkModeCount" style="font-size:.85rem;color:var(--muted);"></span>
      <button class="btn" id="linkModeConnectBtn" disabled>🔗 선택 연결</button>
    </div>
  `;
  app.querySelector("#searchBox").addEventListener("input", renderBrowseList);
  app.querySelector("#linkModeConnectBtn").addEventListener("click", ()=>{
    if(linkSelected.size<2) return;
    linkGroup([...linkSelected]);
    linkSelected = new Set();
    renderBrowseList();
  });
  app.querySelector("#yearFilterPill").addEventListener("click", ()=> openBrowseFilterModal("year"));
  app.querySelector("#unitFilterPill").addEventListener("click", ()=> openBrowseFilterModal("unit"));
  const tagClearBtn = app.querySelector("#tagFilterClear");
  if(tagClearBtn) tagClearBtn.addEventListener("click", ()=>{ browseTagSelected = null; renderBrowseView(); });
  updateFilterPillLabels();
  renderBrowseList();
}

function renderBrowseList(){
  const kw = (document.getElementById("searchBox").value || "").trim().toLowerCase();
  const data = getData();
  const freqMap = questionFrequencyMap(data);
  const recMap = questionRecencyMap(data);
  let list = data.slice();
  if(browseYearSelected.size) list = list.filter(c=> browseYearSelected.has(c.year + "-" + (c.round||1)));
  if(browseUnitMinorSelected.size) list = list.filter(c=> browseUnitMinorSelected.has(c.unitMinor));
  else if(browseUnitSelected.size) list = list.filter(c=> browseUnitSelected.has(c.unitMajor));
  if(browseTagSelected) list = list.filter(c=> (c.tags||[]).includes(browseTagSelected));
  if(kw) list = list.filter(c=> (c.question+c.answer+(c.note||"")+" "+(c.tags||[]).join(" ")).toLowerCase().includes(kw));
  // 공통 정렬 기준: 중복 출제빈도 높은 순 → 동일 빈도면 최근 출제 문제 순
  list.sort((a,b)=>{
    const fa = freqMap[a.id]||1, fb = freqMap[b.id]||1;
    if(fb !== fa) return fb - fa;
    const ra = recMap[a.id]||{year:a.year||0,round:a.round||0}, rb = recMap[b.id]||{year:b.year||0,round:b.round||0};
    if(rb.year !== ra.year) return rb.year - ra.year;
    return (rb.round||0) - (ra.round||0);
  });

  document.getElementById("browseCount").textContent = `${list.length}문항 표시 중`;
  const container = document.getElementById("browseList");
  if(!list.length){
    container.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div>검색 결과가 없습니다.</div>`;
    updateLinkModeBar();
    return;
  }
  container.innerHTML = list.map(c=>{
    const st = store.progress[c.id];
    let pill = `<span class="stat-pill new">미학습</span>`;
    if(st && st.history && st.history.length){
      const last = st.history[st.history.length-1];
      pill = last.score>=75 ? `<span class="stat-pill correct">정답 처리</span>` : `<span class="stat-pill wrong">오답 처리</span>`;
    }
    const freq = freqMap[c.id] || 1;
    const freqPill = `<span class="stat-pill freq">${freqStars(freq)}</span>`;
    let checkboxHtml = "";
    if(linkModeActive){
      const preLinked = getManualLinks(c.id).length > 0;
      const checked = linkSelected.has(c.id);
      // 이미 연결된 문항도 체크박스로 선택해 다른 문항과 새로 묶을 수 있도록 하고,
      // 해제는 별도의 작은 "연결됨" 배지를 눌렀을 때만 확인 후 진행한다.
      checkboxHtml = `<span class="link-check" title="탭해서 선택">${checked?'✅':'⬜'}${preLinked?` <small data-unlink="${c.id}" title="눌러서 연결 해제">연결됨 ✕</small>`:''}</span>`;
    }
    return `
      <div class="card-list-item ${linkModeActive?'link-mode':''}" data-id="${c.id}">
        ${checkboxHtml}
        <div class="row1">
          <span>${c.year}년${c.round?" "+c.round+"회":""} · ${c.unitMajor}${c.unitMinor ? " · "+c.unitMinor : ""}</span>
          <span>${freqPill}${pill}</span>
        </div>
        <div class="q-preview">${(c.images&&c.images.length) ? "🖼️ " : ""}${escapeHtml(previewText(c.question))}</div>
        ${renderTagChips(c)}
      </div>`;
  }).join("");
  container.querySelectorAll(".card-list-item").forEach(el=>{
    el.addEventListener("click", (e)=>{
      const unlinkTarget = e.target.closest && e.target.closest("[data-unlink]");
      if(linkModeActive && unlinkTarget){
        onLinkModeUnlinkTap(unlinkTarget.dataset.unlink);
        return;
      }
      const checkTarget = e.target.closest && e.target.closest(".link-check");
      if(linkModeActive && checkTarget){
        onLinkModeCardTap(el.dataset.id);
        return;
      }
      const tagTarget = e.target.closest && e.target.closest(".tag-chip[data-tag]");
      if(tagTarget){ openTagBrowse(tagTarget.dataset.tag); return; }
      openCardModal(el.dataset.id);
    });
  });
  updateLinkModeBar();
}

/* ---- 연결 모드: 카드 탭 처리 (이미 연결된 문항도 선택해 다른 그룹과 새로 묶을 수 있다) ---- */
function onLinkModeCardTap(id){
  if(linkSelected.has(id)) linkSelected.delete(id);
  else linkSelected.add(id);
  renderBrowseList();
}
/* ---- 연결 모드: "연결됨" 배지를 탭했을 때만 그룹 해제 ---- */
function onLinkModeUnlinkTap(id){
  if(!confirm("이 문항을 연결된 그룹에서 해제할까요?")) return;
  clearManualLinks(id);
  linkSelected.delete(id);
  renderBrowseList();
}
function updateLinkModeBar(){
  const bar = document.getElementById("linkModeBar");
  if(!bar) return;
  if(!linkModeActive){ bar.style.display = "none"; return; }
  bar.style.display = "flex";
  const count = linkSelected.size;
  document.getElementById("linkModeCount").textContent = count>=2 ? `${count}개 선택됨` : "2개 이상 선택하면 연결할 수 있어요";
  document.getElementById("linkModeConnectBtn").disabled = count<2;
}

function openCardModal(id){
  const c = getData().find(d=>d.id===id);
  if(!c) return;
  const isBookmarked = !!store.bookmarks[id];
  const kwHtml = (c.keywords&&c.keywords.length) ? `<div class="kw-list">핵심 키워드 참고: ${c.keywords.map(k=>`<span class="kw hit">${k}</span>`).join("")}</div>` : "";
  const noteHtml = c.note ? `<div class="note-box">${escapeHtml(c.note)}</div>` : "";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <div class="card-head" style="padding-right:24px;">
        <h3>${c.year}년${c.round?" "+c.round+"회":""} · ${c.unitMajor}${c.unitMinor ? " · "+c.unitMinor : ""}${c.points?` · ${c.points}점`:""}</h3>
        <button class="edit-mini" id="modalEditBtn">✏️ 수정</button>
      </div>
      ${renderTextWithImages(c.question, c.images, c.answer)}
      <div class="answer-reveal qa-box" style="margin-top:14px;"><span class="qa-label answer">정답</span>${inlineImagesOnly(c.answer, c.images)}</div>
      ${noteHtml}
      ${kwHtml}
      ${renderTagChips(c)}
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn star ${isBookmarked?'active':''}" id="modalStarBtn">${isBookmarked?'★ 즐겨찾기됨':'☆ 즐겨찾기'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  bindTagChips(overlay);
  const stopSpeaking = ()=>{ if("speechSynthesis" in window) speechSynthesis.cancel(); };
  overlay.querySelector(".close-x").addEventListener("click", ()=>{ stopSpeaking(); overlay.remove(); });
  let mouseDownOnOverlay39 = false;
  overlay.addEventListener("mousedown", e=>{ mouseDownOnOverlay39 = (e.target===overlay); });
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay && mouseDownOnOverlay39){ stopSpeaking(); overlay.remove(); } mouseDownOnOverlay39 = false; });
  overlay.querySelector("#modalStarBtn").addEventListener("click", ()=>{
    toggleBookmark(id);
    stopSpeaking();
    overlay.remove();
    openCardModal(id);
  });
  overlay.querySelector("#modalEditBtn").addEventListener("click", ()=>{
    stopSpeaking();
    overlay.remove();
    openEditModal(id, ()=>{ openCardModal(id); renderBrowseList(); });
  });
}

/* ---- 문제/정답/이미지 수정 ---- */
function openEditModal(id, onSaved){
  const original = getData().find(d=>d.id===id);
  if(!original) return;
  let workingImages = (original.images || []).slice();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const renderPreview = ()=>{
    if(!workingImages.length) return `<div class="no-image">이미지 없음</div>`;
    return `<div class="edit-image-grid">${workingImages.map((im,idx)=>{
      const src = imgSrc(im);
      return `<div class="edit-image-item">
        <img src="${src||''}" class="q-image">
        <button type="button" class="edit-image-del" data-idx="${idx}">✕</button>
        <div class="edit-image-tools">
          <button type="button" class="mini-btn" data-crop="${idx}">✂️ 자르기</button>
          <button type="button" class="mini-btn" data-insq="${idx}">문제에 삽입</button>
          <button type="button" class="mini-btn" data-insa="${idx}">정답에 삽입</button>
        </div>
      </div>`;
    }).join("")}</div>`;
  };
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>문제 수정</h3>
      <div class="edit-field">
        <label>문제 <small style="font-weight:400;color:var(--muted);">(이미지 삽입 위치에 {{img:번호}} 표시가 자동으로 들어갑니다)</small></label>
        <textarea class="edit-textarea" id="editQuestion">${escapeHtml(original.question)}</textarea>
      </div>
      <div class="edit-field">
        <label>정답 · 해설</label>
        <textarea class="edit-textarea" id="editAnswer">${escapeHtml(original.answer)}</textarea>
      </div>
      <div class="edit-field">
        <label>키워드 <small style="font-weight:400;color:var(--muted);">(쉼표 , 로 구분해서 입력)</small></label>
        <input type="text" class="search-box" id="editTags" placeholder="예: 시멘트, 혼화재료" value="${escapeHtml((original.tags||[]).join(', '))}">
      </div>
      <div class="edit-field">
        <label>단원 <small style="font-weight:400;color:var(--muted);">(자동 분류가 틀렸으면 여기서 바로 고칠 수 있어요)</small></label>
        <div class="btn-row" style="gap:8px;">
          <select class="search-box" id="editUnitMajor" style="flex:1;">
            ${unitMajorList().map(m=>`<option value="${escapeHtml(m)}" ${m===original.unitMajor?'selected':''}>${escapeHtml(m)}</option>`).join("")}
          </select>
          <select class="search-box" id="editUnitMinor" style="flex:1;"></select>
        </div>
      </div>
      <div class="edit-field">
        <label>이미지 (<span id="editImageCount">${workingImages.length}</span>장)</label>
        <div id="editImagePreview">${renderPreview()}</div>
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn ghost" id="editImageUpload">이미지 추가</button>
          <button class="btn ghost" id="editImageRemove" style="color:var(--rose);border-color:var(--rose);">전체 삭제</button>
        </div>
        <input type="file" accept="image/*" id="editImageFile" multiple style="display:none;">
      </div>
      <div class="btn-row" style="margin-top:18px;">
        <button class="btn ghost" id="editCancel">취소</button>
        <button class="btn primary" id="editSave">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#editCancel").addEventListener("click", close);
  // 드래그로 텍스트를 선택하다가 마우스를 모달 바깥(배경)에서 놓아도 닫히지 않도록,
  // mousedown과 click(=mouseup 시점)이 둘 다 배경 자체일 때만 닫는다.
  let mouseDownOnOverlay = false;
  overlay.addEventListener("mousedown", e=>{ mouseDownOnOverlay = (e.target===overlay); });
  overlay.addEventListener("click", e=>{ if(e.target===overlay && mouseDownOnOverlay) close(); mouseDownOnOverlay = false; });

  const refreshPreview = ()=>{
    overlay.querySelector("#editImagePreview").innerHTML = renderPreview();
    const countEl = overlay.querySelector("#editImageCount");
    if(countEl) countEl.textContent = workingImages.length;
    overlay.querySelectorAll(".edit-image-del").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = Number(btn.dataset.idx);
        const qTa = overlay.querySelector("#editQuestion");
        const aTa = overlay.querySelector("#editAnswer");
        if(qTa) qTa.value = stripImgPlaceholder(qTa.value, idx);
        if(aTa) aTa.value = stripImgPlaceholder(aTa.value, idx);
        workingImages.splice(idx, 1);
        refreshPreview();
      });
    });
    overlay.querySelectorAll("[data-crop]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const idx = Number(btn.dataset.crop);
        const src = imgSrc(workingImages[idx]);
        if(!src) return;
        openCropTool(src, (cropped)=>{
          workingImages[idx] = cropped;
          refreshPreview();
        });
      });
    });
    overlay.querySelectorAll("[data-insq]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        insertAtCursor(overlay.querySelector("#editQuestion"), `{{img:${btn.dataset.insq}}}`);
      });
    });
    overlay.querySelectorAll("[data-insa]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        insertAtCursor(overlay.querySelector("#editAnswer"), `{{img:${btn.dataset.insa}}}`);
      });
    });
  };
  refreshPreview();

  const majorSel = overlay.querySelector("#editUnitMajor");
  const minorSel = overlay.querySelector("#editUnitMinor");
  const fillMinorOptions = (major, preferMinor)=>{
    const minors = unitMinorsOf(major);
    const keep = minors.includes(preferMinor) ? preferMinor : minors[0];
    minorSel.innerHTML = minors.map(m=>`<option value="${escapeHtml(m)}" ${m===keep?'selected':''}>${escapeHtml(m)}</option>`).join("");
  };
  fillMinorOptions(original.unitMajor, original.unitMinor);
  majorSel.addEventListener("change", ()=> fillMinorOptions(majorSel.value, null));

  const fileInput = overlay.querySelector("#editImageFile");
  overlay.querySelector("#editImageUpload").addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", async ()=>{
    const files = Array.from(fileInput.files || []);
    if(!files.length) return;
    fileInput.disabled = true;
    const uploadBtn = overlay.querySelector("#editImageUpload");
    if(uploadBtn){ uploadBtn.disabled = true; uploadBtn.textContent = "이미지 처리 중..."; }
    try{
      // Promise.all로 병렬 처리하면 파일마다 압축 완료 순서가 뒤섞여 이미지 순서가 흔들릴 수 있어
      // 업로드한 순서를 그대로 유지하도록 순차적으로 압축한다.
      for(const file of files){
        const compressed = await compressImageFile(file);
        if(compressed) workingImages.push(compressed);
      }
    }finally{
      fileInput.disabled = false;
      if(uploadBtn){ uploadBtn.disabled = false; uploadBtn.textContent = "이미지 추가"; }
      refreshPreview();
      fileInput.value = ""; // 같은 파일을 다시 선택해도 change 이벤트가 재발생하도록 초기화
    }
  });
  overlay.querySelector("#editImageRemove").addEventListener("click", ()=>{
    const qTa = overlay.querySelector("#editQuestion");
    const aTa = overlay.querySelector("#editAnswer");
    if(qTa) qTa.value = qTa.value.replace(/\{\{img:\d+\}\}/g, "");
    if(aTa) aTa.value = aTa.value.replace(/\{\{img:\d+\}\}/g, "");
    workingImages = [];
    refreshPreview();
  });

  overlay.querySelector("#editSave").addEventListener("click", ()=>{
    const qText = overlay.querySelector("#editQuestion").value.trim();
    const aText = overlay.querySelector("#editAnswer").value.trim();
    if(!qText || !aText){ alert("문제와 정답을 모두 입력해주세요."); return; }
    if(!store.edits) store.edits = {};
    const dupIds = findDuplicateIds(id);
    let targets = [id];
    if(dupIds.length){
      const applyAll = confirm(`이 문제는 중복 출제된 문제가 ${dupIds.length}개 더 있습니다.\n중복된 문제도 모두 함께 수정할까요?\n\n확인: 중복 문제 모두 수정\n취소: 이 문제만 수정`);
      if(applyAll) targets = targets.concat(dupIds);
    }
    const tagsText = overlay.querySelector("#editTags").value || "";
    const tagsArr = tagsText.split(",").map(t=>t.trim()).filter(Boolean).slice(0,6);
    const newUnitMajor = overlay.querySelector("#editUnitMajor").value;
    const newUnitMinor = overlay.querySelector("#editUnitMinor").value;
    targets.forEach(tid=>{
      store.edits[tid] = {question:qText, answer:aText, images:workingImages, tags:tagsArr, unitMajor:newUnitMajor, unitMinor:newUnitMinor};
    });
    const ok = saveStore();
    if(!ok) return; // 저장 실패 시 편집창을 닫지 않고 이미지를 줄여 재시도할 수 있게 유지
    close();
    toast(targets.length>1 ? `중복 문제 ${targets.length}개를 함께 수정했습니다` : "저장되었습니다");
    if(onSaved) onSaved();
  });
}

/* ---- 이미지 삭제 시 본문에 남는 {{img:N}} 표시 정리 ---- */
function stripImgPlaceholder(text, removedIdx){
  if(!text) return text;
  return text.replace(/\{\{img:(\d+)\}\}/g, (m, numStr)=>{
    const n = Number(numStr);
    if(n === removedIdx) return "";
    if(n > removedIdx) return `{{img:${n-1}}}`;
    return m;
  });
}

/* ---- 커서 위치에 텍스트 삽입 ---- */
function insertAtCursor(textarea, text){
  const start = textarea.selectionStart, end = textarea.selectionEnd;
  const val = textarea.value;
  textarea.value = val.slice(0,start) + text + val.slice(end);
  const pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
}

/* ---- 이미지 자르기 도구 (드래그로 영역 선택 후 자르기) ---- */
function openCropTool(src, onApply){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay crop-overlay";
  overlay.innerHTML = `
    <div class="modal-box crop-box">
      <span class="close-x">✕</span>
      <h3>이미지 자르기</h3>
      <p style="font-size:0.78rem;color:var(--muted);">남길 영역을 드래그해서 선택한 뒤 적용하세요.</p>
      <div class="crop-canvas-wrap" id="cropWrap">
        <img id="cropImg" src="${src}" draggable="false">
        <div class="crop-rect" id="cropRect"></div>
      </div>
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn ghost" id="cropReset">전체 선택</button>
        <button class="btn ghost" id="cropCancel">취소</button>
        <button class="btn primary" id="cropApply">자르기 적용</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const wrap = overlay.querySelector("#cropWrap");
  const rectEl = overlay.querySelector("#cropRect");
  const imgEl = overlay.querySelector("#cropImg");
  let rect = {x:0.05, y:0.05, w:0.9, h:0.9};
  const drawRect = ()=>{
    rectEl.style.left = (rect.x*100)+"%";
    rectEl.style.top = (rect.y*100)+"%";
    rectEl.style.width = (rect.w*100)+"%";
    rectEl.style.height = (rect.h*100)+"%";
  };
  imgEl.addEventListener("load", drawRect);
  drawRect();

  let dragging=false, startPt=null;
  const ptFromEvent = (e)=>{
    const r = wrap.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    return { x: Math.min(Math.max((cx-r.left)/r.width,0),1), y: Math.min(Math.max((cy-r.top)/r.height,0),1) };
  };
  const onDown = (e)=>{ dragging=true; startPt = ptFromEvent(e); rect = {x:startPt.x,y:startPt.y,w:0,h:0}; drawRect(); };
  const onMove = (e)=>{
    if(!dragging) return;
    const p = ptFromEvent(e);
    rect.x = Math.min(startPt.x, p.x); rect.y = Math.min(startPt.y, p.y);
    rect.w = Math.abs(p.x-startPt.x); rect.h = Math.abs(p.y-startPt.y);
    drawRect();
  };
  const onUp = ()=>{ dragging=false; };
  wrap.addEventListener("mousedown", onDown);
  wrap.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  wrap.addEventListener("touchstart", onDown, {passive:true});
  wrap.addEventListener("touchmove", onMove, {passive:true});
  wrap.addEventListener("touchend", onUp);

  const close = ()=>{
    wrap.removeEventListener("mousedown", onDown);
    wrap.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    overlay.remove();
  };
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#cropCancel").addEventListener("click", close);
  overlay.querySelector("#cropReset").addEventListener("click", ()=>{ rect = {x:0,y:0,w:1,h:1}; drawRect(); });
  overlay.querySelector("#cropApply").addEventListener("click", ()=>{
    if(rect.w<0.02 || rect.h<0.02){ alert("자를 영역을 드래그해서 선택해주세요."); return; }
    const natW = imgEl.naturalWidth, natH = imgEl.naturalHeight;
    const sx = rect.x*natW, sy = rect.y*natH, sw = rect.w*natW, sh = rect.h*natH;
    // 잘라낸 영역이 표준 상한(IMAGE_STD_MAXDIM)보다 크면 축소해서 저장한다.
    let outW = Math.max(1,Math.round(sw)), outH = Math.max(1,Math.round(sh));
    if(outW > IMAGE_STD_MAXDIM || outH > IMAGE_STD_MAXDIM){
      const scale = IMAGE_STD_MAXDIM / Math.max(outW, outH);
      outW = Math.max(1, Math.round(outW * scale));
      outH = Math.max(1, Math.round(outH * scale));
    }
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    // WebP로 압축 저장(용량 절감). 브라우저가 WebP 인코딩을 지원하지 않으면 PNG로 자동 폴백.
    let dataUrl = canvas.toDataURL("image/webp", IMAGE_STD_QUALITY);
    if(!dataUrl.startsWith("data:image/webp")){ dataUrl = canvas.toDataURL("image/png"); }
    onApply(dataUrl);
    close();
  });
}



/* ---- 앱 소개 · 오픈톡 ---- */
function renderAbout(){
  const cfg = activeExamConfig();
  /* 예전에 저장된 examConfig(store)에는 openTalks 필드가 없을 수 있으므로,
     저장된 설정에 없으면 앱 기본 EXAM_CONFIG의 오픈톡 링크를 대신 보여준다. */
  const openTalks = (cfg.openTalks && cfg.openTalks.length) ? cfg.openTalks : EXAM_CONFIG.openTalks;
  const data = getData();
  const years = [...new Set(data.map(d=>d.year))].sort();
  setPageBar("어플 소개");
  app.innerHTML = `
    <div class="section-card">
      <h3>${escapeHtml(cfg.titleText)}</h3>
      <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-top:8px;">
        총 ${data.length}문항 · ${years[0]}–${years[years.length-1]} 기출 수록<br>
        연도별·단원별·빈도순 학습, 실전 모의고사, 오답노트, SRS 복습, 즐겨찾기, 전체 문제 검색 기능을 제공합니다.
      </p>
    </div>
    <div class="section-card">
      <h3>오픈채팅방</h3>
      <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;">함께 공부하는 사람들과 정보를 나눠보세요.</p>
      ${(openTalks && openTalks.length) ? openTalks.map(t=>`
        <a class="btn primary" style="display:block;text-align:center;text-decoration:none;margin-top:12px;" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.label||"오픈채팅 참여하기")}</a>
      `).join("") : (cfg.openTalkUrl || EXAM_CONFIG.openTalkUrl ? `
        <a class="btn primary" style="display:block;text-align:center;text-decoration:none;margin-top:12px;" href="${cfg.openTalkUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(cfg.openTalkLabel||"오픈채팅 참여하기")}</a>
      ` : `
        <div class="note-box" style="margin-top:12px;">아직 등록된 오픈채팅방 링크가 없습니다.</div>
      `)}
    </div>
    <div class="section-card">
      <p style="font-size:0.78rem;color:var(--muted);line-height:1.7;">
        개인 공부 목적으로 인터넷상의 자료를 기반으로 만든 어플이며 상업적 목적으로 이용을 금합니다.<br>
        또한 자료 정확도에 대한 어떠한 책임도 지지않습니다.<br>
        개선 및 수정, 저작권 관련 삭제 요청은 아래 메일로 연락 주세요.<br>
        E-mail : smckwz@gmail.com
      </p>
    </div>
  `;
}

function render(){
  headerMeta();
  clearPageBar();
  if(state.view==="home") renderHome();
  else if(state.view==="unit") renderUnitPicker();
  else if(state.view==="year") renderYearPicker();
  else if(state.view==="wrong") renderWrongList();
  else if(state.view==="bookmark") renderBookmarkList();
  else if(state.view==="srs") renderSRSList();
  else if(state.view==="freq") renderFreqList();
  else if(state.view==="exam") renderExamIntro();
  else if(state.view==="settings") renderSettings();
  else if(state.view==="card") renderCard();
  else if(state.view==="browse") renderBrowseView();
  else if(state.view==="about") renderAbout();
}

applyExamConfig();

/* ---- 이미지 확대 보기: cardBox(학습카드)는 자체 제스처 처리기에서 이미 처리하므로 제외하고,
      그 외 모든 화면(모의고사 응시/채점, 전체목록 상세 등)에서 이미지 탭 시 확대되도록 전역 위임 처리 ---- */
document.addEventListener("click", (e)=>{
  const img = e.target.closest && e.target.closest("img.q-image");
  if(!img) return;
  if(img.closest("#cardBox")) return; // 학습카드 화면은 attachCardGestures에서 처리
  openImageZoom(img.src);
});

render();
