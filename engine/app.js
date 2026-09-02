/* ============ 앱 버전 & 출력 파일명 — 절대 누락 금지 ============
   [1] 화면 제목 옆 버전 표시: "버전 번호"가 아니라 "수정 시각 타임스탬프"를 버전처럼 쓴다.
       형식: YYYY.MM.DD_HH:MM (24시간제, 예: 2026.08.24_05:46 = 2026년 8월 24일 5시 46분)
       화면에는 "Ver. " 접두어를 붙여 "Ver. YYYY.MM.DD_HH:MM" 형태로 표시한다.
       파일을 새로 수정/생성할 때마다 이 값을 그 시점의 타임스탬프로 반드시 교체할 것.
   [2] 파일명 규칙 (2026.08.24 확정, 반드시 지킬 것):
       - 엔진:   {자격증명}_엔진_{yyyymmdd_hhmm}.html   예) 건축기사_엔진_20260824_0546.html
       - 데이터: {자격증명}_data_{yyyymmdd_hhmm}.json   예) 건축기사_data_20260824_0546.json
       - 배포본: {자격증명}_배포본_{yyyymmdd_hhmm}.html 예) 방수산업기사_배포본_20260824_0546.html
       세 가지 다 파일을 건드릴 때마다 이 주석부터 확인할 것.
   [3] 엔진 수정 후에는 곧바로 배포본을 만들지 말고, 무엇을 고쳤는지 먼저 설명하고
       사용자 컨펌을 받은 뒤에만 배포본(들)을 새로 만든다. */
const APP_VERSION = "2026.08.26_23:06";

/* ============ 강제 업데이트 임계값 ============
   평소엔 빈 문자열("")로 둔다 — 이 경우 새 버전이 나와도 사용자가 원할 때 눌러서
   새로고침하는 '일반 배너'만 뜬다(아래 새 버전 자동 감지 로직 참고).
   문제 ID 구조 변경, 채점 로직 변경 등 "옛날 캐시로 계속 쓰면 DB와 충돌/오작동할 수 있는"
   치명적 배포를 할 때만, 이 값을 그 배포의 APP_VERSION과 동일한 문자열로 채워서 커밋한다.
   그러면 이 값보다 낮은(=이 배포 이전) APP_VERSION을 가진 클라이언트는 배너를 닫을 수 없고
   몇 초 뒤 자동으로 새로고침된다. 이후 커밋에서는 다시 ""로 되돌려 평소 상태로 복귀시킨다.
   (버전 문자열이 YYYY.MM.DD_HH.MM 형식으로 항상 자릿수가 고정돼 있어 문자열 비교만으로
   시간 순서 비교가 가능하다.) */
const FORCE_UPDATE_MIN_VERSION = "";

/* ============ PWA 설치(앱처럼 구동) ============ */
try{
(function(){
  // "OO산업기사", "OO기사"처럼 끝에 직함이 붙은 이름에서 핵심 단어만 뽑아낸다.
  // 홈 화면 아이콘/설치명은 표시 폭이 좁아서 markText 전체를 쓰면 (특히 "방수산업기사" 같은
  // 6글자 이상 이름) 글자가 잘려 보이는 문제가 있었음. 예: 건축기사→건축, 방수산업기사→방수, 산업안전기사→산업안전
  function shortMarkOf(markText){
    if(!markText) return "필답";
    if(markText.endsWith("산업기사")) return markText.slice(0, -4);
    if(markText.endsWith("기사")) return markText.slice(0, -2);
    return markText.slice(0, 4);
  }

  // 1) 아이콘을 캔버스로 즉석 생성 (별도 이미지 파일 없이 매니페스트에 사용)
  function buildIcon(size){
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f3d3e';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#d98e3f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 메인 글자(예: "건축", "산업안전")는 길이에 따라 폭을 넘지 않도록 폰트 크기를 자동으로 줄인다.
    // (2글자 기준 30%로 그리면 4글자짜리는 아이콘 밖으로 삐져나가는 문제가 있었음)
    const mainText = shortMarkOf(typeof EXAM_CONFIG !== "undefined" ? EXAM_CONFIG.markText : null);
    const maxTextWidth = size * 0.86; // 좌우 여백 확보
    let fontPct = 0.30;
    ctx.font = 'bold ' + Math.round(size * fontPct) + 'px sans-serif';
    while (ctx.measureText(mainText).width > maxTextWidth && fontPct > 0.12) {
      fontPct -= 0.02;
      ctx.font = 'bold ' + Math.round(size * fontPct) + 'px sans-serif';
    }
    ctx.fillText(mainText, size / 2, size * 0.42);

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
      id: location.pathname.replace(/[^/]*$/, ''), // 자격증별 폴더 경로를 앱 식별자로 사용 → 크롬이 서로 다른 앱으로 확실히 구분
      name: (typeof EXAM_CONFIG !== "undefined" && EXAM_CONFIG.titleText) ? EXAM_CONFIG.titleText : "자격증 필답 노트",
      short_name: shortMarkOf(typeof EXAM_CONFIG !== "undefined" ? EXAM_CONFIG.markText : null) + "노트",
      start_url: location.origin + location.pathname + location.search,
      scope: location.origin + location.pathname.replace(/[^/]*$/, ''),
      display: "standalone",
      orientation: "portrait",
      background_color: "#faf7f0",
      theme_color: "#243c3d",
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
  // PWA 설치 관련 기능은 "있으면 좋은" 부가 기능이라, 여기서 예외가 나더라도
  // 아래에 이어지는 학습 앱 본 기능(store 초기화 등)이 절대 멈추면 안 된다.
  let installBtn, isStandalone, isIOS, deferredPrompt = null;
  try {
    installBtn = document.getElementById('installBtn');
    isStandalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  } catch(e) { installBtn = null; isStandalone = true; isIOS = false; }

  if(installBtn && !isStandalone){
    if(isIOS){
      // iOS Safari는 beforeinstallprompt를 지원하지 않으므로 안내 문구로 대체
      installBtn.style.display = 'flex';
      installBtn.textContent = '📲 홈 화면에 추가';
      installBtn.addEventListener('click', function(){
        alert('Safari 하단 공유 버튼(⬆️)을 누른 뒤\n"홈 화면에 추가"를 선택하면 앱처럼 설치돼요.');
      });
    } else {
      // 크롬은 같은 origin에서 PWA를 하나 설치하고 나면(다른 자격증이라도) 스팸 방지 차원에서
      // beforeinstallprompt를 한동안 다시 안 보내는 경우가 있다. 그 이벤트가 안 와도 버튼 자체는
      // 항상 눌러볼 수 있게 보여주고, 자동 설치가 불가능하면 수동 설치 방법을 안내하는 것으로 대체한다.
      window.addEventListener('beforeinstallprompt', function(e){
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'flex';
        installBtn.textContent = '📲 앱 설치';
      });
      // beforeinstallprompt가 안 오더라도 잠시 후 버튼은 일단 보여준다 (수동 안내로 동작)
      setTimeout(function(){
        if(installBtn.style.display !== 'flex'){
          installBtn.style.display = 'flex';
          installBtn.textContent = '📲 홈 화면에 추가';
        }
      }, 2500);
      installBtn.addEventListener('click', async function(){
        if(deferredPrompt){
          installBtn.disabled = true;
          deferredPrompt.prompt();
          try{ await deferredPrompt.userChoice; }catch(e){}
          deferredPrompt = null;
          installBtn.style.display = 'none';
          installBtn.disabled = false;
        } else {
          // 자동 설치 팝업이 뜨지 않는 상황(이미 다른 자격증을 설치해서 크롬이 잠시 억제 중인 경우 등)
          alert('이미 이 사이트의 다른 앱(My도전 허브 등)을 설치하셨다면, 크롬이 이 페이지를 "이미 설치된 앱의 일부"로 인식해서 자동 설치 팝업을 안 띄운 것일 수 있어요.\n\n→ 브라우저 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"를 눌러 수동으로 설치해보세요. 그래도 안 되면, 이미 설치된 다른 앱을 먼저 지우고 이 자격증을 먼저 설치한 뒤 나머지를 설치하는 순서로 해보시면 됩니다.');
        }
      });
      window.addEventListener('appinstalled', function(){
        installBtn.style.display = 'none';
        deferredPrompt = null;
      });
    }
  }
})();
}catch(e){ console.warn("PWA 설치 기능 초기화 실패(앱 본 기능에는 영향 없음):", e); }

/* ============ 자격증 설정 ============ */
/* 새 자격증 앱을 만들 때는 이 EXAM_CONFIG와 아래 SAMPLE_DATA만 교체하면 됩니다. */
/* EXAM_CONFIG provided by data.js (loaded before app.js) */

/* ============ 건축기사 실기 기출문제 데이터 (2011~2026, 1,281문항) ============ */
/* IMAGES provided by data.js (loaded before app.js) */
let customImages = {};
/* 사진 여러 장을 그대로 base64로 저장하면 localStorage 용량(약 5~10MB)을 금방 초과해
   "저장 안됨" 현상이 생긴다. 업로드 시 가로/세로 최대 1600px, JPEG 품질 0.82로 리사이즈·재압축해
   1장당 용량을 크게 줄인다. */
/* 이미지 저장 표준 기준(2026.08.07 확정): 최대 변 1000px, WebP, 품질 0.82
   — 새로 추가하는 이미지와 크롭 이미지 모두 이 기준을 따른다. */
const IMAGE_STD_MAXDIM = 1000;
const IMAGE_STD_QUALITY = 0.82;
/* ============ 외부에서 들어오는 문제 데이터의 이미지 표준 강제(가드) ============
   앱 안에서 직접 업로드/드래그앤드롭/붙여넣기/자르기로 넣는 이미지는 이미 compressImageFile()·
   자르기 도구가 표준(WebP, 최대 1000px, 품질 0.82)을 지킨다. 하지만 "③ 데이터 병합"이나
   "백업 불러오기"로 외부 JSON 파일을 통째로 가져오는 경우엔 그 파일 안의 이미지가 이 표준을
   벗어났을 수 있으므로(고해상도 원본, PNG 등), 가져오는 시점에 한 번 더 검사해서 기준을
   벗어난 이미지만 자동으로 재압축한다.
   기준을 넘는지 판단하는 두 조건: ①WebP가 아니거나, ②용량이 IMAGE_STD_MAX_BYTES 초과 */
const IMAGE_STD_MAX_BYTES = 45 * 1024; // 이 크기를 넘으면 표준을 벗어난 것으로 보고 재압축
function normalizeImageDataUrl(dataUrl){
  return new Promise((resolve)=>{
    if(!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")){
      resolve({dataUrl, changed:false});
      return;
    }
    const isWebp = dataUrl.startsWith("data:image/webp");
    const approxBytes = Math.floor(dataUrl.length * 0.75); // base64 → 대략적인 실제 바이트 수
    if(isWebp && approxBytes <= IMAGE_STD_MAX_BYTES){
      resolve({dataUrl, changed:false}); // 이미 표준 이내면 디코딩할 필요 없이 그대로 통과(속도)
      return;
    }
    const img = new Image();
    img.onload = ()=>{
      let { width, height } = img;
      if(width > IMAGE_STD_MAXDIM || height > IMAGE_STD_MAXDIM){
        const scale = IMAGE_STD_MAXDIM / Math.max(width, height);
        width = Math.round(width*scale);
        height = Math.round(height*scale);
      }
      try{
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        let out = canvas.toDataURL("image/webp", IMAGE_STD_QUALITY);
        if(!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/png");
        // 재압축 결과가 오히려 더 크면(이미 작고 단순한 이미지 등) 원본을 그대로 유지
        resolve(out.length < dataUrl.length ? {dataUrl: out, changed:true} : {dataUrl, changed:false});
      }catch(e){
        resolve({dataUrl, changed:false});
      }
    };
    img.onerror = ()=> resolve({dataUrl, changed:false});
    img.src = dataUrl;
  });
}
/* 문제 목록 전체를 훑어 기준 초과 이미지를 재압축하고, 통계(검사수·변경수·용량 절감)를 반환한다. */
async function normalizeDataListImages(list){
  let checked = 0, changedCount = 0, bytesBefore = 0, bytesAfter = 0;
  for(const q of list){
    if(!q.images || !q.images.length) continue;
    for(let i=0;i<q.images.length;i++){
      const src = q.images[i];
      if(!src || typeof src !== "string" || !src.startsWith("data:image/")) continue;
      checked++;
      bytesBefore += src.length;
      const {dataUrl, changed} = await normalizeImageDataUrl(src);
      bytesAfter += dataUrl.length;
      if(changed){ q.images[i] = dataUrl; changedCount++; }
    }
  }
  return {checked, changedCount, bytesBefore, bytesAfter};
}
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

/* SAMPLE_DATA provided by data.js (loaded before app.js) */

/* ============ 저장소 (localStorage) ============ */
const TAG_GROUP = {"골재": "콘크리트공사", "시멘트": "콘크리트공사", "혼화재": "재료", "AE제": "재료", "방청제": "재료", "감수제": "재료", "유동화제": "재료", "팽창재": "재료", "실리카퓸": "재료", "플라이애시": "재료", "고로슬래그": "재료", "잔골재율": "재료", "물시멘트비": "재료", "슬럼프": "재료", "공기량": "콘크리트공사", "압축강도": "재료", "인장강도": "재료", "흡수율": "재료", "단위중량": "재료", "알칼리골재반응": "재료", "염분함유량": "재료", "방수제": "재료", "방청도료": "재료", "복층유리": "재료", "로이유리": "재료", "강화유리": "재료", "접합유리": "재료", "자기질타일": "재료", "도기질타일": "재료", "화강암": "재료", "대리석": "재료", "테라조": "재료", "인조석": "재료", "실란트": "재료", "코킹": "재료", "단열재": "재료", "방음재": "재료", "방화재": "재료", "내화재료": "재료", "흙막이": "토공사", "어스앵커": "토공사", "시트파일": "토공사", "슬러리월": "토공사", "지하연속벽": "토공사", "언더피닝": "토공사", "보일링": "토공사", "히빙": "토공사", "파이핑": "토공사", "지반개량": "토공사", "웰포인트": "토공사", "샌드드레인": "토공사", "페이퍼드레인": "토공사", "동다짐": "토공사", "그라우팅": "토공사", "약액주입": "토공사", "표준관입시험": "토공사", "베인시험": "토공사", "평판재하시험": "토공사", "지내력시험": "토공사", "프리보링": "토공사", "SIP공법": "토공사", "PHC파일": "토공사", "강관파일": "토공사", "부마찰력": "토공사", "부동침하": "토공사", "동바리": "거푸집공사", "유로폼": "거푸집공사", "갱폼": "거푸집공사", "슬립폼": "거푸집공사", "슬라이딩폼": "거푸집공사", "트래블링폼": "거푸집공사", "콜드조인트": "철근콘크리트공사", "블리딩": "철근콘크리트공사", "레이턴스": "철근콘크리트공사", "크리프": "철근콘크리트공사", "건조수축": "철근콘크리트공사", "중성화": "철근콘크리트공사", "철근이음": "철근콘크리트공사", "겹침이음": "철근콘크리트공사", "가스압접": "철근콘크리트공사", "커플러": "철근콘크리트공사", "정착길이": "철근콘크리트공사", "배근": "철근콘크리트공사", "스터럽": "철근콘크리트공사", "띠철근": "철근콘크리트공사", "재료분리": "콘크리트공사", "균열": "철근콘크리트공사", "철근가공": "철근콘크리트공사", "콘크리트타설": "철근콘크리트공사", "콘크리트헤드": "콘크리트공사", "크리트헤드": "철근콘크리트공사", "화란식쌓기": "조적공사", "불식쌓기": "조적공사", "미식쌓기": "조적공사", "치장줄눈": "조적공사", "통줄눈": "조적공사", "막힌줄눈": "조적공사", "압착공법": "타일공사", "개량압착공법": "타일공사", "밀착공법": "타일공사", "떠붙임공법": "타일공사", "벤토나이트방수": "방수공사", "시멘트액체방수": "방수공사", "결로": "방수공사", "언더컷": "철골공사", "오버랩": "철골공사", "블로홀": "철골공사", "크레이터": "철골공사", "슬래그감싸들기": "철골공사", "토크관리법": "철골공사", "너트회전법": "철골공사", "초음파탐상법": "철골공사", "방사선투과법": "철골공사", "자기분말탐상법": "철골공사", "침투탐상법": "철골공사", "스터드용접": "철골공사", "데크플레이트": "철골공사", "스틱월": "창호및유리공사", "유닛월": "창호및유리공사", "윈도우월": "창호및유리공사", "PERT": "공정관리", "CPM": "공정관리", "주공정선": "공정관리", "여유시간": "공정관리", "자원배당": "공정관리", "간트차트": "공정관리", "파레토도": "품질관리", "특성요인도": "품질관리", "히스토그램": "품질관리", "체크시트": "품질관리", "산점도": "품질관리", "층별": "품질관리", "지명경쟁입찰": "계약제도", "일반경쟁입찰": "계약제도", "실비정산보수가산식": "계약제도", "정액도급": "계약제도", "단가도급": "계약제도", "BLT": "계약제도", "턴키": "계약제도", "성능발주방식": "계약제도", "온통기초": "구조", "독립기초": "구조", "복합기초": "구조", "전단벽": "구조", "내진설계": "구조", "프리스트레스트콘크리트": "구조", "이형철근": "구조", "슬래브": "구조", "캔틸레버": "구조", "반력": "구조역학", "전단력": "구조역학", "휨모멘트": "구조역학", "처짐": "구조역학", "좌굴": "구조역학", "단면2차모멘트": "구조역학", "트러스": "구조역학", "수준측량": "측량", "삼각측량": "측량", "평판측량": "측량", "등고선": "측량", "토탈스테이션": "측량", "GPS측량": "측량", "기초공사": "토공사", "레미콘": "콘크리트공사", "붙이기공법": "타일공사", "혼화재료": "콘크리트공사", "철근물량산출": "철근콘크리트공사", "네트워크공정표": "공정관리", "백화현상": "조적공사", "파이프구조": "철골공사", "벽돌쌓기순서": "조적공사", "공사계약방식": "계약제도", "비계": "가설공사", "타설이음부": "철근콘크리트공사", "VE": "공정관리", "비파괴검사": "철골공사", "피복두께": "철근콘크리트공사", "커튼월": "창호및유리공사", "입찰순서": "계약제도", "슬럼프기준": "콘크리트공사", "하절기콘크리트": "콘크리트공사", "지반개량공법": "토공사", "현장배합": "콘크리트공사", "용접부명칭": "철골공사", "외벽방수": "방수공사", "전단강도": "토공사", "시멘트저장": "콘크리트공사", "철물용어": "금속공사", "영식쌓기": "조적공사", "한중콘크리트": "콘크리트공사", "자원평준화": "공정관리", "도급방식": "계약제도", "진동다짐": "콘크리트공사", "측정기구": "토공사", "보일링현상": "토공사", "PDCA": "품질관리", "횡력보강": "목공사", "콘크리트명칭": "콘크리트공사", "할증률": "적산", "용접결함": "철골공사", "배합설계순서": "콘크리트공사", "벽돌수량": "적산", "철골중량": "적산", "레미콘규격": "콘크리트공사", "커튼월방식": "창호및유리공사", "콘크리트및거푸집량": "적산", "거푸집종류": "거푸집공사", "용접용어": "철골공사", "용접방식": "철골공사", "흙의연경도": "토공사", "샌드드레인공법": "토공사", "레미콘품질검사": "콘크리트공사", "BOT방식": "계약제도", "공간쌓기": "조적공사", "배합설계계산": "콘크리트공사", "창호용어": "창호및유리공사", "EVMS": "공정관리", "벽돌쌓기종류": "조적공사", "시트방수순서": "방수공사", "PS콘크리트": "콘크리트공사", "내화피복공법": "철골공사", "언더피닝공법": "토공사", "분말도시험법": "콘크리트공사", "옥상방수물량": "방수공사", "벽돌수량계산": "적산", "특수콘크리트분류": "콘크리트공사", "바닥돌깔기": "마감공사", "칼럼쇼트닝": "철골공사", "VE추진절차": "공정관리", "수의계약": "계약제도", "강제창호제작순서": "철골공사", "브레인스토밍": "공정관리", "시방서분류": "계약제도", "강관비계부속철물": "가설공사", "CM방식": "계약제도", "유동화콘크리트": "콘크리트공사", "CM계약유형": "계약제도", "줄눈": "콘크리트공사", "조립률": "콘크리트공사", "벽돌소요량": "조적공사", "바깥방수시공순서": "방수공사", "속빈블록치수": "조적공사", "지반탈수공법": "토공사", "TQC 7도구": "시공관리", "독립기초재료량": "적산", "JIT": "시공관리", "측압": "콘크리트공사", "3S시스템": "시공관리", "BOT": "계약제도", "BTO": "계약제도", "지반조사순서": "토공사", "주각부시공순서": "철골공사", "철근간격": "철근콘크리트공사", "거푸집존치기간": "콘크리트공사", "접합방식": "철골공사", "돌붙임시공순서": "석공사", "강판물량산출": "철골공사", "모르타르용도": "미장공사", "CALS": "시공관리", "EC": "시공관리", "LCC": "시공관리", "거푸집역할": "콘크리트공사", "TQC도구": "시공관리", "붙임공법": "타일공사", "VE절차": "시공관리", "줄기초물량산출": "철근콘크리트공사", "트러스철골량산출": "철골공사", "보링": "토공사", "시멘트비중시험": "재료", "조립식공법": "시공관리", "단열재요구조건": "재료", "공사자원분류": "시공관리", "표준품셈": "시공관리", "소운반": "시공관리", "페이퍼조인트": "계약제도", "기준점": "측량", "예민비": "토공사", "성능발주": "계약제도", "CM": "계약제도", "장비": "콘크리트공사", "터파기물량산출": "토공사", "공정관리용어": "시공관리", "TES": "계약제도", "정초식": "시공관리", "상량식": "시공관리", "보강블록구조사춤": "조적공사", "각종Joint": "콘크리트공사", "기초상부고름질": "철골공사", "고력볼트장점": "철골공사", "원가계산기준용어": "시공관리", "기둥공사흐름도": "철골공사", "비계면적산출": "가설공사", "고력볼트등급": "철골공사", "PSC공법순서": "콘크리트공사", "배근가능개수": "철근콘크리트공사"};
/* 이 파일을 복제해서 다른 자격증 배포본을 만들 경우, EXAM_CONFIG.markText가 다르면
   자동으로 다른 localStorage 키를 쓰게 되어 같은 브라우저/도메인에서 여러 배포본을
   열어도 학습기록이 서로 섞이지 않는다.
   ⚠️ 중요: localStorage는 "도메인" 단위로만 구분되고 "경로"로는 구분이 안 된다.
   그래서 CERT_ID만으로 키를 만들면, 예를 들어 challenge60.github.io/do/certs/arch-siljak/
   (허브 배포본)과 challenge60.github.io/a/(같은 건축기사를 담은 standalone 배포본)이
   완전히 같은 origin 안에서 "arch-siljak"이라는 같은 CERT_ID를 쓰기 때문에, 브라우저가
   두 앱을 서로 다른 앱이라고 구분 못 하고 학습기록·모의고사 진행상황이 그대로
  섞여버리는 문제가 있었다. 이를 막기 위해 URL 경로의 첫 세그먼트(예: "do", "a", "b", "c")를
   키에 함께 넣어 배포본별로 완전히 분리한다. */
function deployNamespace(){
  try{
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return seg || "root";
  }catch(e){ return "root"; }
}
const LS_KEY = "exam_app_v2__" + deployNamespace() + "__" + (typeof CERT_ID !== "undefined" ? CERT_ID : "default");
// 위 수정 이전에 쓰던 옛 키(배포본 구분 없이 CERT_ID만 사용) — 있으면 한 번만 새 키로 옮겨온다.
const LS_KEY_LEGACY = "exam_app_v1__" + (typeof CERT_ID !== "undefined" ? CERT_ID : "default");
function loadStore(){
  try{
    let raw = localStorage.getItem(LS_KEY);
    if(!raw){
      // 새 키에 아직 아무것도 없으면, 옛(배포본 구분 없던 시절) 키에 데이터가 있는지 확인해서
      // 한 번만 옮겨온다. 이렇게 해야 이번 수정으로 기존 학습기록이 갑자기 사라지지 않는다.
      const legacy = localStorage.getItem(LS_KEY_LEGACY);
      if(legacy){
        raw = legacy;
        try{ localStorage.setItem(LS_KEY, legacy); }catch(e){}
      }
    }
    if(raw){
      const s = JSON.parse(raw);
      if(!s.edits) s.edits = {};
      if(!("examConfig" in s)) s.examConfig = null;
      if(!s.setRepeats) s.setRepeats = {};
      if(!s.penNotes) s.penNotes = {}; // "기억하기"로 지정한 문제의 펜 필기(벡터 좌표) 영구 저장소
      if(!s.penRemembered) s.penRemembered = {}; // 어떤 문제를 "기억하기" 했는지 여부
      if(!Array.isArray(s.reviewCountModes) || !s.reviewCountModes.length) s.reviewCountModes = ["srs"];
      return s;
    }
  }catch(e){}
  return {progress:{}, wrong:{}, bookmarks:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:null, setRepeats:{}, penNotes:{}, penRemembered:{}, reviewCountModes:["srs"]};
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
/* UNIT_TAXONOMY provided by data.js (loaded before app.js) */
function unitMajorList(){ return UNIT_TAXONOMY.map(u=>u.major); }
function unitMinorsOf(major){ const g = UNIT_TAXONOMY.find(u=>u.major===major); return g ? g.minors : []; }
function majorOfMinor(minor){ const g = UNIT_TAXONOMY.find(u=>u.minors.includes(minor)); return g ? g.major : null; }

/* ============ 관리자 수정 오버레이 (전체 사용자 공용) ============
   우선순위: 원본(SAMPLE_DATA) < 관리자 수정(window.adminOverrides) < 내 개인 수정(store.edits)
   즉, 이 문제를 개인적으로 고친 적이 없는 사용자에게만 관리자 수정이 보인다.
   window.adminOverrides는 storage.js가 Supabase question_overrides 테이블에서 불러와 채운다
   (허브 배포본에서만 존재; standalone 배포본은 항상 undefined이므로 원본 그대로 동작). */
function adminOverrideFor(id){
  return (typeof window !== "undefined" && window.adminOverrides) ? window.adminOverrides[id] : null;
}
function getData(){
  const base = store.customData && store.customData.length ? store.customData : SAMPLE_DATA;
  const hasEdits = store.edits && Object.keys(store.edits).length;
  const hasAdminOv = typeof window !== "undefined" && window.adminOverrides && Object.keys(window.adminOverrides).length;
  if(!hasEdits && !hasAdminOv) return base;
  return base.map(q => withEdits(q));
}
function withEdits(q){
  if(!q) return q;
  const adminOv = adminOverrideFor(q.id);
  const merged = adminOv ? {...q, ...adminOv} : q;
  return (store.edits && store.edits[q.id]) ? {...merged, ...store.edits[q.id]} : merged;
}

/* ---- 관리자 전용: 문제 수정사항을 전체 사용자 기본값으로 발행(publish) ----
   window.canPublishOverride / window.publishAdminOverride 는 storage.js(허브에서만 로드)가 채워준다.
   (관리자뿐 아니라 편집자 등급도 canPublishOverride가 true로 설정됨) */
async function maybeAskAdminPublish(id, payload){
  if(typeof window === "undefined" || !window.canPublishOverride || typeof window.publishAdminOverride !== "function") return;
  const ok = confirm(
    "이 수정을 이 문제의 기본값으로 적용할까요?\n\n" +
    "적용하면, 이 문제를 개인적으로 아직 수정하지 않은 모든 사용자에게 이 내용이 보이게 됩니다.\n" +
    "(이미 이 문제를 개인적으로 수정해 둔 사용자는 계속 자신의 수정본을 보게 되어 영향받지 않습니다)"
  );
  if(!ok) return;
  try{
    await window.publishAdminOverride(id, payload);
    // 발행에 성공했으면 "내 개인 수정" 기록은 이제 방금 발행한 내용과 똑같은 중복 사본일 뿐이라
    // 지워준다. 안 지우면 나중에 이 문제를 볼 때마다 계속 'My' 배지가 남아있는 것처럼
    // 보여서(실제로는 전체 적용본과 같은 내용인데도) 관리자가 헷갈리는 문제가 있었음.
    if(store.edits && store.edits[id]){
      delete store.edits[id];
      saveStore();
    }
    toast("전체 사용자 기본값으로 적용되었습니다");
    if(state.view === "card") renderCard(); // 새로고침 없이 바로 배지가 갱신되도록
  }catch(e){
    console.error(e);
    alert("전체 적용 중 오류가 발생했습니다: " + (e && e.message ? e.message : e));
  }
}

/* ============ 활성 자격증 설정 적용 (기본 EXAM_CONFIG 또는 가져온 데이터의 examConfig) ============ */
// 자격증별 실기/필답형 구분(짧은 표기). CERT_ID는 data.js가 정의하는 전역 상수.
// 새 자격증을 추가할 때 이 표에 없으면 cfg.subtitle을 그대로 쓰도록 폴백 처리됨.
const SHORT_SUB_BY_CERT = { "arch-siljak":"실기", "waterproof-siljak":"실기", "safety-siljak":"필답형", "ergonomics-pildap":"필답", "concrete-siljak":"실기" };
function activeExamConfig(){
  return store.examConfig || EXAM_CONFIG;
}
function shortSubOf(cfg){
  return SHORT_SUB_BY_CERT[typeof CERT_ID !== "undefined" ? CERT_ID : ""] || cfg.subtitle;
}
function applyExamConfig(){
  const cfg = activeExamConfig();
  const shortSub = shortSubOf(cfg);
  document.title = `My도전. ${cfg.markText} ${shortSub}`;
  document.querySelector(".brand .mark").textContent = "My도전";
  document.querySelector(".brand .sub").textContent = `${cfg.markText} ${shortSub}`;
  const verEl = document.querySelector(".brand .ver");
  if(verEl) verEl.textContent = `Ver. ${APP_VERSION}`;
}

/* ============ 중복 제거 + 빈도 계산 ============ */
function normText(t){ return (t||"").replace(/\s+/g,"").replace(/[.,·、]/g,""); }
/* 리스트 미리보기용: {{img:N}} 표시가 그대로 노출되지 않도록 제거 */
function previewText(t){ return (t||"").replace(/\{\{img:\d+\}\}/g, "").replace(/\{\{BOX\}\}/g, "").replace(/\{\{\/BOX\}\}/g, "").trim(); }

/* ---- 문제/정답 읽어주기 (Web Speech API) ---- */
let ttsVoicesReady = false;
if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged = ()=>{ ttsVoicesReady = true; populateTtsVoiceSelect(); };
}
function pickKoreanVoice(){
  if(!("speechSynthesis" in window)) return null;
  const voices = speechSynthesis.getVoices();
  if(store.ttsVoiceName){
    const chosen = voices.find(v=>v.name===store.ttsVoiceName);
    if(chosen) return chosen;
  }
  return voices.find(v=>v.lang==="ko-KR") || voices.find(v=>v.lang&&v.lang.startsWith("ko")) || null;
}
/* ---- 설정 화면의 음성(TTS) 목소리 선택 드롭다운을 채운다. 음성 목록은 브라우저에서 비동기로 로드되므로
   onvoiceschanged 이벤트가 늦게 와도 대응하도록 약간의 지연 재시도를 둔다. ---- */
function populateTtsVoiceSelect(){
  const sel = document.getElementById("ttsVoiceSelect");
  if(!sel || !("speechSynthesis" in window)) return;
  const allVoices = speechSynthesis.getVoices();
  const koVoices = allVoices.filter(v=>v.lang && v.lang.startsWith("ko"));
  const list = koVoices.length ? koVoices : allVoices;
  if(!list.length){
    sel.innerHTML = `<option value="">(음성 목록 불러오는 중... 새로고침을 눌러보세요)</option>`;
    return;
  }
  const current = store.ttsVoiceName;
  sel.innerHTML = `<option value="">자동 선택 (기본)</option>` + list.map(v=>
    `<option value="${escapeHtml(v.name)}" ${v.name===current?"selected":""}>${escapeHtml(v.name)}${v.lang?` (${escapeHtml(v.lang)})`:""}</option>`
  ).join("");
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
function isAutoDupExcluded(id){
  return !!(store.edits && store.edits[id] && store.edits[id].excludeAutoDup);
}
/* 특정 문항을 그룹에서 완전히 해제한다 — 수동 연결도 끊고, 앞으로 자동(텍스트 유사도)
   재감지 대상에서도 제외한다. (수동 링크만 지우면 자동감지가 다음 렌더링에서 다시
   같은 그룹으로 묶어버려서, 자동 감지된 중복은 "해제"가 안 되는 것처럼 보이는 문제가 있었음) */
function removeFromDupGroup(id){
  clearManualLinks(id);
  if(!store.edits) store.edits = {};
  if(!store.edits[id]) store.edits[id] = {};
  store.edits[id].excludeAutoDup = true;
  saveStore();
}
function buildCombinedGroups(data){
  const parent = {};
  const find = x => (parent[x]===x) ? x : (parent[x]=find(parent[x]));
  const union = (a,b) => { const ra=find(a), rb=find(b); if(ra!==rb) parent[ra]=rb; };
  data.forEach(q=> parent[q.id]=q.id);

  // "이 그룹에서 해제"된 문항은 자동(텍스트 유사도) 재감지 대상에서 빠진다.
  // (수동으로 다시 연결하는 것은 아래에서 항상 허용됨 — 자동 감지만 제외)
  const autoData = data.filter(q=> !isAutoDupExcluded(q.id));

  const byKey = {};
  autoData.forEach(q=>{
    const key = normText(q.question).slice(0,40);
    (byKey[key] ||= []).push(q.id);
  });
  Object.values(byKey).forEach(ids=>{ for(let i=1;i<ids.length;i++) union(ids[0], ids[i]); });

  // 완전히 똑같진 않지만(숫자·쉼표·오탈자 등 사소한 표기 차이) 사실상 같은 문제인 경우를 추가로 묶는다.
  // 정규화한 문제 텍스트를 정렬한 뒤 인접한 항목끼리만 비교하므로 1587문항 규모에서도 가볍게 동작한다.
  const normed = autoData.map(q=>({id:q.id, norm:normText(q.question).slice(0,120)})).sort((a,b)=>
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

  // 수동 연결은 "자동 감지 제외" 여부와 무관하게 항상 반영한다 (해제된 문항이라도
  // 특정 문항과 수동으로 다시 연결하고 싶을 수 있으므로).
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
/* ============ 목표 회독(D-day) 시스템 ============
   D-day + 목표 회독수를 설정하면, 남은 일수에 맞춰 오늘 하루 목표 문항수를 자동 계산한다.
   오늘의 학습 큐는 [오답노트 → SRS 복습주기 도래 → 신규(한 번도 안 품)] 세 풀(pool)을
   학습자가 정한 비율대로 섞어서 채운다. 어느 풀이 모자라면 우선순위(오답→SRS→신규) 순으로
   남은 풀에서 부족분을 채워 항상 목표량을 맞춘다. */
function reviewMix(){
  const m = store.reviewMix;
  if(m && typeof m.wrong==="number" && typeof m.srs==="number" && typeof m.new==="number") return m;
  return {wrong:40, srs:40, new:20};
}
function reviewRounds(){
  return (store.reviewGoal && store.reviewGoal.rounds) ? store.reviewGoal.rounds : null;
}
/* ============ "오늘 학습 카운트"에 포함할 학습 모드 ============
   어떤 화면(회독/오답노트/단원별/연도별/빈도별/키워드별/모의고사)에서 채점하든 history에는
   전부 기록되지만, 오늘 목표 진행률(todaySolvedCount/dailyStats)에는 여기서 선택된 모드만 반영한다.
   과거에 저장된, mode 정보가 없는 history 항목은 하위호환을 위해 "srs"로 간주한다. */
const REVIEW_COUNT_MODE_GROUPS = [
  {key:"srs",   label:"회독 학습",     modes:["srs"]},
  {key:"exam",  label:"실전 모의고사", modes:["exam"]},
  {key:"unit",  label:"단원별 연습",   modes:["unit","unitMinor"]},
  {key:"year",  label:"연도별 기출",   modes:["year"]},
  {key:"freq",  label:"빈도순 연습",   modes:["freq"]},
  {key:"tag",   label:"키워드별",      modes:["tag"]}
];
function getReviewCountModes(){
  return (Array.isArray(store.reviewCountModes) && store.reviewCountModes.length) ? store.reviewCountModes : ["srs"];
}
function historyModeOf(h){
  return (h && h.mode) || "srs";
}
/* ============ 회독별 학습 방식 (연습/시험/음성) ============
   목표 회독수만큼 각 회차별로 원하는 학습 방식을 미리 지정해두면,
   "오늘의 회독"에서 방식을 매번 고르지 않고 현재 회차에 맞는 방식으로 바로 시작한다.
   예: 1·2회독은 음성으로 가볍게 훑고, 3·4회독은 연습모드로 정리, 마지막 5회독은 시험모드로 점검. */
function roundModeLabel(m){
  return m==="voice" ? "🔊 음성학습" : (m==="exam" ? "📝 시험모드" : "📖 연습모드");
}
function getRoundModes(){
  const rounds = reviewRounds() || 1;
  let rm = store.roundModes;
  if(!Array.isArray(rm) || rm.length !== rounds){
    const next = [];
    for(let i=0;i<rounds;i++) next.push((rm && rm[i]) ? rm[i] : "practice");
    store.roundModes = next;
    saveStore();
    rm = next;
  }
  return rm;
}
function currentSrsRound(){
  const rounds = reviewRounds() || 1;
  let r = store.srsRound || 1;
  if(r < 1) r = 1;
  if(r > rounds) r = rounds; // 목표 회독수를 넘어서 표시되지 않도록 상한을 둔다
  if(r !== store.srsRound){ store.srsRound = r; saveStore(); }
  return r;
}
function currentRoundMode(){
  const modes = getRoundModes();
  const r = currentSrsRound();
  return modes[Math.min(r, modes.length) - 1] || "practice";
}
function dailyReviewGoal(){
  const rounds = reviewRounds();
  if(!store.targetDate || !rounds) return null;
  const daysLeft = Math.max(1, daysUntilTarget(store.targetDate));
  const total = getData().length;
  return Math.max(1, Math.ceil((total * rounds) / daysLeft));
}
/* 문제 유형 추정(빠른회상 후보 판별): 이미지가 붙어있으면 도식형, 답에 계산식/단위가 보이면 계산형으로 보고 제외.
   남은 문제 중 정답이 짧으면(정의·용어 나열형) 눈으로 빠르게 O/X 체크하기 좋은 "빠른회상" 후보로 본다. */
function isQuickRecall(q){
  if(q.images && q.images.length) return false;
  const ans = (q.answer||"");
  if(/[=×÷][^,\n]{0,3}[\d.]|㎡|㎥|N\/mm|kg\/|㎏|㎏\/|kN/.test(ans)) return false;
  const plain = ans.replace(/[\s\n]/g,"");
  return plain.length <= 60;
}
/* 진짜 "신규"(한 번도 채점된 적 없는) 문제 판별.
   연습/음성 모드에서 채점 없이 넘긴(passive) 기록만 있는 문제는, 아직 실제로
   회독(채점)된 적이 없으므로 계속 "신규" 풀에 남겨 다음 회독에서도 다시 만나게 한다. */
function isUngraded(qid){
  const p = store.progress[qid];
  if(!p) return true;
  return !(p.history && p.history.some(h=> typeof h.score === "number"));
}
/* 회독 학습의 "신규 연도(-회차) 범위" 필터: null이면 전체 대상.
   연도뿐 아니라 회차까지 정밀하게 다루기 위해, (연도*10+회차) 형태의 합성 키(key)로 비교한다.
   시작·끝을 사용자가 어느 순서로 고르든(예: 최신→과거 또는 과거→최신) 저장 시 알아서
   작은 값/큰 값으로 정리해두므로, 여기서는 항상 minKey<=maxKey 상태로 비교하면 된다. */
function yearRoundKey(year, round){ return year*10 + (round||1); }
function reviewYearRange(){
  return (store.reviewYearRange && store.reviewYearRange.minKey!=null && store.reviewYearRange.maxKey!=null) ? store.reviewYearRange : null;
}
function inReviewYearRange(q){
  const r = reviewYearRange();
  if(!r) return true;
  const key = yearRoundKey(q.year, q.round);
  return key >= r.minKey && key <= r.maxKey;
}
/* 데이터에 실제로 존재하는 연도-회차 조합 목록(오름차순, 과거→최신) — 연도범위 설정 드롭다운용 */
function allYearRoundOptions(){
  const set = new Map();
  getData().forEach(q=>{
    const key = yearRoundKey(q.year, q.round);
    if(!set.has(key)) set.set(key, {key, year:q.year, round:q.round||1});
  });
  return [...set.values()].sort((a,b)=> a.key-b.key);
}
function buildDailyReviewQueue(){
  const goal = dailyReviewGoal();
  const mix = reviewMix();
  const yr = reviewYearRange();
  const wrongPool = getData().filter(q=> store.wrong[q.id] && inReviewYearRange(q));
  const srsPool = getSRSQueue().filter(q=> inReviewYearRange(q));
  // 신규(한 번도 안 푼) 문제는 기본적으로 최신 연도부터 나오도록 정렬한다.
  // (예전엔 data.js 원본 순서(가장 오래된 연도부터)를 그대로 써서, 항상 같은 오래된 문제부터
  //  시작하는 것처럼 느껴진다는 제보가 있었음 — 시험 대비상으로도 최근 기출을 먼저 보는 게 자연스러움)
  const newPool = getData()
    .filter(q=> isUngraded(q.id) && inReviewYearRange(q))
    .sort((a,b)=> (b.year - a.year) || ((b.round||1) - (a.round||1)) || ((a.no||0) - (b.no||0)));
  if(!goal){
    // 목표(D-day·회독수) 미설정 시: 기존처럼 오답→SRS→신규 우선순위로 전부 반환
    return {list:[...wrongPool, ...srsPool, ...newPool], counts:{wrong:wrongPool.length, srs:srsPool.length, new:newPool.length}, goal:null, wrongTotal:wrongPool.length, srsTotal:srsPool.length, newTotal:newPool.length};
  }
  const want = {
    wrong: Math.round(goal*mix.wrong/100),
    srs: Math.round(goal*mix.srs/100),
    new: Math.round(goal*mix.new/100)
  };
  const picked = {
    wrong: wrongPool.slice(0, want.wrong),
    srs: srsPool.slice(0, want.srs),
    new: newPool.slice(0, want.new)
  };
  let shortfall = goal - (picked.wrong.length+picked.srs.length+picked.new.length);
  if(shortfall > 0){
    const extra = wrongPool.slice(picked.wrong.length, picked.wrong.length+shortfall);
    picked.wrong = picked.wrong.concat(extra); shortfall -= extra.length;
  }
  if(shortfall > 0){
    const extra = srsPool.slice(picked.srs.length, picked.srs.length+shortfall);
    picked.srs = picked.srs.concat(extra); shortfall -= extra.length;
  }
  if(shortfall > 0){
    const extra = newPool.slice(picked.new.length, picked.new.length+shortfall);
    picked.new = picked.new.concat(extra); shortfall -= extra.length;
  }
  return {list:[...picked.wrong, ...picked.srs, ...picked.new], counts:{wrong:picked.wrong.length, srs:picked.srs.length, new:picked.new.length}, goal, wrongTotal:wrongPool.length, srsTotal:srsPool.length, newTotal:newPool.length};
}

/* D-day가 설정되어 있으면, 에빙하우스 간격으로 계산된 다음 복습일이 시험일을 넘기지 않도록 시험일로 당겨준다 */
function cappedNextDate(dateStr){
  if(store.targetDate && dateStr > store.targetDate) return store.targetDate;
  return dateStr;
}

function recordResult(qid, score, mode){
  const p = store.progress[qid] || {box:0, next:todayStr(), history:[]};
  const isGood = score>=75;
  if(isGood){
    p.box = Math.min(p.box+1, BOX_INTERVAL_DAYS.length-1);
  }else{
    p.box = 0;
    store.wrong[qid] = true;
  }
  if(score>=75 && store.wrong[qid]) delete store.wrong[qid];
  p.next = cappedNextDate(addDays(todayStr(), BOX_INTERVAL_DAYS[p.box]));
  /* 어떤 학습모드(회독/오답노트/단원별/연도별/빈도별/키워드별/모의고사)에서 채점했는지 함께 기록.
     명시적으로 mode를 넘기지 않으면 현재 진행 중인 큐의 state.mode를 사용(없으면 "srs"로 간주). */
  p.history.push({date:todayStr(), score, mode: mode || state.mode || "srs"});
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

/* ============ 펜 필기 연습장 ============
   기본은 세션 캐시(state.penMemos)에만 담아 앱을 종료(새로고침)하면 사라진다.
   문제별 "🔖 기억하기" 버튼을 눌러야만 store.penNotes에 영구 저장되며(store.penRemembered로
   어떤 문제를 기억할지 별도 표시), 즐겨찾기(★) 여부와는 무관하게 독립적으로 동작한다.
   용량 관리를 위해 ①근접한 점은 기록하지 않는 압축, ②문제당 점 1,500개 상한(초과 시
   오래된 획부터 삭제), ③전체 저장량이 3MB를 넘으면 경고 후 더 이상 영구 저장하지 않는
   안전장치를 둔다. */
const PEN_MAX_POINTS_PER_Q = Infinity; // 문항당 점 개수 상한을 없앰(무제한 필기). 저장 공간 이슈는 PEN_STORAGE_LIMIT_BYTES에서 경고로만 처리.
const PEN_MIN_POINT_DIST_PX = 1.5; // 절대 픽셀 기준 최소 이동 거리 — 이보다 가까운 점은 생략(압축)
const PEN_STORAGE_LIMIT_BYTES = 3 * 1024 * 1024; // 전체 penNotes 저장 한도(경고 기준)
function getPenNoteFor(qid){
  if(store.penNotes && store.penNotes[qid]) return store.penNotes[qid];
  if(state.penMemos && state.penMemos[qid]) return state.penMemos[qid];
  return null;
}
function isPenRemembered(qid){
  return !!(store.penRemembered && store.penRemembered[qid]);
}
/* 문항당 점 개수 상한은 두지 않는다(무제한 필기). 다만 함수는 남겨두어
   PEN_MAX_POINTS_PER_Q를 다시 유한값으로 바꾸면 즉시 예전처럼 오래된 획부터 지우는 동작으로 복귀 가능. */
function strokePtCount(s){ return (s && s.pts) ? s.pts.length : (s ? s.length : 0); }
function capStrokes(strokes){
  if(!isFinite(PEN_MAX_POINTS_PER_Q)) return strokes;
  let total = strokes.reduce((n,s)=>n+strokePtCount(s), 0);
  while(total > PEN_MAX_POINTS_PER_Q && strokes.length){
    total -= strokePtCount(strokes[0]);
    strokes.shift();
  }
  return strokes;
}
function penNotesSizeBytes(){
  try{ return JSON.stringify(store.penNotes||{}).length; }catch(e){ return 0; }
}
/* 예전 형식(좌표 배열)을 새 형식({pts,w,color,alpha,blend} 등) 객체로 변환. 이미 새 형식이면 복사만 한다. */
function normalizeStroke(s){
  if(Array.isArray(s)) return { pts: s.map(p=>p.slice()), w: 2.2, color: "#1c2430", alpha: 1, blend: "source-over" };
  return { pts: (s.pts||[]).map(p=>p.slice()), w: s.w || 2.2, color: s.color || "#1c2430", alpha: (typeof s.alpha === "number") ? s.alpha : 1, blend: s.blend || "source-over" };
}
/* 예전 형식(y도 0~1 정규화)으로 저장된 필기 데이터를 새 형식(y는 절대 픽셀)으로 변환한다.
   판별 기준: 한 획이라도 y값이 1보다 크면 이미 새 형식(절대 픽셀)이라고 본다.
   짧은 획만 있는 경우 오판할 수 있어, 문항 전체 획을 모아 판단한다. */
function migrateStrokesToAbsoluteY(strokes, cssH){
  const looksNormalized = strokes.length && strokes.every(s => (s.pts||[]).every(p => Math.abs(p[1]) <= 1.0001));
  if(!looksNormalized) return strokes;
  return strokes.map(s => ({ ...s, pts: s.pts.map(p => [p[0], p[1]*cssH]) }));
}
const PEN_CANVAS_MIN_HEIGHT = 280;
const PEN_CANVAS_MAX_HEIGHT = 560;
const PEN_ERASE_RADIUS_X = 0.03; // 캔버스 폭 대비 정규화 좌표 기준 지우개 판정 반경(x)
const PEN_ERASE_RADIUS_Y = 14;   // 절대 픽셀 기준 지우개 판정 반경(y)
/* 볼펜/형광펜 각각의 기본 굵기·불투명도·혼합모드와 어울리는 색상 팔레트 */
const PEN_TOOL_PRESETS = {
  ballpen: { width: 2.2, alpha: 1, blend: "source-over", colors: ["#1c2430","#2c5aa0","#a1503c","#2f6b57"] },
  highlighter: { width: 15, alpha: 0.38, blend: "multiply", colors: ["#ffe066","#a8e063","#ff9ecb","#7fd1ff"] }
};
/* 펜(스타일러스) 입력을 한 번이라도 받은 적이 있으면, 그 이후로는 세션 내내(문제를 넘겨도)
   터치(손가락) 입력을 필기로 받지 않는다. setupPenCanvas가 문제마다 새로 호출되므로
   이 값은 반드시 함수 밖(모듈 스코프)에 둬야 문제를 넘겨도 값이 유지된다. */
let penEverUsedGlobal = false;
let penInputModeGlobal = "auto"; // 'auto' | 'penOnly' | 'touch' — 세션 동안 유지되는 필기 입력 인식 모드
let currentPenResync = null; // 지금 카드의 필기 캔버스를 다시 측정+다시 그리는 함수(탭 전환/화면 크기 변경 시 호출)
let voiceStudyAutoListening = false; // 음성학습모드가 지금 자동으로 듣고 있는 중인지(수동 녹음 버튼과 충돌 방지용)
let wasKbdFocusedBeforeRender = false; // 카드를 다시 그리기 직전, 키보드 입력창에 실제로 포커스가 있었는지
let hasFinePointer = false;
try{ hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches; }catch(e){}
let penResyncDebounce = null;
window.addEventListener("resize", ()=>{
  // 브라우저 창 크기(또는 화면 회전)가 바뀌면 캔버스의 실제 픽셀 버퍼 크기도 다시 맞춰야
  // 브라우저가 기존 그림을 억지로 늘려서 보여주는 현상(글씨가 늘어나 보이는 문제)이 없어진다.
  if(penResyncDebounce) clearTimeout(penResyncDebounce);
  penResyncDebounce = setTimeout(()=>{ if(currentPenResync) currentPenResync(); }, 150);
});
let lastPracticeTabGlobal = "kbd"; // 세션 동안 유지되는 마지막 선택 탭(기본값: 키보드연습장)
function setupPracticeTabs(q){
  const tabBar = document.getElementById("practiceTabs");
  if(!tabBar) return;
  const panels = {
    pen: document.getElementById("practicePanelPen"),
    kbd: document.getElementById("practicePanelKbd"),
    voice: document.getElementById("practicePanelVoice")
  };
  const btns = Array.from(tabBar.querySelectorAll(".practice-tab-btn"));
  function activate(tab, isUserClick){
    const wasPenHidden = panels.pen && panels.pen.style.display === "none";
    lastPracticeTabGlobal = tab;
    btns.forEach(b=> b.classList.toggle("active", b.dataset.tab===tab));
    Object.entries(panels).forEach(([k,el])=>{ if(el) el.style.display = (k===tab) ? "" : "none"; });
    // 키보드연습장 자동 포커스: 화면을 뒤덮는 문제 때문에 무조건 포커스하지 않는다.
    // - 탭을 "직접 눌러서" 열었을 때는(명시적 행동이니) 항상 포커스한다.
    // - 문제를 넘기다가 자동으로 이 탭이 뜬 경우엔, PC/트랙패드가 있는 기기(터치 전용 폰이 아닌 경우)
    //   이거나, 직전 문제에서 실제로 입력창에 커서가 있던 채로(물리 키보드로 계속 타이핑 중) 넘어온
    //   경우에만 포커스한다. 그래야 폰에서 문제 넘길 때마다 화면 절반을 가리는 가상 키보드가
    //   원치 않게 계속 튀어나오는 걸 막을 수 있다.
    if(tab === "kbd" && (isUserClick || hasFinePointer || wasKbdFocusedBeforeRender)){
      const ta = document.getElementById("kbdPadTextarea");
      if(ta) setTimeout(()=> ta.focus(), 0);
    }
    // 필기연습장이 "숨김→표시"로 바뀌는 순간, 캔버스를 실제 화면 크기로 다시 측정+다시 그린다.
    // (숨겨진 상태에서 측정하면 크기가 0으로 잡혀 펜 위치와 실제 그려지는 위치가 어긋나는 원인이 됐음)
    if(tab === "pen" && wasPenHidden && currentPenResync){
      requestAnimationFrame(()=> currentPenResync());
    }
  }
  btns.forEach(b=> b.addEventListener("click", ()=> activate(b.dataset.tab, true)));
  // 음성학습모드 중일 때는 문제가 바뀔 때마다 음성연습장을 자동으로 띄운다.
  activate(state.studyMode === "voice" ? "voice" : lastPracticeTabGlobal, false);
  setupPenCanvas(q);
  setupKeyboardPad(q);
  setupVoicePad(q);
  // 처음 렌더링될 때 필기 탭이 곧바로 기본 탭이었던 경우를 대비해 한 번 더 재측정한다.
  if(lastPracticeTabGlobal === "pen" && currentPenResync){
    requestAnimationFrame(()=> currentPenResync());
  }
}
/* ---- 키보드 연습장: 세션 동안만 유지되는 간단한 메모장(지우기 버튼으로 초기화) ---- */
function setupKeyboardPad(q){
  const ta = document.getElementById("kbdPadTextarea");
  const clearBtn = document.getElementById("kbdPadClearBtn");
  if(!ta) return;
  if(!state.kbdMemos) state.kbdMemos = {};
  ta.value = state.kbdMemos[q.id] || "";
  ta.addEventListener("input", ()=>{ state.kbdMemos[q.id] = ta.value; });
  if(clearBtn) clearBtn.addEventListener("click", ()=>{
    ta.value = "";
    delete state.kbdMemos[q.id];
    ta.focus();
  });
}
/* ---- 음성 연습장: STT(음성 인식)로 답변을 받아쓰고, 필요하면 TTS로 문제를 먼저 읽어준다.
   브라우저 Web Speech API(webkitSpeechRecognition) 지원 여부에 따라 자동으로 켜지거나 숨겨진다. ---- */
/* ---- 음성인식 오류 코드를 사람이 이해할 수 있는 메시지로 바꾼다.
   no-speech/aborted는 계속듣기 모드에서 흔히 나는 정상적인 상황이라 오류로 취급하지 않는다.
   진짜 문제(권한/마이크/네트워크)일 때만 사용자에게 구체적으로 알려주고 멈춘다. ---- */
function voiceErrorInfo(code){
  switch(code){
    case "no-speech":
    case "aborted":
      return {fatal:false, msg:null};
    case "audio-capture":
      return {fatal:true, msg:"🎙️ 마이크를 찾을 수 없어요. 다른 앱이 마이크를 쓰고 있지 않은지 확인해주세요."};
    case "not-allowed":
    case "service-not-allowed":
      return {fatal:true, msg:"🎙️ 마이크 권한이 꺼져있어요. 브라우저(또는 앱) 설정에서 이 사이트의 마이크 권한을 허용해주세요."};
    case "network":
      return {fatal:true, msg:"🎙️ 네트워크 연결을 확인해주세요. 음성인식은 인터넷 연결이 필요해요."};
    default:
      return {fatal:true, msg:`🎙️ 음성 인식 오류(${code||"알수없음"})가 발생했어요. 다시 시도해주세요.`};
  }
}
/* ---- 음성인식 세션이 짧게 끊겼다 재시작될 때, 마이크 버퍼가 덜 비워진 채로 겹쳐서
   직전 세션과 내용이 겹치는 문장을 다시 인식하는 경우가 있다(예: "나도" → "나도 몰라" →
   "나도 몰라"). 새 세그먼트를 그냥 추가하지 않고, 직전 세그먼트와의 포함 관계를 먼저 확인해서
   완전 중복은 버리고, 이전 내용을 포함하는 확장판이면 교체한다. ---- */
/* ---- 표현이 살짝 다르게(예: "믹스"→"맥스") 다시 인식된 경우까지 잡기 위해,
   완전 일치/포함관계가 아니어도 "단어 대부분이 겹치면 사실상 같은 말"로 본다. ---- */
function wordOverlapRatio(a, b){
  const wa = a.split(/\s+/).filter(Boolean);
  const wb = b.split(/\s+/).filter(Boolean);
  if(!wa.length || !wb.length) return 0;
  const setA = new Set(wa);
  let common = 0;
  wb.forEach(w=>{ if(setA.has(w)) common++; });
  return common / Math.max(wa.length, wb.length);
}
const VOICE_DUP_OVERLAP_THRESHOLD = 0.6; // 단어의 60% 이상 겹치면 "같은 말 다시 말한 것"으로 본다
function pushVoiceSegment(segments, newSeg){
  const seg = (newSeg||"").trim();
  if(!seg) return;
  if(!segments.length){ segments.push(seg); return; }
  const last = segments[segments.length-1];
  const lastNorm = last.replace(/\s+/g,"");
  const segNorm = seg.replace(/\s+/g,"");
  if(segNorm === lastNorm) return; // 완전히 같은 내용 → 버림
  if(segNorm.includes(lastNorm)){ segments[segments.length-1] = seg; return; } // 이전 내용을 포함하는 확장판 → 교체
  if(lastNorm.includes(segNorm)) return; // 이전 내용의 부분집합(더 짧게 잘린 것) → 버림
  if(wordOverlapRatio(last, seg) >= VOICE_DUP_OVERLAP_THRESHOLD){
    // 표현은 조금 다르지만 사실상 같은 말을 다시 한 것 → 더 긴(더 자세한) 쪽으로 교체
    segments[segments.length-1] = seg.length >= last.length ? seg : last;
    return;
  }
  segments.push(seg);
}
/* ---- 세션 "안에서도" 일부 기기(특히 안드로이드 크롬 계열)는 e.results에 같은 말을
   점점 길어지는 여러 개의 확정(isFinal) 조각으로 반복해서 채워넣는 경우가 있다
   ("그걸로" → "그걸로 한" → "그걸로 한 거구나" 처럼 매번 처음부터 다시).
   단순히 다 이어붙이면 그대로 중복되므로, pushVoiceSegment와 같은 포함관계 판단으로
   한 세션 안의 조각들도 병합한다. ---- */
function mergeGrowingPieces(pieces){
  let acc = "";
  for(const raw of pieces){
    const piece = (raw||"").trim();
    if(!piece) continue;
    if(!acc){ acc = piece; continue; }
    const accNorm = acc.replace(/\s+/g,"");
    const pieceNorm = piece.replace(/\s+/g,"");
    if(pieceNorm === accNorm) continue;
    if(pieceNorm.includes(accNorm)){ acc = piece; continue; } // 확장판 → 교체
    if(accNorm.includes(pieceNorm)) continue; // 부분집합 → 버림
    if(wordOverlapRatio(acc, piece) >= VOICE_DUP_OVERLAP_THRESHOLD){
      acc = piece.length >= acc.length ? piece : acc; // 표현만 다른 재인식 → 더 긴 쪽 채택
      continue;
    }
    acc += (acc?" ":"") + piece; // 진짜 별개의 문장 → 이어붙임
  }
  return acc;
}
function setupVoicePad(q){
  const ta = document.getElementById("voicePadTextarea");
  const clearBtn = document.getElementById("voicePadClearBtn");
  const recBtn = document.getElementById("voicePadRecBtn");
  const askBtn = document.getElementById("voicePadAskBtn");
  const statusEl = document.getElementById("voicePadStatus");
  if(!ta || !recBtn) return;
  if(!state.voiceMemos) state.voiceMemos = {};
  ta.value = state.voiceMemos[q.id] || "";
  ta.addEventListener("input", ()=>{ state.voiceMemos[q.id] = ta.value; });
  if(clearBtn) clearBtn.addEventListener("click", ()=>{
    ta.value = "";
    delete state.voiceMemos[q.id];
    ta.focus();
  });

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    recBtn.disabled = true;
    recBtn.textContent = "🎙️ 이 브라우저는 음성인식 미지원";
    if(statusEl) statusEl.textContent = "Chrome/Safari 최신 버전에서 사용해보세요.";
  } else {
    let recognizing = false;
    let recognizer = null;
    let baseText = ""; // 녹음 시작 전 입력창에 이미 있던 텍스트
    let finalSegments = []; // 인식 세션이 끝날 때마다 "그 세션이 확정한 문장"을 하나씩 통째로 담는다
    let restartCount = 0; // 재시작할 때마다 안드로이드의 시작/종료 알림음("삑삑")이 들리므로,
                           // 재시작이 계속 이어지면 텀을 점점 늘려서 그 소리 빈도 자체를 줄인다.
    const nextRestartDelay = ()=> Math.min(800 + restartCount*600, 2600);
    const renderText = (sessionFinal, sessionInterim)=>{
      // 화면에 보여줄 텍스트는 매번 (기존 텍스트 + 확정된 세그먼트들 + 지금 세션의 확정/중간 결과)를
      // 처음부터 다시 조립한다. ta.value를 읽어서 그 위에 또 쌓지 않기 때문에(이전 방식의 문제),
      // 세션이 여러 번 끊겼다 이어져도 같은 말이 중복으로 쌓이지 않는다.
      const parts = [baseText.trim(), ...finalSegments, sessionFinal].filter(Boolean);
      let text = parts.join(" ");
      if(sessionInterim) text += (text?" ":"") + sessionInterim;
      ta.value = text;
      state.voiceMemos[q.id] = text;
    };
    const startSession = ()=>{
      recognizer = new SR();
      recognizer.lang = "ko-KR";
      recognizer.interimResults = true;
      recognizer.continuous = true;
      let sessionFinal = "", sessionInterim = "";
      recognizer.onresult = (e)=>{
        let finalPieces = [], i = "";
        for(let idx=0; idx<e.results.length; idx++){
          const r = e.results[idx];
          if(r.isFinal) finalPieces.push(r[0].transcript);
          else i += r[0].transcript;
        }
        sessionFinal = mergeGrowingPieces(finalPieces);
        sessionInterim = i;
        renderText(sessionFinal, sessionInterim);
      };
      recognizer.onerror = (e)=>{
        const info = voiceErrorInfo(e && e.error);
        if(info.fatal){
          if(statusEl) statusEl.textContent = info.msg;
          stopRec(); // no-speech/aborted처럼 흔한 상황이 아니면(권한·마이크·네트워크 문제) 계속 듣기를 멈추고 사용자에게 알린다
        }
      };
      recognizer.onend = ()=>{
        if(!recognizing) return;
        // 이 세션이 확정한 문장을 통째로 배열에 담아둔다(끊어 말해도 앞 내용이 사라지지 않도록).
        if(sessionFinal) pushVoiceSegment(finalSegments, sessionFinal);
        // 끝나자마자 바로 재시작하면 마이크 버퍼가 덜 정리된 채로 겹쳐서, 같은 말이
        // 여러 번 중복 인식되는 문제가 있었다. 재시작 텀을 두고, 재시작이 반복될수록
        // 그 텀을 점점 늘려서(안드로이드 알림음이 너무 잦지 않도록) 재시작 자체를 줄인다.
        restartCount++;
        setTimeout(()=>{ if(recognizing){ try{ startSession(); }catch(e){} } }, nextRestartDelay());
      };
      recognizer.start();
    };
    const startRec = ()=>{
      baseText = ta.value || "";
      finalSegments = [];
      restartCount = 0;
      startSession();
      recognizing = true;
      recBtn.classList.add("recording");
      recBtn.textContent = "⏹ 녹음 중지";
      if(statusEl) statusEl.textContent = "듣고 있어요… 말씀해주세요.";
    };
    const stopRec = ()=>{
      recognizing = false;
      if(recognizer){ try{ recognizer.stop(); }catch(e){} }
      recBtn.classList.remove("recording");
      recBtn.textContent = "🎙️ 녹음 시작";
      if(statusEl) statusEl.textContent = "";
    };
    recBtn.addEventListener("click", ()=>{
      if(voiceStudyAutoListening){
        // 음성학습모드가 이미 자동으로 듣고 있는 중이면, 수동 녹음을 별도로 또 시작하지 않는다.
        // (동시에 두 개의 음성인식이 마이크를 두고 충돌하면 아예 텍스트가 안 잡히는 문제가 있었음)
        if(statusEl) statusEl.textContent = "음성학습모드가 자동으로 듣고 있어요. 별도로 누르지 않아도 돼요.";
        return;
      }
      if(recognizing) stopRec(); else startRec();
    });
  }

  if(askBtn){
    askBtn.addEventListener("click", ()=>{
      if(!("speechSynthesis" in window)){
        if(statusEl) statusEl.textContent = "이 브라우저는 음성 읽기를 지원하지 않아요.";
        return;
      }
      speakOnce(q.question.replace(/\{\{img:\d+\}\}/g, "").replace(/\{\{BOX\}\}|\{\{\/BOX\}\}/g, ""));
    });
  }
}
function setupPenCanvas(q){
  const wrap = document.getElementById("penCanvasWrap");
  const canvas = document.getElementById("penCanvas");
  if(!canvas || !wrap) return;
  const dpr = window.devicePixelRatio || 1;

  const saved = getPenNoteFor(q.id);
  let strokes = saved ? saved.map(normalizeStroke) : [];
  let curStroke = null;
  let curTool = "ballpen"; // 'ballpen' | 'highlighter' | 'eraser'
  let curColor = PEN_TOOL_PRESETS.ballpen.colors[0];
  let erasing = false;

  let cssW = 0, cssH = 0, ctx = null;
  function applySize(){
    // getBoundingClientRect()를 그리기 크기와 좌표 계산 양쪽에 똑같이 써서
    // (테두리 유무 등으로 clientWidth/Height와 어긋나) 펜촉 위치와 실제 그려지는
    // 위치가 미세하게 달라지는 문제를 없앤다.
    const r = canvas.getBoundingClientRect();
    cssW = r.width || 300;
    cssH = r.height || PEN_CANVAS_MIN_HEIGHT;
    canvas.width = Math.round(cssW*dpr);
    canvas.height = Math.round(cssH*dpr);
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }
  applySize();
  strokes = migrateStrokesToAbsoluteY(strokes, cssH);

  function redraw(){
    ctx.clearRect(0, 0, cssW, cssH);
    strokes.forEach(s=>{
      if(!s.pts || s.pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha = (typeof s.alpha === "number") ? s.alpha : 1;
      ctx.globalCompositeOperation = s.blend || "source-over";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      // x는 캔버스 폭 대비 정규화 좌표(0~1), y는 위쪽 기준 절대 픽셀 좌표.
      // 높이를 늘려도 기존 획이 다시 늘어나지 않고, 그냥 아래쪽에 빈 공간만 넓어진다.
      ctx.moveTo(s.pts[0][0]*cssW, s.pts[0][1]);
      for(let i=1;i<s.pts.length;i++) ctx.lineTo(s.pts[i][0]*cssW, s.pts[i][1]);
      ctx.stroke();
      ctx.restore();
    });
  }
  redraw();

  function posOf(e){
    const r = canvas.getBoundingClientRect();
    return [(e.clientX-r.left)/cssW, (e.clientY-r.top)];
  }
  const refreshHint = ()=>{
    const hintEl = document.getElementById("penPadHint");
    if(!hintEl) return;
    const on = isPenRemembered(q.id);
    hintEl.textContent = on ? "🔖 기억한 문제 · 계속 보관돼요" : "이번 세션 동안만 유지돼요 (앱 종료 시 사라짐)";
    hintEl.classList.toggle("saved", on);
  };
  const rememberBtn = document.getElementById("penPadRememberBtn");
  const refreshRememberBtn = ()=>{
    if(!rememberBtn) return;
    rememberBtn.classList.toggle("active", isPenRemembered(q.id));
  };
  refreshHint();
  refreshRememberBtn();

  function persist(){
    if(!state.penMemos) state.penMemos = {};
    capStrokes(strokes);
    state.penMemos[q.id] = strokes;
    if(!isPenRemembered(q.id)) return;
    // 전체 저장량이 한도를 넘으면 더 이상 영구 저장하지 않고 한 번만 경고(세션당 1회)
    const prospective = penNotesSizeBytes() - JSON.stringify(store.penNotes[q.id]||[]).length + JSON.stringify(strokes).length;
    if(prospective > PEN_STORAGE_LIMIT_BYTES){
      if(!state.penStorageWarned){
        state.penStorageWarned = true;
        alert("필기 저장공간이 가득 찼어요. 일부 문제의 '기억하기'를 해제하거나 지우기를 눌러 공간을 확보해주세요.");
      }
      return;
    }
    store.penNotes[q.id] = strokes;
    saveStore();
  }
  /* ---- 획 지우개: 손가락/펜이 닿은 지점 근처를 지나는 획을 통째로 지운다 ---- */
  function eraseAt(p){
    const before = strokes.length;
    strokes = strokes.filter(s=>{
      if(!s.pts) return true;
      for(let i=0;i<s.pts.length;i++){
        const dx = (s.pts[i][0]-p[0]) * cssW; // x는 정규화 좌표라 픽셀 단위로 환산해서 비교
        const dy = s.pts[i][1]-p[1]; // y는 이미 절대 픽셀
        if(dx*dx+dy*dy <= PEN_ERASE_RADIUS_Y*PEN_ERASE_RADIUS_Y) return false; // 이 획은 지운다
      }
      return true;
    });
    if(strokes.length !== before) redraw();
  }
  /* ---- 팜 리젝션(손바닥/손 터치 무시): 펜(stylus)으로 필기 중일 때는
     터치(touch) 포인터 입력을 전부 무시한다. 애플펜슬 등 대부분의 스타일러스는
     PointerEvent.pointerType이 "pen"으로 들어오고, 손가락은 "touch"로 들어오므로
     이 값으로 구분한다. 펜이 한 번도 감지되지 않은 기기(터치만 있는 기기)에서는
     기존처럼 터치로 필기할 수 있도록, "펜 입력을 실제로 받은 적 있을 때만" 터치를 막는다.
     penInputModeGlobal로 사용자가 직접 이 자동판별을 무시하고 강제할 수도 있다:
     'penOnly' = 손가락은 항상 무시, 'touch' = 손가락도 항상 허용, 'auto' = 위 자동판별 로직. */
  let activePenPointerId = null;
  function shouldIgnoreTouch(){
    if(penInputModeGlobal === "touch") return false;
    if(penInputModeGlobal === "penOnly") return true;
    return penEverUsedGlobal || activePenPointerId !== null;
  }
  canvas.addEventListener("pointerdown", e=>{
    if(e.pointerType === "pen") { penEverUsedGlobal = true; activePenPointerId = e.pointerId; }
    if(e.pointerType === "touch" && shouldIgnoreTouch()) return; // 손바닥/손가락 등 터치 무시
    e.preventDefault();
    if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    if(curTool === "eraser"){
      erasing = true;
      eraseAt(posOf(e));
      return;
    }
    const preset = PEN_TOOL_PRESETS[curTool] || PEN_TOOL_PRESETS.ballpen;
    curStroke = { pts:[posOf(e)], w: preset.width, color: curColor, alpha: preset.alpha, blend: preset.blend };
    strokes.push(curStroke);
  });
  canvas.addEventListener("pointermove", e=>{
    if(e.pointerType === "touch" && shouldIgnoreTouch()) return; // 손바닥/손가락 등 터치 무시
    if(erasing){ eraseAt(posOf(e)); return; }
    if(!curStroke) return;
    const p = posOf(e);
    const last = curStroke.pts[curStroke.pts.length-1];
    // 직전 점과 너무 가까우면 기록하지 않는다(용량 압축)
    if(last){
      const dx = (p[0]-last[0]) * cssW; // x는 정규화 좌표라 픽셀로 환산
      const dy = p[1]-last[1]; // y는 이미 절대 픽셀
      if((dx*dx+dy*dy) < PEN_MIN_POINT_DIST_PX*PEN_MIN_POINT_DIST_PX) return;
    }
    curStroke.pts.push(p);
    redraw();
  });
  const endStroke = (e)=>{
    if(e && e.pointerType === "touch" && shouldIgnoreTouch() && e.pointerId !== activePenPointerId) return;
    if(e && e.pointerType === "pen" && e.pointerId === activePenPointerId) activePenPointerId = null;
    if(erasing){ erasing = false; persist(); return; }
    if(!curStroke) return;
    curStroke = null;
    persist();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", (e)=>{ if(curStroke || erasing) endStroke(e); });

  /* ---- 필기 입력 인식 모드 선택 버튼 ---- */
  const inputModeBtns = {
    auto: document.getElementById("penInputModeAutoBtn"),
    penOnly: document.getElementById("penInputModePenOnlyBtn"),
    touch: document.getElementById("penInputModeTouchBtn")
  };
  function refreshInputModeBtns(){
    Object.entries(inputModeBtns).forEach(([k,el])=>{ if(el) el.classList.toggle("active", k===penInputModeGlobal); });
  }
  refreshInputModeBtns();
  Object.entries(inputModeBtns).forEach(([k,el])=>{
    if(!el) return;
    el.addEventListener("click", ()=>{
      penInputModeGlobal = k;
      refreshInputModeBtns();
    });
  });

  /* ---- 도구 전환(볼펜/형광펜/획지우개) 및 도구별 색상 팔레트 ---- */
  const toolBtns = {
    ballpen: document.getElementById("penToolBallpenBtn"),
    highlighter: document.getElementById("penToolHighlighterBtn"),
    eraser: document.getElementById("penToolEraserBtn")
  };
  const swatchWrap = document.getElementById("penColorSwatches");
  const renderSwatches = ()=>{
    if(!swatchWrap) return;
    const preset = PEN_TOOL_PRESETS[curTool];
    if(!preset){ swatchWrap.innerHTML = ""; return; } // 지우개는 색상 없음
    swatchWrap.innerHTML = preset.colors.map(c=>
      `<button type="button" class="pen-swatch${c===curColor?' active':''}" style="background:${c}" data-color="${c}" title="${c}"></button>`
    ).join("");
    swatchWrap.querySelectorAll(".pen-swatch").forEach(btn=>{
      btn.onclick = ()=>{
        curColor = btn.dataset.color;
        swatchWrap.querySelectorAll(".pen-swatch").forEach(b=> b.classList.toggle("active", b===btn));
      };
    });
  };
  const refreshToolBtns = ()=>{
    Object.entries(toolBtns).forEach(([name, btn])=>{ if(btn) btn.classList.toggle("active", curTool===name); });
    renderSwatches();
  };
  Object.entries(toolBtns).forEach(([name, btn])=>{
    if(!btn) return;
    btn.onclick = ()=>{
      curTool = name;
      if(PEN_TOOL_PRESETS[name] && !PEN_TOOL_PRESETS[name].colors.includes(curColor)){
        curColor = PEN_TOOL_PRESETS[name].colors[0];
      }
      refreshToolBtns();
    };
  });
  refreshToolBtns();

  /* ---- 되돌리기: 가장 최근 획을 지운다 ---- */
  const undoBtn = document.getElementById("penUndoBtn");
  if(undoBtn){
    undoBtn.onclick = ()=>{
      if(!strokes.length) return;
      strokes.pop();
      redraw();
      persist();
    };
  }

  const clearBtn = document.getElementById("penPadClearBtn");
  if(clearBtn){
    clearBtn.onclick = ()=>{
      strokes = [];
      curStroke = null;
      redraw();
      if(!state.penMemos) state.penMemos = {};
      state.penMemos[q.id] = strokes;
      if(store.penNotes[q.id]){ delete store.penNotes[q.id]; saveStore(); }
    };
  }
  if(rememberBtn){
    rememberBtn.onclick = ()=>{
      const now = !isPenRemembered(q.id);
      if(!store.penRemembered) store.penRemembered = {};
      if(now){
        store.penRemembered[q.id] = true;
        persist(); // 지금까지 그린 내용을 즉시 영구 저장으로 전환
      }else{
        delete store.penRemembered[q.id];
        if(store.penNotes[q.id]) delete store.penNotes[q.id]; // 기억 해제 시 저장공간 회수
        saveStore();
      }
      refreshHint();
      refreshRememberBtn();
    };
  }

  /* ---- 캔버스 높이 조절: 아래쪽 손잡이를 드래그해서 늘리거나 줄인다(기본 190px, 최대 560px) ---- */
  const resizeHandle = document.getElementById("penResizeHandle");
  if(resizeHandle){
    let dragStartY = null, dragStartH = 0;
    const onMove = (e)=>{
      if(dragStartY === null) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newH = Math.max(PEN_CANVAS_MIN_HEIGHT, Math.min(PEN_CANVAS_MAX_HEIGHT, dragStartH + (clientY - dragStartY)));
      wrap.style.height = newH + "px";
      applySize();
      redraw();
    };
    const onEnd = ()=>{
      dragStartY = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
    };
    resizeHandle.addEventListener("pointerdown", e=>{
      e.preventDefault();
      dragStartY = e.clientY;
      dragStartH = wrap.getBoundingClientRect().height;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
    });
  }

  /* ---- 재측정 함수 등록: 필기 탭이 화면에 보이지 않는 상태(display:none)에서 setupPenCanvas가
     실행되면 getBoundingClientRect()가 0(또는 fallback 값)을 반환해 캔버스가 잘못된 크기로
     잡힌다. 탭이 "필기"로 전환되어 실제로 보이는 순간, 그리고 브라우저 창 크기가 바뀔 때마다
     이 함수를 다시 호출해서 실제 표시 크기에 맞게 다시 측정하고 다시 그린다. */
  currentPenResync = ()=>{
    const wasW = cssW, wasH = cssH;
    applySize();
    // 캔버스가 처음으로 실제 크기를 얻은 경우(이전엔 0이었던 경우)에만 좌표계를 다시 계산할
    // 필요는 없다 — x는 어차피 매번 cssW 기준으로 정규화돼 그려지고, y는 절대 픽셀이라
    // 처음 0으로 잘못 측정된 상태에서 저장된 좌표가 없다면(즉 새 문항) 그냥 다시 그리면 된다.
    redraw();
  };
  currentPenResync();
}

/* ============ 상태/렌더 ============ */
let state = { view:"home", queue:[], idx:0, examAnswers:{}, examTimeLeft:0, examTimer:null, unitFilter:null, yearFilter:null, studyMode:"exam", voiceDelay:3, penMemos:{} };
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
    stopVoiceStudyRecognizer();
    voicePaused = false;
    voicePhase = null;
    releaseWakeLockNow();
  }
  // 모의고사 화면(설정 화면이든, 실제 응시 중이든 state.view는 계속 "exam")을 벗어나는데
  // 타이머가 아직 돌고 있으면 멈춘다. 안 멈추면 다른 메뉴로 이동해도 백그라운드에서 타이머가
  // 계속 흐르면서 60초마다 자동저장(동기화 알림)을 반복 트리거하는 문제가 있었음.
  // 진행상황·남은시간은 이미 저장되어 있어서, 나중에 "이어서 하기"로 정확히 이어서 풀 수 있다.
  if(state.view === "exam" && v !== "exam" && state.examTimer){
    clearInterval(state.examTimer);
    state.examTimer = null;
    saveExamSession();
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
  if(left) left.textContent = `Ver. ${APP_VERSION}`;
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
  const modes = getReviewCountModes();
  const map = {};
  Object.values(store.progress || {}).forEach(p=>{
    if(!p || !p.history) return;
    p.history.forEach(h=>{
      if(!h || !h.date) return;
      if(!modes.includes(historyModeOf(h))) return;
      if(!map[h.date]) map[h.date] = {count:0, correct:0, graded:0};
      map[h.date].count++;
      // 채점 없이 넘긴(passive) 항목은 학습 카운트에는 포함하되, 정답률 계산에서는 제외한다.
      if(typeof h.score === "number"){
        map[h.date].graded++;
        if(h.score>=75) map[h.date].correct++;
      }
    });
  });
  const today = new Date();
  const result = [];
  for(let i=days-1;i>=0;i--){
    const d = new Date(today);
    d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const rec = map[key] || {count:0, correct:0, graded:0};
    const pct = rec.graded ? Math.round((rec.correct/rec.graded)*100) : null;
    result.push({date:key, count:rec.count, pct, isToday: i===0});
  }
  return result;
}

function todaySolvedCount(){
  const modes = getReviewCountModes();
  const t = todayStr();
  let n = 0;
  Object.values(store.progress || {}).forEach(p=>{
    if(!p || !p.history) return;
    p.history.forEach(h=>{ if(h && h.date===t && modes.includes(historyModeOf(h))) n++; });
  });
  return n;
}

/* ---- 회독 학습 화면 상단 대시보드용 통계 ---- */
function overallProgressStats(){
  const data = getData();
  const total = data.length;
  const idSet = new Set(data.map(q=>q.id));
  let done = 0;
  Object.keys(store.progress||{}).forEach(qid=>{ if(idSet.has(qid)) done++; });
  const pct = total ? Math.round((done/total)*100) : 0;
  return {done, total, pct};
}
function reviewPaceInfo(){
  const goal = dailyReviewGoal();
  if(goal===null) return null;
  const ds = dailyStats(7);
  const sum = ds.reduce((s,d)=>s+d.count,0);
  const avg = sum / ds.length;
  const diff = Math.round(avg - goal);
  return {goal, avg: Math.round(avg*10)/10, diff};
}
/* 문항별 최초 학습일 기준, 최근 N일 동안의 누적 진도율(%) 추이 */
function cumulativeProgressTrend(days){
  const total = getData().length;
  const firstDates = [];
  Object.values(store.progress||{}).forEach(p=>{
    if(!p || !p.history || !p.history.length) return;
    let min = p.history[0].date;
    p.history.forEach(h=>{ if(h && h.date && h.date < min) min = h.date; });
    firstDates.push(min);
  });
  firstDates.sort();
  const today = new Date();
  const result = [];
  for(let i=days-1;i>=0;i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    let doneBy = 0;
    for(const fd of firstDates){ if(fd<=key) doneBy++; else break; }
    result.push({date:key, pct: total ? Math.round((doneBy/total)*100) : 0, isToday:i===0});
  }
  return result;
}
/* 문항별 최초 학습일 기준, 목표 설정 시점(또는 최초 학습일)부터 D-day까지 전체 기간의 누적 진도율(%) 추이.
   기간이 길면 막대가 너무 촘촘해지므로 버킷(며칠 단위) 단위로 묶어서 막대 개수를 20~30개 이내로 유지하고,
   각 버킷마다 "오늘부터 D-day까지 선형으로 100%에 도달하기 위한 이상적 진도율"도 함께 계산해 비교할 수 있게 한다. */
function cumulativeProgressTrendByPeriod(){
  const total = getData().length;
  const firstDates = [];
  Object.values(store.progress||{}).forEach(p=>{
    if(!p || !p.history || !p.history.length) return;
    let min = p.history[0].date;
    p.history.forEach(h=>{ if(h && h.date && h.date < min) min = h.date; });
    firstDates.push(min);
  });
  firstDates.sort();
  const todayKey = todayStr();
  const endKey = store.targetDate || todayKey;
  let startKey = firstDates.length ? firstDates[0] : todayKey;
  if(startKey > endKey) startKey = endKey;

  const startDate = new Date(startKey+"T00:00:00");
  const endDate = new Date(endKey+"T00:00:00");
  const periodDays = Math.max(1, Math.round((endDate-startDate)/86400000) + 1);
  const bucketDays = Math.max(1, Math.ceil(periodDays/26)); // 막대 개수를 대략 20~30개 이내로 유지

  const buckets = [];
  let cursor = new Date(startDate);
  while(cursor <= endDate){
    const bStartKey = cursor.toISOString().slice(0,10);
    const bEnd = new Date(cursor); bEnd.setDate(bEnd.getDate()+bucketDays-1);
    if(bEnd > endDate) bEnd.setTime(endDate.getTime());
    const bEndKey = bEnd.toISOString().slice(0,10);
    let doneBy = 0;
    for(const fd of firstDates){ if(fd<=bEndKey) doneBy++; else break; }
    const pct = total ? Math.round((doneBy/total)*100) : 0;
    const elapsedDays = Math.round((bEnd-startDate)/86400000) + 1;
    const idealPct = Math.min(100, Math.round((elapsedDays/periodDays)*100));
    const isToday = todayKey >= bStartKey && todayKey <= bEndKey;
    buckets.push({start:bStartKey, end:bEndKey, pct, idealPct, isToday});
    cursor.setDate(cursor.getDate()+bucketDays);
  }

  const overall = overallProgressStats();
  const todayElapsed = Math.min(periodDays, Math.max(0, Math.round((new Date(todayKey+"T00:00:00")-startDate)/86400000) + 1));
  const todayIdealPct = Math.min(100, Math.round((todayElapsed/periodDays)*100));
  const daysLeft = store.targetDate ? daysUntilTarget(store.targetDate) : null;
  const diffPct = overall.pct - todayIdealPct;

  return {buckets, startDate:startKey, endDate:endKey, todayIdealPct, actualPct: overall.pct, diffPct, daysLeft};
}
function daysUntilTarget(dateStr){
  const target = new Date(dateStr+"T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((target-today)/86400000);
}
const DOW_NAMES_KR = ["일","월","화","수","목","금","토"];
function dowLabelOf(dateStr){
  return DOW_NAMES_KR[new Date(dateStr+"T00:00:00").getDay()];
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
  const reviewQ = buildDailyReviewQueue();
  const reviewGoalToday = reviewQ.goal;
  const reviewDoneToday = todaySolvedCount();
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
        <span class="ss-item">⏰<b>${reviewGoalToday!==null ? `${reviewDoneToday}/${reviewGoalToday}` : reviewQ.list.length}</b>회독</span>
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
      <button class="tile" data-go="srs"><span class="emoji">⏰</span><span class="t-title">회독 학습</span><span class="t-desc">${reviewGoalToday!==null ? `오늘 목표 ${reviewGoalToday}문항 · 진행 ${reviewDoneToday}` : "D-day·목표 회독수를 설정해보세요"}</span></button>
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
      store = {progress:{}, wrong:{}, bookmarks:{}, penNotes:{}, penRemembered:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:store.customData, edits:store.edits, examConfig:store.examConfig, targetDate:store.targetDate};
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
      if(tagTarget){ openTagModal(tagTarget.dataset.tag); return; }
      openCardModal(el.dataset.id);
    });
  });
}

let unitPickerTab = "unit"; // "unit" | "keyword" — 단원별 연습 화면 상단 탭
let reviewTypeFilter = "all"; // "all" | "quick" | "write" — 회독 학습 화면 유형 필터
let rdSettingsOpen = false; // 회독 학습 화면의 "시험일자·회독 설정 · 학습 구성 비율" 접기/펼치기 상태

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
  const allData = getData();
  // 연도·회차별 화면은 기본적으로 "실제 시험 회차"를 고르는 화면이지만, 연도 정보가
  // 없는 문제(챕터/교재 단위로만 정리된 이론 문제 등)도 여기서 아예 안 보이면 놓치기
  // 쉬우므로, 맨 마지막에 "회차 미분류" 칩 하나로 모아서 같이 보여준다.
  const dated = allData.filter(d=> d.year != null);
  const undated = allData.filter(d=> d.year == null);
  const multiRound = datasetHasMultiRound(dated);
  const multiPart = datasetHasMultiExamPart(dated);
  const combos = {};
  dated.forEach(d=>{
    const key = d.year + "-" + (d.round||1) + (multiPart ? "-"+d.examPart : "");
    if(!combos[key]) combos[key] = {year:d.year, round:d.round||1, examPart:d.examPart, count:0};
    combos[key].count++;
  });
  const comboList = Object.values(combos).sort((a,b)=> b.year-a.year || b.round-a.round || String(a.examPart||"").localeCompare(String(b.examPart||"")));
  const labelOf = (c)=> `${c.year}년${multiRound?" "+c.round+"회":""}${multiPart?" · "+c.examPart:""}`;
  setPageBar(multiRound ? "연도·회차별" : "연도별");
  const undatedChip = undated.length ? `<button class="chip chip-undated" data-year="null" data-round="" data-part="">회차 미분류<span class="chip-count">${undated.length}문항</span>${repeatBadgeHtml("year", "회차 미분류")}</button>` : "";
  app.innerHTML = `
    <div class="section-card">
      <h3>${multiRound ? "연도·회차를 선택하세요" : "연도를 선택하세요"}</h3>
      ${multiPart ? `<p style="font-size:0.78rem;color:var(--muted);margin-top:2px;">필답형과 작업형은 서로 섞이지 않도록 항목이 나뉘어 있어요.</p>` : ""}
      ${undated.length ? `<p style="font-size:0.78rem;color:var(--muted);margin-top:2px;">특정 회차가 확인되지 않은 문제는 맨 아래 "회차 미분류"로 따로 모아뒀어요.</p>` : ""}
      <div class="chip-row chip-grid chip-grid-year">${comboList.map(c=>`<button class="chip" data-year="${c.year}" data-round="${c.round}" data-part="${escapeHtml(c.examPart||"")}">${labelOf(c)}<span class="chip-count">${c.count}문항</span>${repeatBadgeHtml("year", labelOf(c))}</button>`).join("")}${undatedChip}</div>
    </div>
  `;
  app.querySelectorAll("[data-year]").forEach(b=>{
    b.addEventListener("click", ()=>{
      if(b.dataset.year === "null"){
        openModeModal(sortByNo(undated), "year", "회차 미분류", "year");
        return;
      }
      const y = Number(b.dataset.year), r = Number(b.dataset.round), p = b.dataset.part || null;
      const lbl = labelOf({year:y, round:r, examPart:p});
      openModeModal(sortByNo(dated.filter(q=> q.year===y && (q.round||1)===r && (!multiPart || q.examPart===p))), "year", lbl, "year");
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
  setPageBar("회독 학습");

  if(!store.targetDate){
    app.innerHTML = `
      <div class="section-card">
        <h3>🎯 먼저 시험일(D-day)을 설정하세요</h3>
        <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-top:6px;">
          시험일과 목표 회독수를 정하면, 남은 기간에 맞춰 하루에 몇 문제씩 봐야 할지 자동으로 계산해줘요.
          그 안에서 오답노트 · 복습주기가 돌아온 문제 · 아직 안 본 신규 문제를 원하는 비율로 섞어
          매일 학습 큐를 만들어드립니다.
        </p>
        <button class="btn primary" id="setDdayBtn" style="margin-top:14px;width:100%;">시험일 설정하기</button>
      </div>`;
    app.querySelector("#setDdayBtn").addEventListener("click", openDdayModal);
    return;
  }

  const rounds = reviewRounds();
  if(!rounds){
    const yrOptions = allYearRoundOptions();
    const yrOptionsHtml = yrOptions.map(o=>`<option value="${o.key}">${o.year}년 ${o.round}회차</option>`).join("");
    const curRange = store.reviewYearRange;
    app.innerHTML = `
      <div class="section-card">
        <h3>📅 대상 연도 범위 (선택)</h3>
        <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-top:6px;">
          최근 몇 년 기출 위주로 보고 싶다면 범위를 지정하세요. 두 개를 어느 순서로 고르든
          자동으로 앞뒤를 정리해서 적용해요. 지정 안 하면 전체 연도를 대상으로 해요.
        </p>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="onbYearA" class="search-box" style="max-width:170px;">
            <option value="">연도·회차 선택</option>
            ${yrOptionsHtml}
          </select>
          <span style="color:var(--muted);">~</span>
          <select id="onbYearB" class="search-box" style="max-width:170px;">
            <option value="">연도·회차 선택</option>
            ${yrOptionsHtml}
          </select>
        </div>
        ${curRange ? `<p style="font-size:0.78rem;color:var(--teal);margin-top:8px;">현재 설정됨 — 저장하시면 새 범위로 바뀌어요.</p>` : ""}
        <div class="btn-row" style="margin-top:10px;">
          <button class="btn ghost" id="onbSaveYearRangeBtn">이 범위로 저장</button>
          <button class="btn ghost" id="onbClearYearRangeBtn">전체 연도로 두기</button>
        </div>
      </div>

      <div class="section-card">
        <h3>📚 목표 회독수를 정해주세요</h3>
        <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-top:6px;">
          <span class="srs-dday-scope">${ddayHtml()}</span> 전까지 전체 ${getData().length}문항을 몇 번 반복해서 볼지 정하면,
          하루 목표 문항수를 자동으로 계산해드려요. 언제든 나중에 바꿀 수 있어요.
        </p>
        <div class="chip-row" style="margin-top:14px;">
          ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="chip" data-set-rounds="${n}">${n}회독</button>`).join("")}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center;">
          <input type="number" id="customRoundsInput" class="search-box" min="1" max="20" placeholder="직접 입력" style="max-width:140px;">
          <button class="btn primary" id="customRoundsBtn">설정</button>
        </div>
      </div>`;
    app.querySelector("#onbSaveYearRangeBtn").addEventListener("click", ()=>{
      const a = app.querySelector("#onbYearA").value;
      const b = app.querySelector("#onbYearB").value;
      if(!a || !b){ alert("연도·회차 두 개를 모두 골라주세요."); return; }
      const ka = Number(a), kb = Number(b);
      store.reviewYearRange = {minKey: Math.min(ka,kb), maxKey: Math.max(ka,kb)};
      saveStore();
      renderSRSList();
    });
    app.querySelector("#onbClearYearRangeBtn").addEventListener("click", ()=>{
      store.reviewYearRange = null;
      saveStore();
      renderSRSList();
    });
    app.querySelectorAll("[data-set-rounds]").forEach(b=>{
      b.addEventListener("click", ()=>{
        store.reviewGoal = {rounds: Number(b.dataset.setRounds)};
        saveStore(); renderSRSList();
      });
    });
    app.querySelector("#customRoundsBtn").addEventListener("click", ()=>{
      const v = Number(app.querySelector("#customRoundsInput").value);
      if(v>=1){ store.reviewGoal = {rounds:v}; saveStore(); renderSRSList(); }
      else alert("1 이상의 숫자를 입력해주세요.");
    });
    return;
  }

  const q = buildDailyReviewQueue();
  const mix = reviewMix();
  const doneToday = todaySolvedCount();
  const goal = q.goal;
  const pct = goal ? Math.min(100, Math.round((doneToday/goal)*100)) : 0;
  const filteredList = reviewTypeFilter==="all" ? q.list
    : q.list.filter(x=> reviewTypeFilter==="quick" ? isQuickRecall(x) : !isQuickRecall(x));
  const roundModes = getRoundModes();
  const round = currentSrsRound();
  const todaysMode = currentRoundMode();

  const overall = overallProgressStats();
  const pace = reviewPaceInfo();
  const paceClass = pace && pace.diff>=0 ? "rd-pace-good" : "rd-pace-bad";
  const paceText = !pace ? "-" : (pace.diff>0 ? `목표보다 하루 ${pace.diff}문항 앞서고 있어요`
    : pace.diff<0 ? `목표보다 하루 ${Math.abs(pace.diff)}문항 부족해요`
    : "목표 페이스를 딱 맞추고 있어요");
  const rdDays = dailyStats(14);
  const rdMax = Math.max(1, goal||0, ...rdDays.map(d=>d.count));
  const rdBarAreaH = 50;
  const rdGoalH = goal ? Math.max(0, Math.round((goal/rdMax)*rdBarAreaH)) : null;
  const dowNames14 = ["일","월","화","수","목","금","토"];
  const countModes = getReviewCountModes();

  /* 우측 "오늘 학습" 미니 스택바: 오답/복습/신규 구성비 + 진행률 오버레이 */
  const goalForMini = goal || (q.counts.wrong+q.counts.srs+q.counts.new) || 1;
  const wrongShare = Math.round(q.counts.wrong/goalForMini*100);
  const srsShare = Math.round(q.counts.srs/goalForMini*100);
  const newShareEnd = 100; // 나머지는 신규 구간으로 채움(반올림 오차 흡수)
  const remainPct = Math.max(0, 100-pct);
  const todayMiniHtml = `
    <div class="rd-col-title">오늘 학습 진도</div>
    <div class="rd-today-stack-track">
      <div class="rd-today-stack" style="background:linear-gradient(to right,
        var(--rose) 0%, var(--rose) ${wrongShare}%,
        var(--amber) ${wrongShare}%, var(--amber) ${wrongShare+srsShare}%,
        var(--teal) ${wrongShare+srsShare}%, var(--teal) ${newShareEnd}%);">
        <div class="rd-today-stack-remain" style="width:${remainPct}%"></div>
      </div>
    </div>
    <div class="rd-today-mini-legend">
      <span class="lg">🔴 오답 ${q.counts.wrong}</span>
      <span class="lg">🟡 복습 ${q.counts.srs}</span>
      <span class="lg">🟢 신규 ${q.counts.new}</span>
    </div>
    <div class="rd-today-mini-sub">진행 <b>${doneToday}</b> / 목표 ${goal||0}문항 (${pct}%)</div>`;

  /* 하단 전체 진행률 그래프: D-day 전체 기간 기준 */
  const period = cumulativeProgressTrendByPeriod();
  const daysLeftLabel = period.daysLeft===null ? ""
    : period.daysLeft>0 ? `D-day까지 ${period.daysLeft}일 남음`
    : period.daysLeft===0 ? "D-DAY"
    : `D-day ${Math.abs(period.daysLeft)}일 경과`;
  const paceClass2 = period.diffPct>=0 ? "rd-pace-good" : "rd-pace-bad";
  const paceWord2 = period.diffPct>0 ? "앞섬" : (period.diffPct<0 ? "뒤처짐" : "일치");
  const periodSummaryHtml = period.diffPct===0
    ? `${daysLeftLabel} · 목표 페이스와 정확히 <b class="${paceClass2}">일치</b>`
    : `${daysLeftLabel} · 목표 페이스 대비 진도 <b class="${paceClass2}">${paceWord2} ${Math.abs(period.diffPct)}%p</b>`;
  const periodBarsHtml = period.buckets.map(b=>{
    const barH = Math.max(2, Math.round(b.pct/100*66));
    const idealBottom = Math.min(66, Math.round(b.idealPct/100*66));
    const tip = `${b.start}~${b.end} · 실제 진도 ${b.pct}% (목표 페이스 ${b.idealPct}%)`;
    return `<div class="rd-period-col" title="${tip}">
      <div class="rd-period-bar ${b.isToday?'today':''}" style="height:${barH}px"></div>
      <div class="rd-period-ideal" style="bottom:${idealBottom}px"></div>
    </div>`;
  }).join("");

  app.innerHTML = `
    <div class="section-card review-goal-card">
      <div class="rd-top-grid">
        <div class="rd-top-col rd-col-left">
          <div class="rd-info-grid">
            <div class="rd-info-cell rd-info-dday">
              <div class="rd-head-dday-big">${ddayHtml()}</div>
            </div>
            <div class="rd-info-cell rd-info-round">
              <div class="rd-info-round-num">${round}<span>/${rounds}</span></div>
              <div class="rd-info-round-label">회독 중</div>
            </div>
            <div class="rd-info-cell rd-info-exam">
              <div class="rd-info-label">시험일</div>
              <div class="rd-info-value">${store.targetDate ? `${store.targetDate.replace(/-/g,'.')}<br>(${dowLabelOf(store.targetDate)}요일)` : "미설정"}</div>
            </div>
            <div class="rd-info-cell rd-info-mode">
              <div class="rd-info-label">회독 방식</div>
              <div class="rd-info-mode-value">
                <button class="round-nav-btn sm" id="roundPrevBtn" title="이전 회차로 이동" ${round<=1?"disabled":""}>◀</button>
                <b>${roundModeLabel(todaysMode)}</b>
                <button class="round-nav-btn sm" id="roundNextBtn" title="다음 회차로 이동" ${round>=rounds?"disabled":""}>▶</button>
              </div>
            </div>
          </div>
        </div>

        <div class="rd-top-col rd-col-mid">
          <div class="rd-col-title">전체 진도</div>
          <div class="rd-gauge" style="background:conic-gradient(var(--teal) ${overall.pct*3.6}deg, var(--teal-soft) 0deg);">
            <div class="rd-gauge-inner"><b>${overall.pct}%</b><span>전체진도</span></div>
          </div>
          <div class="rd-gauge-caption"><b>${overall.done}/${overall.total}</b>문항</div>
          <div class="rd-gauge-caption">최근 7일 페이스<br><b class="${paceClass}">${paceText}</b></div>
        </div>

        <div class="rd-top-col rd-col-right">
          ${todayMiniHtml}
        </div>
      </div>

      <div class="rd-section-block">
        <div class="ds-title">최근 14일 · 일별 학습량 (점선 = 오늘 목표 ${goal}문항)</div>
        <div class="rd-row">
          ${rdGoalH!==null ? `<div class="rd-goal-line" style="bottom:${18+rdGoalH}px;"><span>목표</span></div>` : ""}
          <div class="rd-bars">
            ${rdDays.map(d=>{
              const h = d.count ? Math.max(4, Math.round((d.count/rdMax)*rdBarAreaH)) : 2;
              const dow = dowNames14[new Date(d.date+"T00:00:00").getDay()];
              const tip = `${d.date} · ${d.count}문제`;
              return `<div class="rd-col" title="${tip}">
                <div class="rd-count">${d.count?d.count:""}</div>
                <div class="rd-bar-track" style="height:${rdBarAreaH}px;"><div class="rd-bar ${d.count?"has-data":""} ${d.isToday?"today":""}" style="height:${h}px"></div></div>
                <div class="rd-day">${dow}</div>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="rd-section-block">
        <div class="rd-period-title">${period.startDate} ~ ${period.endDate}(D-day) · 전체 기간 누적 진도율 추이</div>
        <div class="rd-period-summary">${periodSummaryHtml}</div>
        <div class="rd-period-bars">${periodBarsHtml}</div>
        <div class="rd-period-legend">
          <span><span class="sw"></span>실제 누적 진도율</span>
          <span><span class="ln"></span>목표 페이스(선형)</span>
        </div>
      </div>
    </div>

    <div class="section-card">
      <h3>오늘 학습할 문제 (${filteredList.length}문항)</h3>
      <div class="unit-level-toggle" style="margin-top:8px;">
        <button data-filter="all" class="${reviewTypeFilter==='all'?'active':''}">전체</button>
        <button data-filter="quick" class="${reviewTypeFilter==='quick'?'active':''}">⚡ 빠른회상</button>
        <button data-filter="write" class="${reviewTypeFilter==='write'?'active':''}">✍️ 정리학습</button>
      </div>
      ${filteredList.length
        ? `<button class="btn primary" id="startReviewBtn" style="margin-top:14px;width:100%;">▶ ${round}회독 시작 (${roundModeLabel(todaysMode)})</button>
           <button class="reset-link" id="changeRoundModeLink" style="margin-top:8px;">이번만 다른 방식으로 풀기</button>`
        : `<div class="empty-note" style="margin-top:14px;">이 유형에 해당하는 오늘 목표 문항이 없어요. 다른 필터를 선택해보세요.</div>`}
    </div>

    <div class="section-card">
      <button class="unit-toggle rd-toggle ${rdSettingsOpen?'open':''}" id="settingsToggleBtn"><span>${rdSettingsOpen ? "시험일자 · 회독 설정 · 학습 구성 비율 · 회독별 방식 설정 접기" : "⚙️ 시험일자 · 회독 설정 · 학습 구성 비율 · 회독별 방식 설정"}</span><span class="arrow">▾</span></button>
      <div class="rd-detail-wrap ${rdSettingsOpen?'open':''}" id="settingsDetailWrap">
        <div style="margin-top:14px;">
          <h3>시험일자 · 회독 설정</h3>
          <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">시험일과 목표 회독수를 함께 바꿀 수 있어요. 회독수를 바꾸면 하루 목표 문항수가 다시 계산돼요.</p>
          <div style="margin-top:10px;">
            <label style="font-size:0.78rem;color:var(--muted);font-weight:700;">시험일</label>
            <input type="date" id="rdExamDateInput" class="search-box" style="margin-top:6px;" value="${store.targetDate||''}">
          </div>
          <div style="margin-top:14px;">
            <label style="font-size:0.78rem;color:var(--muted);font-weight:700;">목표 회독수</label>
            <div class="chip-row" style="margin-top:6px;">
              ${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="chip rd-rounds-chip ${rounds===n?'active':''}" data-rd-rounds="${n}">${n}회독</button>`).join("")}
            </div>
            <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
              <input type="number" id="rdCustomRoundsInput" class="search-box" min="1" max="20" placeholder="직접 입력" style="max-width:140px;" value="${rounds}">
            </div>
          </div>
          <button class="btn primary" id="saveExamSettingsBtn" style="margin-top:14px;width:100%;">저장</button>
        </div>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);">
          <h3>오늘의 학습 구성 비율</h3>
          <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">오답노트 · 복습주기 도래 · 신규문제를 원하는 비율로 섞어요. (합이 100이 아니어도 자동으로 비례 조정돼요)</p>
          <div class="mix-row">
            <div class="mix-item"><span>🔴 오답노트</span><input type="number" id="mixWrong" min="0" max="100" value="${mix.wrong}"><small>${q.counts.wrong}/${q.wrongTotal}문항</small></div>
            <div class="mix-item"><span>🟡 복습주기</span><input type="number" id="mixSrs" min="0" max="100" value="${mix.srs}"><small>${q.counts.srs}/${q.srsTotal}문항</small></div>
            <div class="mix-item"><span>🟢 신규문제</span><input type="number" id="mixNew" min="0" max="100" value="${mix.new}"><small>${q.counts.new}/${q.newTotal}문항</small></div>
          </div>
          <button class="btn ghost" id="saveMixBtn" style="margin-top:10px;width:100%;">비율 저장</button>
        </div>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);">
          <h3>대상 연도 범위</h3>
          <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">
            지정하면 오답노트·복습주기·신규문제 세 풀 모두 이 연도-회차 범위 안의 문항으로만 채워져요.
            예: 최근 3~5년 기출 위주로 보고 싶을 때. 두 개를 어느 순서로 고르든 자동으로 앞뒤가 정리돼요.
            비워두면 전체 연도 대상이에요.
          </p>
          <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <select id="rdYearAInput" class="search-box" style="max-width:170px;">
              <option value="">연도·회차 선택</option>
              ${allYearRoundOptions().map(o=>`<option value="${o.key}" ${store.reviewYearRange&&store.reviewYearRange.minKey===o.key?"selected":""}>${o.year}년 ${o.round}회차</option>`).join("")}
            </select>
            <span style="color:var(--muted);">~</span>
            <select id="rdYearBInput" class="search-box" style="max-width:170px;">
              <option value="">연도·회차 선택</option>
              ${allYearRoundOptions().map(o=>`<option value="${o.key}" ${store.reviewYearRange&&store.reviewYearRange.maxKey===o.key?"selected":""}>${o.year}년 ${o.round}회차</option>`).join("")}
            </select>
          </div>
          <p style="font-size:0.74rem;color:var(--muted);margin-top:6px;">신규문제는 항상 최신 연도부터 나와요 (예전엔 가장 오래된 연도부터 나왔던 걸 최근 기출 우선으로 바꿨어요).</p>
          <div class="btn-row" style="margin-top:10px;">
            <button class="btn ghost" id="saveYearRangeBtn">연도 범위 저장</button>
            <button class="btn ghost" id="clearYearRangeBtn">전체 연도로 초기화</button>
          </div>
        </div>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);">
          <h3>회독별 학습 방식</h3>
          <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">회차마다 다른 방식을 지정해두면, 그 회차가 되었을 때 자동으로 그 방식으로 시작해요. 예: 1·2회독은 🔊음성, 3·4회독은 📖연습, 마지막은 📝시험.</p>
          <div class="round-mode-list">
            ${roundModes.map((m,i)=>`
              <div class="round-mode-row ${i+1===round?'current':''}">
                <div class="rm-label">${i+1}회독${i+1===round?'<span class="rm-current-tag">현재</span>':''}</div>
                <div class="unit-level-toggle rm-toggle">
                  <button data-rm="${i}:practice" class="${m==='practice'?'active':''}">📖연습</button>
                  <button data-rm="${i}:exam" class="${m==='exam'?'active':''}">📝시험</button>
                  <button data-rm="${i}:voice" class="${m==='voice'?'active':''}">🔊음성</button>
                </div>
              </div>`).join("")}
          </div>
          ${round > roundModes.length ? `<p style="font-size:0.76rem;color:var(--muted);margin-top:8px;">목표 회독수(${rounds}회)를 넘어선 회차는 마지막 회차(${rounds}회독)와 같은 방식을 사용해요.</p>` : ""}
        </div>

        <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line);">
          <h3>오늘 학습 카운트에 포함할 학습 모드</h3>
          <p style="font-size:0.78rem;color:var(--muted);margin-top:4px;">체크한 모드에서 채점한 결과만 위 "오늘 학습" 진행률과 하단 그래프에 반영돼요.</p>
          <div class="review-count-mode-list">
            ${REVIEW_COUNT_MODE_GROUPS.map(g=>{
              const checked = g.modes.every(m=> countModes.includes(m));
              return `<label class="rcm-check"><input type="checkbox" data-rcm-group="${g.key}" ${checked?"checked":""}><span>${g.label}${g.key==='srs'?' (기본)':''}</span></label>`;
            }).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  app.querySelector("#settingsToggleBtn").addEventListener("click", ()=>{
    const wrap = app.querySelector("#settingsDetailWrap");
    const btn = app.querySelector("#settingsToggleBtn");
    const open = wrap.classList.toggle("open");
    btn.classList.toggle("open", open);
    rdSettingsOpen = open;
    btn.querySelector("span").textContent = open ? "시험일자 · 회독 설정 · 학습 구성 비율 · 회독별 방식 설정 접기" : "⚙️ 시험일자 · 회독 설정 · 학습 구성 비율 · 회독별 방식 설정";
  });
  app.querySelectorAll(".rd-rounds-chip").forEach(b=>{
    b.addEventListener("click", ()=>{
      app.querySelectorAll(".rd-rounds-chip").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      app.querySelector("#rdCustomRoundsInput").value = b.dataset.rdRounds;
    });
  });
  app.querySelector("#saveExamSettingsBtn").addEventListener("click", ()=>{
    const dateVal = app.querySelector("#rdExamDateInput").value;
    const roundsVal = Number(app.querySelector("#rdCustomRoundsInput").value);
    if(!dateVal){ alert("시험일을 선택해주세요."); return; }
    if(!(roundsVal>=1)){ alert("1 이상의 회독수를 입력해주세요."); return; }
    store.targetDate = dateVal;
    store.reviewGoal = {rounds: roundsVal};
    saveStore();
    renderSRSList();
  });
  app.querySelector("#roundPrevBtn").addEventListener("click", ()=>{
    store.srsRound = Math.max(1, round-1); saveStore(); renderSRSList();
  });
  app.querySelector("#roundNextBtn").addEventListener("click", ()=>{
    store.srsRound = Math.min(rounds, round+1); saveStore(); renderSRSList();
  });
  app.querySelectorAll("[data-rm]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const [idx, m] = b.dataset.rm.split(":");
      const modes = getRoundModes();
      modes[Number(idx)] = m;
      store.roundModes = modes;
      saveStore();
      renderSRSList();
    });
  });
  app.querySelectorAll("[data-filter]").forEach(b=>{
    b.addEventListener("click", ()=>{ reviewTypeFilter = b.dataset.filter; renderSRSList(); });
  });
  app.querySelectorAll("[data-rcm-group]").forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const checkedKeys = [...app.querySelectorAll("[data-rcm-group]")].filter(c=>c.checked).map(c=>c.dataset.rcmGroup);
      let modes = [];
      REVIEW_COUNT_MODE_GROUPS.forEach(g=>{ if(checkedKeys.includes(g.key)) modes = modes.concat(g.modes); });
      if(!modes.length){
        alert("최소 하나의 학습 모드를 선택해주세요.");
        chk.checked = true; // 되돌림: 전부 해제되는 상태 방지
        return;
      }
      store.reviewCountModes = modes;
      saveStore();
      renderSRSList();
    });
  });
  app.querySelector("#saveMixBtn").addEventListener("click", ()=>{
    let w = Number(app.querySelector("#mixWrong").value)||0;
    let s = Number(app.querySelector("#mixSrs").value)||0;
    let n = Number(app.querySelector("#mixNew").value)||0;
    const sum = w+s+n;
    if(sum<=0){ alert("비율의 합이 0보다 커야 해요."); return; }
    w = Math.round(w/sum*100); s = Math.round(s/sum*100); n = 100-w-s;
    store.reviewMix = {wrong:w, srs:s, new:n};
    saveStore();
    renderSRSList();
  });
  app.querySelector("#saveYearRangeBtn").addEventListener("click", ()=>{
    const a = app.querySelector("#rdYearAInput").value;
    const b = app.querySelector("#rdYearBInput").value;
    if(!a || !b){ alert("연도·회차 두 개를 모두 골라주세요."); return; }
    const ka = Number(a), kb = Number(b);
    store.reviewYearRange = {minKey: Math.min(ka,kb), maxKey: Math.max(ka,kb)};
    saveStore();
    renderSRSList();
  });
  app.querySelector("#clearYearRangeBtn").addEventListener("click", ()=>{
    store.reviewYearRange = null;
    saveStore();
    renderSRSList();
  });
  const startBtn = app.querySelector("#startReviewBtn");
  if(startBtn){
    startBtn.addEventListener("click", ()=>{
      state.studyMode = todaysMode;
      startQueue(filteredList, "srs", `${filteredList.length}문항`, "srs");
    });
  }
  const changeLink = app.querySelector("#changeRoundModeLink");
  if(changeLink){
    changeLink.addEventListener("click", ()=>{
      openModeModal(filteredList, "srs", `${filteredList.length}문항`, "srs");
    });
  }
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
        <button class="btn ghost" id="modeVoice">🔊 음성학습모드<small>문제→정답을 읽어주고 자동으로 다음 문제로 넘어가요</small></button>
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
  state.passiveCounted = new Set(); // 연습/음성 모드에서 채점 없이 넘긴 카드의 중복 카운트 방지용(세트별 초기화)
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
  // 연습/음성 모드에서 채점 없이 넘긴 카드(passive:true, score 없음)는 정답률 계산에서 제외한다.
  const graded = p.history.filter(h=>typeof h.score === "number");
  if(!graded.length) return null;
  const correct = graded.filter(h=>h.score>=75).length;
  return Math.round((correct/graded.length)*100);
}

/* ============ 연습/음성 모드 "채점 없이 넘긴" 카드 처리 ============
   연습·음성 모드에서는 정답/오답 버튼을 누르지 않고 카드를 넘겨도(다음 카드로 이동·세트 완료)
   그 문제를 "학습한 것"으로 간주해 오늘 학습 카운트·회독 진행에는 포함시킨다.
   단, 오답노트 등재나 SRS(박스/복습주기) 진행은 사용자가 실제로 정답 O/오답 X를 눌러
   명시적으로 채점했을 때(recordResult)에만 이뤄지도록, 여기서는 history에 score 없는
   "passive" 항목만 남기고 store.wrong·p.box·p.next는 건드리지 않는다. */
function recordPassiveView(qid, mode){
  const p = store.progress[qid] || {box:0, next:null, history:[]};
  p.history.push({date:todayStr(), mode: mode || state.mode || "srs", passive:true});
  store.progress[qid] = p;

  const last = store.streak.last;
  const t = todayStr();
  if(last !== t){
    if(last === addDays(t,-1)) store.streak.count += 1;
    else store.streak.count = 1;
    store.streak.last = t;
  }
  saveStore();
}
/* 현재 보고 있던 카드가 채점되지 않은 채 넘어가려 할 때, 연습/음성 모드라면 1회만
   passive 기록을 남긴다(같은 세트 안에서 앞뒤로 왔다갔다 해도 문제당 중복 카운트 방지). */
function maybeCountPassiveView(){
  if(state.view !== "card") return;
  if(state.studyMode !== "practice" && state.studyMode !== "voice") return;
  if(state.cardGraded) return;
  const q = state.queue[state.idx];
  if(!q) return;
  if(!state.passiveCounted) state.passiveCounted = new Set();
  if(state.passiveCounted.has(q.id)) return;
  state.passiveCounted.add(q.id);
  recordPassiveView(q.id, state.mode);
}

function renderCard(){
  // 새 카드로 다시 그리기 직전, 지금 실제로 키보드 입력창에 포커스가 가 있었는지(=물리 키보드로
  // 계속 타이핑 중이었는지) 기억해둔다. DOM을 다시 그리면 이 정보가 사라지므로 미리 저장.
  wasKbdFocusedBeforeRender = (document.activeElement && document.activeElement.id === "kbdPadTextarea");
  state.cardGraded = false; // 새 카드로 넘어오면 "이 카드는 아직 채점 안 됨" 상태로 초기화
  state.answerVisible = false; // 새 카드로 넘어오면 "정답보기" 버튼 라벨을 기본 상태로 초기화
  const studyNavBarEl0 = document.getElementById("studyNavBar");
  if(studyNavBarEl0) studyNavBarEl0.style.display = "block";
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
    return `<button type="button" class="tag star-freq mode-tag-btn" id="starDupTagBtn">${stars}( ${sorted.join(",")} )</button>`;
  })() : "";
  const titleLabel = state.modeLabel ? `${modeTitle(state.mode)} · ${state.modeLabel}` : modeTitle(state.mode);
  const isPractice = state.studyMode === "practice";
  const isVoice = state.studyMode === "voice";
  const modeSwitchable = ["unit","unitMinor","year","freq"].includes(state.mode);
  const modeTagLabel = isVoice ? "🔊 음성학습모드" : (isPractice ? "📖 연습모드" : "📝 시험모드");
  const modeTag = (isVoice || modeSwitchable) ? `<button type="button" class="tag mode mode-tag-btn" id="modeTagBtn">${modeTagLabel} ▾</button>` : "";
  // 이 문항의 편집 상태를 나타내는 작은 배지 두 종류(수정 버튼이 있는 줄의 맨 왼쪽에 표시):
  // - "My"(모든 사용자에게 보임): 이 기기에 내가 개인적으로 수정한 기록이 있음
  // - "All"(관리자·편집자에게만 보임): 관리자가 편집 후 전체 사용자에게 적용(발행)한 문항임
  //   (둘 다 해당하면 나란히 뜸 — 관리자가 전체 적용한 뒤 나만 또 따로 고친 경우)
  const editStatusBadges = (()=>{
    const hasLocalEdit = !!(store.edits && store.edits[q.id]);
    const canSeeAllBadge = typeof window !== "undefined" && (window.isAdmin || window.canPublishOverride);
    const hasAdminOv = canSeeAllBadge && !!adminOverrideFor(q.id);
    if(!hasLocalEdit && !hasAdminOv) return "";
    const allBadge = hasAdminOv ? `<span class="edit-status-badge all" title="관리자 편집 후 전체 적용된 문제예요">All</span>` : "";
    const myBadge = hasLocalEdit ? `<span class="edit-status-badge my" title="내가 수정한 내용이에요">My</span>` : "";
    return `${allBadge}${myBadge}`;
  })();
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
    <div class="card-box-wrap">
      <div class="card-corner-actions">
        <button class="corner-emoji-btn" id="voiceModeBtn" title="음성모드 전환">🔊</button>
        <button class="corner-emoji-btn" id="starBtn" title="즐겨찾기">☆</button>
        <button class="corner-emoji-btn" id="aiHelpBtn" title="AI 해설 보기">🤖</button>
        <button class="corner-emoji-btn" id="shareBtn" title="문제 공유하기">📤</button>
        ${typeof supabaseClient !== "undefined" && supabaseClient ? `<button class="corner-emoji-btn" id="commentBtn" title="오답의견" style="position:relative;">💬<span id="commentCountBadge" class="corner-emoji-badge" style="display:none;"></span></button>` : ""}
        <button class="corner-emoji-btn" id="editBtn" title="수정">✏️</button>
      </div>
      <div class="card-box" id="cardBox">
        ${renderTextWithImages(q.question, q.images, q.answer, editStatusBadges)}
        <div id="answerSlot"></div>
        <div id="gradeSlot"></div>
        <div class="pen-pad practice-pad">
          <div class="practice-tabs" id="practiceTabs">
            <button type="button" class="practice-tab-btn" data-tab="pen">✍️ 필기</button>
            <button type="button" class="practice-tab-btn active" data-tab="kbd">⌨️ 키보드</button>
            <button type="button" class="practice-tab-btn" data-tab="voice">🎙️ 음성</button>
          </div>

          <div class="practice-panel" id="practicePanelPen" style="display:none;">
          <div class="pen-pad-head">
            <span class="pen-pad-title">✍️ 필기 연습장</span>
            <div class="pen-pad-actions">
              <button type="button" class="pen-pad-remember" id="penPadRememberBtn" title="이 문제 필기를 계속 기억하기">🔖 기억하기</button>
              <button type="button" class="pen-pad-clear" id="penPadClearBtn">지우기</button>
            </div>
          </div>
          <div class="pen-pad-hint" id="penPadHint"></div>
          <div class="pen-input-mode-row">
            <span class="pen-input-mode-label">입력 인식:</span>
            <button type="button" class="pen-input-mode-btn" id="penInputModeAutoBtn" data-mode="auto">자동(추천)</button>
            <button type="button" class="pen-input-mode-btn" id="penInputModePenOnlyBtn" data-mode="penOnly">✒️ 펜만</button>
            <button type="button" class="pen-input-mode-btn" id="penInputModeTouchBtn" data-mode="touch">✋ 손가락도</button>
          </div>
          <div class="pen-toolbar">
            <button type="button" class="pen-tool-btn active" id="penToolBallpenBtn" data-tool="ballpen">🖊️ 볼펜</button>
            <button type="button" class="pen-tool-btn" id="penToolHighlighterBtn" data-tool="highlighter">🖍️ 형광펜</button>
            <button type="button" class="pen-tool-btn" id="penToolEraserBtn" data-tool="eraser">🧹 지우개</button>
            <div class="pen-color-swatches" id="penColorSwatches"></div>
            <button type="button" class="pen-undo-btn" id="penUndoBtn">↩️ 되돌리기</button>
          </div>
          <div class="pen-canvas-wrap" id="penCanvasWrap" style="height:280px;">
            <canvas class="pen-canvas" id="penCanvas"></canvas>
            <div class="pen-resize-handle" id="penResizeHandle" title="드래그해서 필기장 높이 조절"></div>
          </div>
          </div>

          <div class="practice-panel" id="practicePanelKbd">
            <div class="pen-pad-head">
              <span class="pen-pad-title">⌨️ 키보드 연습장</span>
              <div class="pen-pad-actions">
                <button type="button" class="pen-pad-clear" id="kbdPadClearBtn">지우기</button>
              </div>
            </div>
            <textarea class="kbd-pad-textarea" id="kbdPadTextarea" placeholder="타이핑으로 답을 정리해보세요"></textarea>
          </div>

          <div class="practice-panel" id="practicePanelVoice" style="display:none;">
            <div class="pen-pad-head">
              <span class="pen-pad-title">🎙️ 음성 연습장</span>
              <div class="pen-pad-actions">
                <button type="button" class="pen-pad-clear" id="voicePadClearBtn">지우기</button>
              </div>
            </div>
            <div class="voice-pad-controls">
              <button type="button" class="btn ghost" id="voicePadAskBtn">🔊 문제 듣기</button>
              <button type="button" class="btn" id="voicePadRecBtn">🎙️ 녹음 시작</button>
            </div>
            <div class="voice-pad-status" id="voicePadStatus"></div>
            <textarea class="kbd-pad-textarea" id="voicePadTextarea" placeholder="🎙️ 녹음 시작을 누르고 답을 말해보세요"></textarea>
          </div>
        </div>
        ${isVoice ? `
      <div class="voice-controls" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);">
        <label style="font-size:0.8rem;color:var(--muted);display:block;margin-bottom:4px;">
          답변 인식 대기시간 / 답변 후 정답까지 대기시간: <b id="voiceDelayVal">${state.voiceDelay}</b>초
        </label>
        <input type="range" id="voiceDelayRange" min="1" max="10" step="1" value="${state.voiceDelay}" style="width:100%;">
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn ghost" id="voicePauseBtn">⏸ 일시정지</button>
          <button class="btn danger" id="voiceCancelBtn" disabled>✕ 취소(수동 전환)</button>
        </div>
      </div>` : ""}
        <div class="swipe-hint">← 오른쪽으로 밀면 이전 · 왼쪽으로 밀면 다음 → · 문제 영역을 탭하면 정답 확인</div>
      </div>
    </div>
  `;
  const navPrevBtn = document.getElementById("studyNavPrev");
  const navNextBtn = document.getElementById("studyNavNext");
  const navRevealBtn = document.getElementById("studyNavReveal");
  const navWrongBtn = document.getElementById("studyNavWrong");
  const navCorrectBtn = document.getElementById("studyNavCorrect");
  navWrongBtn.disabled = true;
  navCorrectBtn.disabled = true;
  navPrevBtn.onclick = ()=> goToCard(state.idx-1);
  navNextBtn.onclick = ()=> goToCard(state.idx+1);
  navRevealBtn.onclick = ()=> toggleAnswerVisibility(q);
  navWrongBtn.onclick = ()=> selfGrade(q, false);
  navCorrectBtn.onclick = ()=> selfGrade(q, true);
  document.getElementById("idxSelect").addEventListener("change", (e)=> goToCard(Number(e.target.value)));
  const modeTagBtnEl = document.getElementById("modeTagBtn");
  if(modeTagBtnEl) modeTagBtnEl.addEventListener("click", openStudyModeSwitchModal);
  document.getElementById("editBtn").addEventListener("click", ()=> openEditModal(q.id, ()=> renderCard()));
  document.getElementById("aiHelpBtn").addEventListener("click", ()=> openAiHelpModal(q));
  document.getElementById("shareBtn").addEventListener("click", ()=> openShareOptionsModal(q));
  const commentBtnEl = document.getElementById("commentBtn");
  if(commentBtnEl){
    commentBtnEl.addEventListener("click", ()=> openCommentModal(q.id));
    updateCommentCountBadge(q.id);
  }
  const starDupTagBtnEl = document.getElementById("starDupTagBtn");
  if(starDupTagBtnEl) starDupTagBtnEl.addEventListener("click", ()=> openDuplicateModal(q.id));
  const voiceModeBtnEl = document.getElementById("voiceModeBtn");
  voiceModeBtnEl.classList.toggle("active", isVoice);
  voiceModeBtnEl.textContent = isVoice ? "🔊" : "🔈";
  voiceModeBtnEl.title = isVoice ? "음성모드 켜짐 (탭하여 끄기)" : "음성모드로 전환";
  voiceModeBtnEl.addEventListener("click", toggleVoiceMode);
  const starBtnEl = document.getElementById("starBtn");
  const refreshStarBtn = ()=>{
    const on = !!store.bookmarks[q.id];
    starBtnEl.classList.toggle("active", on);
    starBtnEl.textContent = on ? "★" : "☆";
    starBtnEl.title = on ? "즐겨찾기됨 (탭하여 해제)" : "즐겨찾기";
  };
  refreshStarBtn();
  starBtnEl.addEventListener("click", ()=>{ toggleBookmark(q.id); refreshStarBtn(); });
  setupPracticeTabs(q);
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
  attachCardGestures("cardBox",
    (e)=>{
      const t = e.target;
      // 정답 영역(#answerSlot) 안이라도 이미지는 확대되어야 한다.
      // (아래에서 #answerSlot 자체는 '정답 다시 가리기' 같은 다른 동작과 안 겹치게 탭을 무시하지만,
      //  이미지 확대만큼은 정답 안이든 밖이든 항상 동작해야 하므로 그 검사보다 먼저 처리한다)
      if(t.tagName === "IMG"){ openImageZoom(t.src); return; }
      if(t.closest && t.closest("button,textarea,input,.mini-btn,#answerSlot,.pen-pad")) return;
      toggleAnswerVisibility(q);
    },
    ()=>{ if(state.idx < state.queue.length-1) goToCard(state.idx+1); else { maybeCountPassiveView(); recordQueueCompletion(); saveQueueSession(); snapBack(document.getElementById("cardBox")); alert("이번 세트 학습을 완료했습니다!"); setView(state.returnView || (state.mode==="unitMinor" ? "unit" : (["unit","year","freq"].includes(state.mode) ? state.mode : "home"))); } },
    ()=>{ if(state.idx > 0) goToCard(state.idx-1); else snapBack(document.getElementById("cardBox")); }
  );
  playCardEnterAnimation("cardBox");
  voiceSessionToken++;
    stopVoiceStudyRecognizer();
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
  updateRevealBtnLabel(); // 버튼 라벨이 state.answerVisible과 항상 일치하도록 렌더링 끝에서 한번 더 맞춘다
}

/* ---- 음성학습모드: 문제 읽기 → (음성연습장으로) 5초 이내 답변 감지 → 답변 읽기 → 2초 후 자동 다음 문제
   (일시정지/이어서/취소 지원) ---- */
let voiceSessionToken = 0;
let voicePaused = false;
let voicePhase = null; // 'question' | 'listening' | 'answer' | 'gap'
let gapTimer = null;
let gapRemaining = 0;
let gapStart = 0;
let gapOnDone = null;
let voiceStudyRecognizer = null;
function stopVoiceStudyRecognizer(){
  if(voiceStudyRecognizer){ try{ voiceStudyRecognizer.abort(); }catch(e){} voiceStudyRecognizer = null; }
  voiceStudyAutoListening = false;
  // 음성학습 세션이 어디서 끊기든(문제 전환/일시정지 등) 마이크 버튼이 "녹음 중" 상태로
  // 멈춰있지 않도록 항상 같이 되돌린다.
  const recBtn = document.getElementById("voicePadRecBtn");
  if(recBtn && recBtn.classList.contains("recording")){
    recBtn.classList.remove("recording");
    recBtn.textContent = "🎙️ 녹음 시작";
  }
}
function voiceStudyListenMs(){ return Math.max(state.voiceDelay*1000, 5000); } // 답변 없을 때 대기 시간(사용자가 슬라이더로 조절, 단 마이크 준비시간을 감안해 최소 5초는 확보)
function voiceStudyPostAnswerGapMs(){ return state.voiceDelay*1000; } // 답변 후 정답을 읽어주기 전 대기 시간(동일 슬라이더 값 사용)
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
  let done = false;
  const finish = ()=>{
    if(done) return;
    done = true;
    clearInterval(resumeHeartbeat);
    clearTimeout(safetyTimer);
    if(myToken===speakToken && callback) callback();
  };
  utter.onend = finish;
  utter.onerror = finish;
  // 크롬 계열 브라우저는 발화가 약 15초를 넘으면 자체 버그로 조용히 멈추면서
  // onend/onerror를 영영 안 쏘는 경우가 있다. 주기적으로 resume()을 불러서 이를 막는다.
  const resumeHeartbeat = setInterval(()=>{
    if(myToken!==speakToken){ clearInterval(resumeHeartbeat); return; }
    if(speechSynthesis.speaking) speechSynthesis.resume();
  }, 4000);
  // 그래도 콜백이 영영 안 오는 예외 상황을 대비한 최종 안전장치.
  // (글자수 기반으로 넉넉하게 추정 + 최소 6초)
  const estimatedMs = Math.max(6000, clean.length * 220);
  const safetyTimer = setTimeout(finish, estimatedMs);
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
    listenForVoiceAnswer(q, session);
  });
}
/* ---- 음성으로 문제를 낸 뒤, 음성연습장(STT)으로 답변을 받는다.
   5초 안에 말을 시작하면: 말이 끝난 뒤 5초 더 기다렸다가 정답을 읽어준다.
   5초 안에 아무 말도 없으면: 그대로 정답을 읽어주고 다음 문제로 넘어간다. ---- */
function listenForVoiceAnswer(q, session){
  voicePhase = "listening";
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusEl = document.getElementById("voicePadStatus");
  const recBtn = document.getElementById("voicePadRecBtn");
  const setRecBtnRecording = (on)=>{
    if(!recBtn) return;
    recBtn.classList.toggle("recording", on);
    recBtn.textContent = on ? "⏹ 녹음 중" : "🎙️ 녹음 시작";
  };
  if(!SR){
    // 이 브라우저는 음성인식 미지원 → 예전 방식(고정 대기시간)으로 대체
    if(statusEl) statusEl.textContent = "이 브라우저는 음성인식을 지원하지 않아 고정 대기시간으로 진행해요.";
    startGap(voiceStudyListenMs(), ()=>{ if(session===voiceSessionToken) revealAndSpeakVoiceAnswer(q, session); });
    return;
  }
  if(statusEl) statusEl.textContent = `🎙️ 답변을 들을게요 (${voiceStudyListenMs()/1000}초 이내)…`;
  setRecBtnRecording(true);
  voiceStudyAutoListening = true; // 수동 녹음 버튼과 동시에 두 개의 인식기가 뜨는 것을 막기 위한 표시
  let gotSpeech = false;
  let answered = false; // revealAndSpeakVoiceAnswer 중복 호출 방지
  let restartCount = 0; // 재시작마다 안드로이드 알림음("삑삑")이 들리므로, 반복될수록 텀을 늘려서 빈도를 줄인다.
  const nextRestartDelay = ()=> Math.min(800 + restartCount*600, 2600);
  const ta = document.getElementById("voicePadTextarea");
  const baseText = ta ? (ta.value || "") : "";
  let finalSegments = []; // 인식 세션이 끝날 때마다 "그 세션이 확정한 문장"을 하나씩 통째로 담는다
  const renderText = (sessionFinal, sessionInterim)=>{
    // ta.value를 읽어서 그 위에 또 쌓지 않고, 매번 처음부터 다시 조립한다.
    // (예전 방식은 세션이 끊겼다 이어질 때 같은 말이 중복으로 쌓이는 문제가 있었음)
    if(!ta) return;
    const parts = [baseText.trim(), ...finalSegments, sessionFinal].filter(Boolean);
    let text = parts.join(" ");
    if(sessionInterim) text += (text?" ":"") + sessionInterim;
    ta.value = text;
    if(!state.voiceMemos) state.voiceMemos = {};
    state.voiceMemos[q.id] = text;
  };

  const proceedToAnswer = ()=>{
    if(answered) return;
    if(voicePaused) return; // 일시정지 중이면 재개 로직에서 별도 처리
    answered = true;
    stopVoiceStudyRecognizer();
    setRecBtnRecording(false);
    voiceStudyAutoListening = false;
    if(noSpeechTimer){ clearTimeout(noSpeechTimer); noSpeechTimer = null; }
    if(silenceTimer){ clearTimeout(silenceTimer); silenceTimer = null; }
    if(safetyTimer){ clearTimeout(safetyTimer); safetyTimer = null; }
    if(session !== voiceSessionToken) return;
    if(gotSpeech){
      if(statusEl) statusEl.textContent = "답변을 들었어요. 잠시 후 정답을 읽어드릴게요.";
      startGap(voiceStudyPostAnswerGapMs(), ()=>{ if(session===voiceSessionToken) revealAndSpeakVoiceAnswer(q, session); });
    } else {
      if(statusEl) statusEl.textContent = "답변이 없었어요. 정답을 읽어드릴게요.";
      revealAndSpeakVoiceAnswer(q, session);
    }
  };

  let noSpeechTimer = null;   // 아직 한마디도 안 한 상태에서 "이 시간까지 말 안 하면 넘어간다"
  let silenceTimer = null;    // 말을 시작한 뒤 "이만큼 조용하면 말이 끝난 것으로 보고 넘어간다"
  let safetyTimer = null;
  let nextDeadline = 0; // 다음으로 proceedToAnswer가 예정된 시각(ms) — 재시작 필요 여부 판단용
  const armTimers = ()=>{
    // 마이크가 실제로 켜진 순간(recognizer.onstart)부터 타이머를 시작한다.
    // 그 전(마이크 권한 확인·초기화하는 짧은 시간)까지 대기시간에 포함시키면
    // 실제로 말할 수 있는 시간이 그만큼 줄어들어 답변을 자꾸 놓치게 된다.
    if(noSpeechTimer) clearTimeout(noSpeechTimer);
    const ms = voiceStudyListenMs();
    nextDeadline = Date.now() + ms;
    noSpeechTimer = setTimeout(()=>{
      noSpeechTimer = null;
      if(!gotSpeech) proceedToAnswer(); // 아직 한마디도 안 했으면 여기서 바로 정답으로 진행
    }, ms);
    // 만에 하나 음성인식 이벤트가 하나도 안 들어오는 등 예외적인 상황에서도 흐름이 멈추지 않도록
    // 최대 대기시간(듣기 + 답변후 대기 + 여유 30초)이 지나면 무조건 정답 단계로 진행시키는 안전장치.
    // (말을 길게 이어가는 경우까지 감안해 여유를 넉넉히 둠)
    if(safetyTimer) clearTimeout(safetyTimer);
    safetyTimer = setTimeout(()=>{
      proceedToAnswer();
    }, ms + voiceStudyPostAnswerGapMs() + 30000);
  };
  // 말이 감지된 뒤, "이만큼 조용하면 말이 끝난 것"으로 보고 다음 단계로 넘어간다.
  // 말하는 도중 잠깐 쉬어도(문장 사이 숨 고르기 등) 여기서 다시 타이머를 새로 걸기 때문에
  // 말이 끝나기 전에 잘려서 넘어가는 일이 없다.
  const armSilenceTimer = ()=>{
    if(silenceTimer) clearTimeout(silenceTimer);
    const ms = voiceStudyPostAnswerGapMs();
    nextDeadline = Date.now() + ms;
    silenceTimer = setTimeout(()=>{
      silenceTimer = null;
      proceedToAnswer();
    }, ms);
  };
  // 혹시 onstart가 지원되지 않는 브라우저를 대비해, 즉시 한 번 타이머를 걸어둔다.
  // (onstart가 정상적으로 뜨는 브라우저에서는 armTimers()가 다시 호출되며 시간을 리셋함)
  armTimers();

  const startSession = ()=>{
    const recognizer = new SR();
    voiceStudyRecognizer = recognizer;
    recognizer.lang = "ko-KR";
    recognizer.interimResults = true;
    recognizer.continuous = true;
    let sessionFinal = "", sessionInterim = "";
    recognizer.onstart = ()=>{
      if(session !== voiceSessionToken) return;
      if(!gotSpeech) armTimers(); // 마이크가 진짜로 열린 시점부터 "무응답" 대기시간을 다시 센다
      if(statusEl && !gotSpeech) statusEl.textContent = `🎙️ 답변을 들을게요 (${voiceStudyListenMs()/1000}초 이내)…`;
    };
    recognizer.onresult = (e)=>{
      if(session !== voiceSessionToken) return;
      if(noSpeechTimer){ clearTimeout(noSpeechTimer); noSpeechTimer = null; }
      gotSpeech = true;
      armSilenceTimer(); // 말이 들어올 때마다(중간중간 쉬어도) 침묵 타이머를 계속 새로 건다
      let finalPieces = [], i = "";
      for(let idx=0; idx<e.results.length; idx++){
        const r = e.results[idx];
        if(r.isFinal) finalPieces.push(r[0].transcript);
        else i += r[0].transcript;
      }
      sessionFinal = mergeGrowingPieces(finalPieces);
      sessionInterim = i;
      renderText(sessionFinal, sessionInterim);
      if(statusEl) statusEl.textContent = "듣고 있어요…";
    };
    let lastErrorInfo = null;
    recognizer.onerror = (e)=>{
      lastErrorInfo = voiceErrorInfo(e && e.error);
      if(lastErrorInfo.fatal && statusEl) statusEl.textContent = lastErrorInfo.msg;
    };
    recognizer.onend = ()=>{
      if(voiceStudyRecognizer !== recognizer) return; // 이미 새 세션이 시작된 경우 무시
      voiceStudyRecognizer = null;
      if(answered) return;
      if(voicePaused) return; // 일시정지 중이면 재개 시 처리
      // 이 세션이 확정한 문장을 통째로 배열에 담아둔다(끊어 말해도 앞 내용이 사라지지 않도록).
      if(sessionFinal) pushVoiceSegment(finalSegments, sessionFinal);
      // 권한 거부·마이크 없음·네트워크 문제처럼 다시 시도해도 똑같이 실패할 오류라면,
      // 무한히 재시도하지 않고 바로 정답 단계로 넘어간다(사용자에게는 이미 원인 메시지를 보여준 상태).
      if(lastErrorInfo && lastErrorInfo.fatal){
        proceedToAnswer();
        return;
      }
      // 브라우저가 문장 사이 짧은 쉼에도 이 세션을 스스로 끊는 경우가 많다.
      // 말을 이미 시작했든 안 했든, 여기서 곧바로 "끝났다"고 단정 짓지 않고
      // 항상 새 인식 세션을 이어서 시작해 계속 듣는다. 실제로 넘어갈지 말지는
      // armTimers()/armSilenceTimer()가 관리하는 타이머들이 결정한다.
      // 다만 재시작마다 안드로이드 시작/종료 알림음("삑삑")이 들리므로:
      // ① 대기시간이 곧(1.2초 이내) 끝날 예정이면 굳이 재시작하지 않고 그냥 그 타이머가 끝나게 둔다.
      // ② 재시작이 반복될수록 텀을 점점 늘려서(백오프) 알림음 빈도 자체를 줄인다.
      restartCount++;
      const remain = nextDeadline - Date.now();
      if(remain < 1200){
        // 곧 어차피 다음 단계로 넘어갈 시점이라, 재시작하지 않고 기존 타이머에 맡긴다.
        return;
      }
      setTimeout(()=>{
        if(session !== voiceSessionToken || answered || voicePaused) return;
        try{ startSession(); }catch(e){ proceedToAnswer(); }
      }, nextRestartDelay());
    };
    try{ recognizer.start(); }catch(e){
      proceedToAnswer();
    }
  };
  startSession();
}
function revealAndSpeakVoiceAnswer(q, session){
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
    maybeCountPassiveView();
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
  } else if(voicePhase === "listening"){
    if(voiceStudyRecognizer){ try{ voiceStudyRecognizer.abort(); }catch(e){} voiceStudyRecognizer = null; }
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
  } else if(voicePhase === "listening"){
    // 듣기 단계는 이어서 재개하기 까다로워, 다시 듣기부터 시작한다.
    const q = state.queue[state.idx];
    if(q) listenForVoiceAnswer(q, voiceSessionToken);
  } else if(voicePhase === "gap"){
    gapStart = Date.now();
    gapTimer = setTimeout(()=>{ gapTimer = null; if(gapOnDone) gapOnDone(); }, gapRemaining);
  }
  acquireWakeLock();
  updateVoiceControlsUI();
}
/* ---- 카드 우측 상단 스피커 버튼: 지금 보고 있는 문제에서 바로 음성모드 켜기/끄기 ---- */
/* ---- 카드 상단 모드 배지 탭: 시험모드/연습모드/음성모드를 즉석에서 전환 ---- */
function switchStudyMode(newMode){
  if(state.studyMode === newMode) return;
  if(state.studyMode === "voice"){
    voiceSessionToken++;
    stopVoiceStudyRecognizer();
    speakToken++;
    if("speechSynthesis" in window) speechSynthesis.cancel();
    if(gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    voicePaused = false;
    voicePhase = null;
    releaseWakeLockNow();
  }
  state.studyMode = newMode;
  renderCard();
}
/* ---- 문제/답 텍스트를 순수 텍스트로 변환 (AI 해설, 공유용) ---- */
function plainTextOf(text){
  if(!text) return "";
  return text
    .replace(/\{\{BOX\}\}|\{\{\/BOX\}\}/g, "")
    .replace(/\{\{img:\d+\}\}/g, "[이미지]")
    .trim();
}
function buildAiPrompt(q){
  const qText = plainTextOf(q.question);
  const aText = plainTextOf(q.answer);
  return `다음은 건축기사 실기(필답형) 시험 문제입니다. 왜 이 답이 맞는지, 관련 개념과 함께 초보자도 이해하기 쉽게 자세히 해설해줘.\n\n[문제]\n${qText}\n\n[모범답안]\n${aText}`;
}
/* ---- AI 해설 링크 모달 (ChatGPT / Google AI) ---- */
function openAiHelpModal(q){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  const prompt = buildAiPrompt(q);
  const googleAiUrl = "https://www.google.com/search?udm=50&q=" + encodeURIComponent(prompt);
  const svcLabel = {chatgpt:"새 대화창을", claude:"새 대화창을", perplexity:"새 검색을"};
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>🤖 AI 해설로 물어보기</h3>
      <div class="mode-choice-row">
        ${AI_ASK_SERVICES.map(s=>`<button type="button" class="btn ghost ai-svc-btn" data-ai-svc-modal="${s.key}"><span class="ai-svc-head">${s.icon}<span>${s.label}에게 해설 요청</span></span><small>문제와 모범답안을 담아 ${svcLabel[s.key]||"새 대화창을"} 엽니다</small></button>`).join("")}
        <a class="btn ghost" href="${googleAiUrl}" target="_blank" rel="noopener" style="text-decoration:none;display:block;">🔎 Google AI 해설 보기<small>Google AI 모드 검색결과로 엽니다</small></a>
      </div>
      <div style="margin-top:10px;font-size:0.78rem;color:var(--muted);">※ 로그인 상태나 브라우저에 따라 프롬프트가 자동으로 채워지지 않을 수 있어요. 그 경우 붙여넣기 해주세요.</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".close-x").addEventListener("click", ()=> overlay.remove());
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay) overlay.remove(); });
  overlay.querySelectorAll("[data-ai-svc-modal]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ askAiAboutQuestion(btn.dataset.aiSvcModal, q); overlay.remove(); });
  });
}

/* ---- 오답의견: 문제별 공개 댓글(허브에서만 동작, standalone에는 없음) ---- */
function escapeCommentHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
/* 💬 아이콘 위에 오답의견 개수를 작은 숫자 뱃지로 표시(0개면 뱃지 자체를 숨김). */
async function updateCommentCountBadge(questionId){
  if(typeof supabaseClient === "undefined" || !supabaseClient) return;
  const badge = document.getElementById("commentCountBadge");
  if(!badge) return;
  try{
    const { count, error } = await supabaseClient
      .from("question_comments")
      .select("id", { count: "exact", head: true })
      .eq("cert_id", typeof CERT_ID !== "undefined" ? CERT_ID : "")
      .eq("question_id", questionId);
    if(error) throw error;
    const badgeNowEl = document.getElementById("commentCountBadge"); // 비동기 대기 중 카드가 넘어갔을 수 있어 재확인
    if(!badgeNowEl) return;
    if(count > 0){
      badgeNowEl.textContent = count > 99 ? "99+" : String(count);
      badgeNowEl.style.display = "flex";
    } else {
      badgeNowEl.style.display = "none";
    }
  }catch(e){
    console.warn("오답의견 개수 조회 실패:", e.message);
  }
}
async function openCommentModal(questionId){
  if(typeof supabaseClient === "undefined" || !supabaseClient) return;
  document.querySelectorAll(".comment-modal-overlay").forEach(o=>o.remove());
  const overlay = document.createElement("div");
  overlay.className = "comment-modal-overlay";
  overlay.innerHTML = `
    <div class="comment-modal-card">
      <div class="comment-modal-header">
        <h3>💬 오답의견</h3>
        <button type="button" class="comment-modal-close" id="commentCloseBtn">✕</button>
      </div>
      <p class="comment-modal-desc">이 문제를 보는 모든 사용자에게 공개돼요. 오탈자·이견·추가 설명 등을 남겨보세요.</p>
      <div class="comment-list" id="commentList"><p class="comment-loading">불러오는 중…</p></div>
      <div class="comment-compose">
        <textarea id="commentInput" placeholder="의견을 입력하세요" maxlength="1000"></textarea>
        <button type="button" id="commentSubmitBtn">등록</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
  document.getElementById("commentCloseBtn").addEventListener("click", close);

  async function loadComments(){
    const listEl = document.getElementById("commentList");
    if(!listEl) return;
    listEl.innerHTML = '<p class="comment-loading">불러오는 중…</p>';
    try{
      const { data: { session } } = await supabaseClient.auth.getSession();
      const myId = session ? session.user.id : null;
      const { data: comments, error } = await supabaseClient
        .from("question_comments")
        .select("id,user_id,content,created_at")
        .eq("cert_id", typeof CERT_ID !== "undefined" ? CERT_ID : "")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true });
      if(error) throw error;
      const userIds = [...new Set((comments || []).map(c => c.user_id))];
      let nickMap = {};
      if(userIds.length){
        const { data: profiles } = await supabaseClient.from("profiles").select("user_id,nickname").in("user_id", userIds);
        (profiles || []).forEach(p => { nickMap[p.user_id] = p.nickname; });
      }
      if(!comments || !comments.length){
        listEl.innerHTML = '<p class="comment-empty">아직 의견이 없어요. 첫 의견을 남겨보세요.</p>';
        return;
      }
      listEl.innerHTML = comments.map(c => {
        const nick = nickMap[c.user_id] || "익명";
        const mine = myId && c.user_id === myId;
        const d = new Date(c.created_at);
        const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
        return `<div class="comment-item">
          <div class="comment-meta"><b>${escapeCommentHtml(nick)}</b><span>${dateStr}</span>${mine ? `<button type="button" class="comment-delete-btn" data-id="${c.id}">삭제</button>` : ""}</div>
          <div class="comment-body">${escapeCommentHtml(c.content)}</div>
        </div>`;
      }).join("");
      listEl.querySelectorAll(".comment-delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if(!confirm("이 의견을 삭제할까요?")) return;
          await supabaseClient.from("question_comments").delete().eq("id", btn.dataset.id);
          loadComments();
          updateCommentCountBadge(questionId);
        });
      });
    }catch(e){
      listEl.innerHTML = `<p class="comment-empty">불러오기 실패: ${escapeCommentHtml(e.message)}</p>`;
    }
  }

  document.getElementById("commentSubmitBtn").addEventListener("click", async () => {
    const input = document.getElementById("commentInput");
    const content = input.value.trim();
    if(!content) return;
    const btn = document.getElementById("commentSubmitBtn");
    btn.disabled = true;
    try{
      const { data: { session } } = await supabaseClient.auth.getSession();
      if(!session){ alert("로그인이 필요해요."); return; }
      const { error } = await supabaseClient.from("question_comments").insert({
        cert_id: typeof CERT_ID !== "undefined" ? CERT_ID : "",
        question_id: questionId,
        user_id: session.user.id,
        content,
      });
      if(error) throw error;
      input.value = "";
      loadComments();
      updateCommentCountBadge(questionId);
    }catch(e){
      alert("등록 실패: " + e.message);
    }finally{
      btn.disabled = false;
    }
  });

  loadComments();
}

/* ---- 문제 공유하기: 형식(이미지/텍스트) · 내용(문제만/정답포함) 선택 모달 ---- */
function openShareOptionsModal(q){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>📤 문제 공유하기</h3>
      <div class="optA-row" style="margin-top:14px;">
        <span class="optA-label">형식</span>
        <div class="optA-chips">
          <label class="toggle-chip-wrap"><input type="radio" name="shareFmtModal" value="image" checked><span>🖼️ 이미지</span></label>
          <label class="toggle-chip-wrap"><input type="radio" name="shareFmtModal" value="text"><span>📄 텍스트</span></label>
        </div>
      </div>
      <div class="optA-row">
        <span class="optA-label">내용</span>
        <div class="optA-chips">
          <label class="toggle-chip-wrap"><input type="radio" name="shareContentModal" value="plain" checked><span>문제만</span></label>
          <label class="toggle-chip-wrap"><input type="radio" name="shareContentModal" value="full"><span>정답포함</span></label>
        </div>
      </div>
      <button type="button" class="primary-share-btn" id="shareModalGoBtn">📤 공유하기</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector(".close-x").addEventListener("click", ()=> overlay.remove());
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay) overlay.remove(); });
  overlay.querySelector("#shareModalGoBtn").addEventListener("click", ()=>{
    const fmt = overlay.querySelector('input[name="shareFmtModal"]:checked').value;
    const withAnswer = overlay.querySelector('input[name="shareContentModal"]:checked').value === "full";
    overlay.remove();
    if(fmt === "text") shareQuestionText(q, withAnswer);
    else shareQuestionImage(q, withAnswer);
  });
}
function openStudyModeSwitchModal(){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>학습 방식을 선택하세요</h3>
      <div class="mode-choice-row">
        <button class="btn ${state.studyMode==='practice'?'primary':'ghost'}" id="modeSwitchPractice">📖 연습모드<small>문제와 정답을 처음부터 함께 보며 학습해요</small></button>
        <button class="btn ${state.studyMode==='exam'?'primary':'ghost'}" id="modeSwitchExam">📝 시험모드<small>정답을 가리고 먼저 풀어본 뒤 확인해요</small></button>
        <button class="btn ${state.studyMode==='voice'?'primary':'ghost'}" id="modeSwitchVoice">🔊 음성학습모드<small>문제→정답을 읽어주고 자동으로 다음 문제로 넘어가요</small></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.querySelector("#modeSwitchPractice").addEventListener("click", ()=>{ close(); switchStudyMode("practice"); });
  overlay.querySelector("#modeSwitchExam").addEventListener("click", ()=>{ close(); switchStudyMode("exam"); });
  overlay.querySelector("#modeSwitchVoice").addEventListener("click", ()=>{ close(); switchStudyMode("voice"); });
}
function toggleVoiceMode(){
  if(state.studyMode === "voice"){
    voiceSessionToken++;
    stopVoiceStudyRecognizer();
    speakToken++;
    if("speechSynthesis" in window) speechSynthesis.cancel();
    if(gapTimer){ clearTimeout(gapTimer); gapTimer = null; }
    voicePaused = false;
    voicePhase = null;
    releaseWakeLockNow();
    state.studyMode = "practice";
  } else {
    state.studyMode = "voice";
  }
  renderCard();
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
  // 앞으로 넘어갈 때(다음 카드로 이동/세트 완료)만 현재 카드를 "학습함"으로 카운트한다.
  // 뒤로 가기(이전 카드 보기)는 아직 학습이 끝난 것으로 보지 않으므로 카운트하지 않는다.
  if(newIdx > state.idx) maybeCountPassiveView();
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
  return {unit:"단원별 연습", unitMinor:"소단원별 연습", year:"연도별 기출", wrong:"오답노트", bookmark:"즐겨찾기", srs:"회독 학습", freq:"빈도순 연습"}[mode] || "학습";
}

function datasetHasMultiRound(data){
  const map = {};
  data.forEach(d=>{ (map[d.year] ||= new Set()).add(d.round||1); });
  return Object.values(map).some(s=>s.size>1);
}
/* ---- 필답형/작업형처럼 한 자격증 안에 시험 종류(examPart)가 섞여 있는지 확인.
   섞여 있으면 연도별·모의고사 화면에서 서로 절대 섞이지 않도록 별도로 나눠서 다룬다. ---- */
function datasetExamParts(data){
  const set = new Set();
  data.forEach(d=>{ if(d.examPart) set.add(d.examPart); });
  return [...set];
}
function datasetHasMultiExamPart(data){
  return datasetExamParts(data).length > 1;
}
function yearRoundLabel(q, multiRound){
  const yy = String(q.year).slice(-2);
  const base = multiRound ? `${yy}-${q.round||1}` : yy;
  return q.examPart ? `${base}·${q.examPart[0]}` : base; // 필답형→필, 작업형→작
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

/* ============ AI에게 물어보기 / 문제 공유하기 (방수산업기사 CBT 앱 기능 이식) ============ */
/* 정답 공개 후에만 노출: revealAnswer()에서 answerSlot 하단에 렌더링된다 */
const AI_ASK_SERVICES = [
  {key:"chatgpt", label:"ChatGPT",
    icon:'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0f0f0f"/><g fill="#fff"><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(0 12 12)"/><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(60 12 12)"/><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(120 12 12)"/><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(180 12 12)"/><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(240 12 12)"/><rect x="10.5" y="3" width="3" height="7" rx="1.5" transform="rotate(300 12 12)"/></g></svg>',
    url:p=>"https://chatgpt.com/?q="+encodeURIComponent(p)},
  {key:"claude", label:"Claude",
    icon:'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#D97757"/><g fill="#fff"><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(0 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(45 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(90 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(135 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(180 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(225 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(270 12 12)"/><rect x="11" y="3" width="2" height="7" rx="1" transform="rotate(315 12 12)"/></g></svg>',
    url:p=>"https://claude.ai/new?q="+encodeURIComponent(p)},
  {key:"perplexity", label:"Perplexity",
    icon:'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#20808D"/><g fill="#fff"><path d="M12 4 L15 11 L12 12 L9 11 Z" transform="rotate(0 12 12)"/><path d="M12 4 L15 11 L12 12 L9 11 Z" transform="rotate(90 12 12)"/><path d="M12 4 L15 11 L12 12 L9 11 Z" transform="rotate(180 12 12)"/><path d="M12 4 L15 11 L12 12 L9 11 Z" transform="rotate(270 12 12)"/></g></svg>',
    url:p=>"https://www.perplexity.ai/search?q="+encodeURIComponent(p)},
];

/* ---- 클립보드 복사 (Clipboard API 실패 시 구식 execCommand 폴백) ---- */
async function copyTextRobust(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    try{ await navigator.clipboard.writeText(text); return true; }catch(e){ /* 아래 폴백으로 계속 */ }
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }catch(e){ return false; }
}

/* ---- AI에게 이 문제 물어보기: 서비스 선택 시 프롬프트를 클립보드에 복사하고 새 탭으로 연다 ---- */
function askAiAboutQuestion(serviceKey, q){
  const svc = AI_ASK_SERVICES.find(s=>s.key===serviceKey);
  if(!svc) return;
  const prompt = buildAiPrompt(q);
  copyTextRobust(prompt);
  toast("질문 내용을 복사했어요 · 붙여넣기(Ctrl/⌘+V)로 확인하세요");
  window.open(svc.url(prompt), "_blank", "noopener");
}

/* ---- 문제 공유용 텍스트 생성 (정답 포함/미포함 선택 가능) ---- */
async function buildShareText(q, withAnswer){
  const multiRound = datasetHasMultiRound(getData());
  const label = yearRoundLabel(q, multiRound) + (q.no?`-${q.no}`:"");
  const lines = [];
  const cfg = (typeof EXAM_CONFIG !== "undefined") ? EXAM_CONFIG : { markText: "", subtitle: "" };
  const appTitle = "My도전 Note";
  const certLine = `${cfg.markText} ${shortSubOf(cfg)}`.trim();
  lines.push(`${appTitle} · ${certLine} · ${label}${q.unitMajor?" · "+q.unitMajor:""}${q.unitMinor?" · "+q.unitMinor:""}`);
  lines.push("");
  lines.push("[문제]");
  lines.push(plainTextOf(q.question));
  if(withAnswer){
    lines.push("");
    lines.push("[모범답안]");
    lines.push(plainTextOf(q.answer));
  }
  const hasImgInQuestion = /\{\{img:\d+\}\}/.test(q.question||"");
  const hasImgInAnswer = withAnswer && /\{\{img:\d+\}\}/.test(q.answer||"");
  if(hasImgInQuestion || hasImgInAnswer){
    lines.push("");
    lines.push("※ 이 문제에는 도면·그림이 포함되어 있어 텍스트만으로는 풀 수 없어요. 공유 형식을 '이미지'로 선택해주세요.");
  }
  if(typeof shareShortenUrl === "function"){
    const shareUrl = await shareShortenUrl(buildShareDeepLink(q.id));
    lines.push("");
    lines.push(`🔗 이 문제 바로 보기: ${shareUrl}`);
  }
  return lines.join("\n");
}

/* ---- 공유 이미지 카드: 앱 팔레트를 그대로 살려 캔버스로 그린다 ---- */
const SHARE_COLORS = {
  ink:"#1c2430", deep:"#243c3d", teal:"#2f6b57", tealSoft:"#e3ede8",
  amber:"#c5934c", amberSoft:"#faeedd",
  paper:"#faf8f3", card:"#ffffff", line:"#eae6da", muted:"#7b7669"
};
function shareCanvasWrapText(ctx, text, maxWidth){
  const paras = String(text==null?"":text).split("\n");
  const lines = [];
  paras.forEach(para=>{
    if(para === ""){ lines.push(""); return; }
    let cur = "";
    for(const ch of para){
      const test = cur + ch;
      if(ctx.measureText(test).width > maxWidth && cur !== ""){
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    lines.push(cur);
  });
  return lines;
}
function shareRoundRect(ctx, x, y, w, h, r){
  if(typeof r === "number") r = {tl:r, tr:r, br:r, bl:r};
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  ctx.lineTo(x + r.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}
function shareLoadImage(src){
  return new Promise((resolve)=>{
    if(!src){ resolve(null); return; }
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = ()=> resolve(null);
    img.src = src;
  });
}
/* {{img:N}} 토큰 기준으로만 나눈다. usedIdx는 상위 호출에서 공유하는 Set(재귀·박스 안팎을 모두 합산). */
async function shareParseInline(text, images, usedIdx){
  const segments = [];
  const parts = String(text||"").split(/(\{\{img:\d+\}\})/g);
  for(const part of parts){
    const m = part.match(/^\{\{img:(\d+)\}\}$/);
    if(m){
      const idx = Number(m[1]);
      usedIdx.add(idx);
      const src = images && images[idx]!=null ? imgSrc(images[idx]) : null;
      if(src){
        const img = await shareLoadImage(src);
        if(img) segments.push({type:"img", img});
      }
    } else if(part){
      segments.push({type:"text", value: part});
    }
  }
  return segments;
}
/* {{BOX}}...{{/BOX}} 구간은 온스크린(.q-inline-box)과 같은 점선 박스로 표시할 수 있도록 중첩 구조로 보존하고,
   그 안팎의 {{img:N}} 자리에는 실제 이미지를 로드해 순서를 보존한 세그먼트 트리로 바꾼다.
   (문제 속 도면·그림이 "[이미지]" 문구로만 남거나 박스 강조가 사라져 공유받은 사람이 헷갈리는 걸 막기 위함) */
async function shareParseSegments(text, images){
  const usedIdx = new Set();
  const raw = String(text||"");
  const boxRe = /\{\{BOX\}\}([\s\S]*?)\{\{\/BOX\}\}/g;
  const segments = [];
  let lastIndex = 0, m;
  while((m = boxRe.exec(raw)) !== null){
    if(m.index > lastIndex){
      segments.push(...(await shareParseInline(raw.slice(lastIndex, m.index), images, usedIdx)));
    }
    // 박스 안쪽 텍스트에 앞뒤로 빈 줄이 섞여 있으면, 그 빈 줄도 한 줄로 계산되어
    // 박스 안에 불필요한 빈 공간이 생기고 테두리가 어긋나 보이는 문제가 있었음 → trim
    const items = await shareParseInline(m[1].trim(), images, usedIdx);
    if(items.length) segments.push({type:"box", items});
    lastIndex = boxRe.lastIndex;
  }
  if(lastIndex < raw.length){
    segments.push(...(await shareParseInline(raw.slice(lastIndex), images, usedIdx)));
  }
  return {segments, usedIdx};
}
function shareImgDrawSize(img, maxW, maxH){
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  let w = Math.min(natW, maxW);
  let h = w * (natH / natW);
  if(h > maxH){ h = maxH; w = h * (natW / natH); }
  return {w, h};
}
/* 세그먼트 트리를 실제 그릴 치수(줄바꿈/이미지 크기/박스 안쪽 여백)로 미리 계산한다.
   모든 항목은 h(자기 높이)와 gap(다음 항목과의 간격)을 갖도록 통일해서, 상위/재귀 어디서든
   같은 방식으로 누적 높이를 셀 수 있게 한다. */
function shareLayoutSegments(mctx, segments, contentW, textFont, lineH, maxImgH){
  const boxPad = 10;
  return segments.map(seg=>{
    if(seg.type === "text"){
      mctx.font = textFont;
      const lines = shareCanvasWrapText(mctx, seg.value, contentW);
      return {type:"text", lines, lineH, font:textFont, h: lines.length*lineH, gap:0};
    }
    if(seg.type === "img"){
      const {w,h} = shareImgDrawSize(seg.img, contentW, maxImgH);
      return {type:"img", img:seg.img, w, h, gap:14};
    }
    const innerW = contentW - boxPad*2;
    const items = shareLayoutSegments(mctx, seg.items, innerW, textFont, lineH, maxImgH);
    // 박스 배경의 "위쪽 시작점"은 테두리 기준이지만, fillText의 y는 글자 베이스라인이라
    // boxPad(10px)만으로는 글자 위쪽(어센더)이 가려질 공간이 부족해 테두리가 첫 줄 글자
    // 중간을 관통해 보이는 문제가 있었다. 첫 줄만큼은 줄 높이(lineH)를 통째로 여유로 두어
    // 베이스라인이 충분히 아래로 내려가도록 한다.
    const topInset = lineH;
    return {type:"box", items, innerW, h: shareSegmentsHeight(items) + topInset + boxPad, gap:14, pad:boxPad, topInset};
  });
}
function shareSegmentsHeight(items){
  let h = 0;
  items.forEach(it=> h += it.h + it.gap);
  if(items.length) h -= items[items.length-1].gap;
  return h;
}
/* 레이아웃된 세그먼트를 실제로 캔버스에 그린다. 박스 세그먼트는 점선 테두리+연한 배경으로
   앱 화면의 .q-inline-box(문제 속 {{BOX}} 강조)와 같은 느낌을 재현한다. */
function shareDrawSegments(ctx, items, x, yStart, contentW, C){
  let y = yStart;
  items.forEach(item=>{
    if(item.type === "text"){
      ctx.font = item.font;
      ctx.fillStyle = C.ink;
      item.lines.forEach(line=>{ ctx.fillText(line, x, y); y += item.lineH; });
    } else if(item.type === "img"){
      const dx = x + (contentW - item.w)/2;
      ctx.save();
      shareRoundRect(ctx, dx, y, item.w, item.h, 8);
      ctx.clip();
      ctx.drawImage(item.img, dx, y, item.w, item.h);
      ctx.restore();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      shareRoundRect(ctx, dx, y, item.w, item.h, 8);
      ctx.stroke();
      y += item.h + item.gap;
    } else if(item.type === "box"){
      ctx.fillStyle = C.amberSoft;
      shareRoundRect(ctx, x, y, contentW, item.h, 8);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([5,4]);
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.5;
      shareRoundRect(ctx, x, y, contentW, item.h, 8);
      ctx.stroke();
      ctx.restore();
      shareDrawSegments(ctx, item.items, x + item.pad, y + item.topInset, item.innerW, C);
      y += item.h + item.gap;
    }
  });
}
/* 공유 카드용 웹폰트(IBM Plex Sans KR)를 실제로 사용하기 전에 로드 완료를 기다린다.
   구글 폰트는 <link display=swap>으로 비동기 로드되기 때문에, 캔버스 텍스트를 측정(measureText)한
   시점과 실제로 그리는(fillText) 시점 사이에 폰트가 막 전환되면 줄바꿈 계산이 어긋나
   텍스트가 박스 밖으로 삐져나오거나 박스 테두리가 잘려 보이는 문제가 생길 수 있다.
   한 번 로드되면 이후에는 캐시돼서 매번 네트워크를 타지 않는다. */
let _shareFontsReadyPromise = null;
function shareEnsureFontsReady(){
  if(_shareFontsReadyPromise) return _shareFontsReadyPromise;
  _shareFontsReadyPromise = (async ()=>{
    try{
      if(document.fonts && document.fonts.load){
        await Promise.all([
          document.fonts.load("600 26px 'IBM Plex Sans KR'"),
          document.fonts.load("400 21px 'IBM Plex Sans KR'"),
          document.fonts.load("700 22px 'IBM Plex Sans KR'"),
          document.fonts.load("400 15px 'IBM Plex Sans KR'"),
          document.fonts.load("700 17px 'IBM Plex Sans KR'"),
          document.fonts.load("400 14px 'IBM Plex Sans KR'")
        ]);
      }
      if(document.fonts && document.fonts.ready){
        await document.fonts.ready;
      }
    }catch(e){
      console.warn("공유 카드 폰트 로드 실패(폴백 폰트로 계속 진행):", e);
    }
  })();
  return _shareFontsReadyPromise;
}
/* 공유 카드에 넣을 "이 문제로 바로 가는" 딥링크를 짧게 만든다. is.gd의 무료 API는
   "브라우저에서 실행되는 애플리케이션(브라우저 확장 등)"을 명시적으로 지원 대상으로
   안내하고 있어 CORS 문제 없이 클라이언트에서 바로 호출 가능하다. (TinyURL의 옛 api-create.php
   엔드포인트는 폐지되어 더 이상 동작하지 않아 is.gd로 교체함)
   그래도 만약 실패하면(네트워크 오류 등) 원래의 긴 링크를 그대로 쓰도록 안전하게 대체한다. */
/* 문제 하나로 바로 가는 공유용 주소를 만든다. 외부 단축 서비스에 기대지 않고도 이미 짧아지도록,
   허브(challenge60.github.io/do/certs/<id>/index.html) 구조에서는 CERTS_REGISTRY의 shortCode를 이용해
   "challenge60.github.io/do/?q=<shortCode>-<문항ID>" 형태로 줄인다. index.html(허브)이 이 파라미터를
   보고 실제 자격증 페이지로 리다이렉트해준다(assets/hub.js의 handleShortDeepLinkIfAny 참고).
   standalone처럼 이 구조가 아니거나 shortCode를 못 찾으면, 기존 방식(현재 페이지 경로 + ?q=)으로 대체한다. */
function buildShareDeepLink(questionId){
  const path = location.pathname;
  const certsIdx = path.indexOf("/certs/");
  if(certsIdx !== -1 && typeof CERTS_REGISTRY !== "undefined"){
    const hubRoot = path.slice(0, certsIdx + 1); // 예: "/do/"
    const certEntry = CERTS_REGISTRY.find(c => c.id === (typeof CERT_ID !== "undefined" ? CERT_ID : null));
    if(certEntry && certEntry.shortCode){
      return location.origin + hubRoot + "?q=" + certEntry.shortCode + "-" + questionId;
    }
  }
  return location.origin + path + "?q=" + encodeURIComponent(questionId);
}
async function shareShortenUrl(longUrl){
  try{
    // 브라우저가 외부 단축 서비스(is.gd 등)를 직접 호출하면 CORS로 막히는 경우가 있어서,
    // Supabase Edge Function(shorten-url)이 서버 대 서버로 대신 호출해준다.
    // (standalone 배포본에도 동일하게 쓸 수 있도록 프로젝트 URL을 직접 하드코딩함 —
    //  anon key 없이도 접근 가능하게 verify_jwt=false로 배포되어 있음)
    const res = await fetch(
      "https://fcxpzpdsqwzwaiwhjzqn.supabase.co/functions/v1/shorten-url?url=" + encodeURIComponent(longUrl)
    );
    if(!res.ok) throw new Error("shorten http " + res.status);
    const data = await res.json();
    if(!data.shortUrl || !/^https?:\/\//.test(data.shortUrl)) throw new Error("unexpected response");
    return data.shortUrl;
  }catch(e){
    console.warn("링크 단축 실패, 원본 링크로 대체합니다:", e.message);
    return longUrl;
  }
}
async function buildQuestionShareCanvas(q, withAnswer){
  await shareEnsureFontsReady();
  const SCALE = 2;
  const W = 720;
  const PAD = 32;
  const contentW = W - PAD*2;
  const MAX_IMG_H = 360;
  const C = SHARE_COLORS;
  const examCfg = (typeof EXAM_CONFIG !== "undefined") ? EXAM_CONFIG : { markText: "", subtitle: "" };
  const appTitle = "My도전 Note";
  const certLine = `${examCfg.markText} ${shortSubOf(examCfg)}`.trim();
  const shareUrl = await shareShortenUrl(buildShareDeepLink(q.id));
  const multiRound = datasetHasMultiRound(getData());
  const label = yearRoundLabel(q, multiRound) + (q.no?`-${q.no}`:"");
  const images = q.images || [];

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");

  // 정답 쪽에서 이미 쓰이는 이미지는 문제 쪽 "누락 이미지" 목록에서 제외한다 (기존 renderTextWithImages와 동일 원칙)
  const usedInAnswer = new Set();
  if(q.answer){
    let rm, re = /\{\{img:(\d+)\}\}/g;
    while((rm = re.exec(q.answer)) !== null) usedInAnswer.add(Number(rm[1]));
  }
  const qParsed = await shareParseSegments(q.question, images);
  const leftoverIdx = images.map((_,i)=>i).filter(i=>!qParsed.usedIdx.has(i) && !usedInAnswer.has(i));
  for(const idx of leftoverIdx){
    const src = imgSrc(images[idx]);
    if(src){ const img = await shareLoadImage(src); if(img) qParsed.segments.push({type:"img", img}); }
  }
  // 문항 라벨(예: "22-2-24. ")을 최상위 첫 텍스트 조각 앞에 붙인다 (박스 안쪽 텍스트는 제외)
  const firstTopText = qParsed.segments.find(s=>s.type==="text");
  if(firstTopText) firstTopText.value = `${label}. ` + firstTopText.value;
  else qParsed.segments.unshift({type:"text", value:`${label}. `});

  let ansSegments = [];
  if(withAnswer && q.answer){
    const ansParsed = await shareParseSegments(q.answer, images);
    ansSegments = ansParsed.segments;
  }

  const qFont = "600 26px 'IBM Plex Sans KR', sans-serif";
  const qLineH = 34;
  const ansFont = "400 21px 'IBM Plex Sans KR', sans-serif";
  const ansLineH = 28;

  const laidOutQ = shareLayoutSegments(mctx, qParsed.segments, contentW - 8, qFont, qLineH, MAX_IMG_H);
  const laidOutAns = shareLayoutSegments(mctx, ansSegments, contentW - 32, ansFont, ansLineH, MAX_IMG_H);

  const headerH = 86;
  let y = headerH + 28;
  y += shareSegmentsHeight(laidOutQ);
  y += 6;
  let ansBoxH = 0;
  if(withAnswer){
    ansBoxH = 44 + shareSegmentsHeight(laidOutAns) + 24;
    y += ansBoxH + 8;
  }
  y += 92; // 하단 버전 표시 줄 + 링크 표시 줄 공간

  const H = Math.ceil(y);
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0, C.deep);
  grad.addColorStop(1, C.teal);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = C.amber;
  ctx.fillRect(0, headerH-6, W, 6);

  // "My도전"은 앱 곳곳에서 쓰는 것과 같은 amber 배지로, "Note"는 옆에 일반 텍스트로 그린다
  ctx.font = "800 20px 'IBM Plex Sans KR', sans-serif";
  const badgeText = "My도전";
  const badgeTextW = ctx.measureText(badgeText).width;
  const badgePadX = 12, badgeH = 30;
  const badgeY = 44 - 21; // 기존 베이스라인(44) 기준으로 배지를 세로 중앙 정렬
  shareRoundRect(ctx, PAD, badgeY, badgeTextW + badgePadX*2, badgeH, 7);
  ctx.fillStyle = C.amber;
  ctx.fill();
  ctx.fillStyle = C.deep;
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, PAD + badgePadX, badgeY + badgeH/2 + 1);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px 'IBM Plex Sans KR', sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Note", PAD + badgeTextW + badgePadX*2 + 10, 44);

  ctx.font = "400 15px 'IBM Plex Sans KR', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const subj = q.unitMajor || "";
  ctx.fillText(`${certLine} · ${subj}${subj?" · ":""}${label} 기출`, PAD, 68);

  const bodyY = headerH + 14;
  ctx.fillStyle = C.card;
  shareRoundRect(ctx, PAD-16, bodyY, contentW+32, H - bodyY - 60, 18);
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  shareRoundRect(ctx, PAD-16, bodyY, contentW+32, H - bodyY - 60, 18);
  ctx.stroke();

  let cy = bodyY + 40;
  shareDrawSegments(ctx, laidOutQ, PAD, cy, contentW - 8, C);
  cy += shareSegmentsHeight(laidOutQ) + 6;

  if(withAnswer){
    ctx.fillStyle = C.tealSoft;
    shareRoundRect(ctx, PAD, cy, contentW, ansBoxH, 10);
    ctx.fill();
    ctx.fillStyle = C.teal;
    ctx.font = "700 17px 'IBM Plex Sans KR', sans-serif";
    ctx.fillText("✅ 모범답안", PAD+16, cy+30);
    shareDrawSegments(ctx, laidOutAns, PAD+16, cy+62, contentW - 32, C);
    cy += ansBoxH + 8;
  }

  ctx.fillStyle = C.muted;
  ctx.font = "400 14px 'IBM Plex Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${appTitle} · Ver.${typeof APP_VERSION!=="undefined"?APP_VERSION:""}`, W/2, H-46);
  ctx.fillStyle = C.teal;
  ctx.font = "600 15px 'IBM Plex Sans KR', sans-serif";
  ctx.fillText(`🔗 ${shareUrl.replace(/^https?:\/\//, "")}`, W/2, H-20);
  ctx.textAlign = "left";

  return canvas;
}
/* 이미지 공유: navigator.clipboard.write()를 클릭 이벤트 안에서 "즉시" 호출해야
   브라우저가 이를 사용자 제스처로 인정해 별도 확인 없이 복사를 허용한다.
   그런데 캔버스 생성(도면 이미지 로딩 등)은 비동기라 시간이 걸리므로, 실제 데이터는
   나중에 채워지는 Promise로 넘기고(Clipboard API가 지원하는 지연 채움 패턴) write 호출
   자체는 먼저 실행해 사용자 제스처를 놓치지 않게 한다. 이 처리가 없으면 그림이 있는
   문제처럼 캔버스 생성이 조금이라도 오래 걸릴 때 클립보드 복사가 조용히 실패해서
   "이미지 저장(미리보기)" 폴백으로 넘어가 버린다. */
async function shareQuestionImage(q, withAnswer){
  const fname = `건축기사실기_${q.id}_${withAnswer?"정답포함":"문제"}.png`;
  const supportsClipboardImage = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);

  let resolveBlob, rejectBlob;
  let writePromise = null;
  if(supportsClipboardImage){
    const blobPromise = new Promise((res,rej)=>{ resolveBlob=res; rejectBlob=rej; });
    writePromise = navigator.clipboard.write([ new ClipboardItem({ "image/png": blobPromise }) ]).catch(e=>e);
  }

  toast("이미지를 만들고 있어요...");
  let canvas, blob;
  try{
    canvas = await buildQuestionShareCanvas(q, withAnswer);
    blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }catch(err){
    console.error(err);
    if(rejectBlob) rejectBlob(err);
    toast("이미지 생성 중 오류가 발생했어요");
    return;
  }

  if(supportsClipboardImage){
    resolveBlob(blob);
    const writeResult = await writePromise;
    if(!(writeResult instanceof Error)){
      showCopyConfirm("image");
      return;
    }
    console.warn("이미지 클립보드 복사 실패:", writeResult);
  }
  const dataUrl = canvas.toDataURL("image/png");
  showShareResultModal({kind:"image", dataUrl, fname, blob});
}
async function shareQuestionText(q, withAnswer){
  const text = await buildShareText(q, withAnswer);
  const ok = await copyTextRobust(text);
  if(ok){
    showCopyConfirm("text");
  } else {
    showShareResultModal({kind:"text", dataUrl:text, fname:null});
  }
}
function showCopyConfirm(kind){
  const isImg = kind === "image";
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box copy-confirm-box">
      <div class="copy-confirm-icon">✅</div>
      <h3>${isImg ? "이미지가 복사됐어요" : "텍스트가 복사됐어요"}</h3>
      <p style="font-size:0.85rem;color:var(--muted);margin:4px 0 16px;">카카오톡 등 채팅창에 붙여넣기(Ctrl/⌘+V) 하면 바로 보낼 수 있어요.</p>
      <button type="button" class="btn primary" id="copyConfirmOk" style="width:100%;">확인</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector("#copyConfirmOk").addEventListener("click", close);
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
  setTimeout(close, 3200);
}
function showShareResultModal(opt){
  const isImg = opt.kind === "image";
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <span class="close-x">✕</span>
      <h3>${isImg ? "🖼️ 공유 카드가 만들어졌어요" : "📄 공유 텍스트가 만들어졌어요"}</h3>
      ${isImg
        ? `<div class="share-preview"><img src="${opt.dataUrl}" alt="공유 카드 미리보기"></div>`
        : `<div class="share-text-preview">${escapeHtml(opt.dataUrl)}</div>`}
      <p style="font-size:0.85rem;color:var(--muted);line-height:1.5;">${isImg
        ? "아래 버튼으로 이미지를 저장한 뒤, 카카오톡 채팅방에서 사진 첨부(📎)로 방금 저장한 이미지를 선택해 보내주세요. 저장이 안 되면 위 이미지를 길게 눌러 저장할 수 있어요."
        : "아래 버튼으로 텍스트를 복사한 뒤, 카카오톡 채팅창에 붙여넣기(길게 눌러 붙여넣기) 해주세요."}</p>
      <div class="btn-row">
        ${isImg
          ? `<button class="btn ghost" id="shareOpenBtn">새 탭에서 열기</button><button class="btn ghost" id="shareDownloadBtn">이미지 저장</button>${opt.blob ? `<button class="btn primary" id="shareCopyImgBtn">📋 클립보드에 복사</button>` : ``}`
          : `<button class="btn primary" id="shareCopyBtn">텍스트 복사하기</button>`}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = ()=> overlay.remove();
  overlay.querySelector(".close-x").addEventListener("click", close);
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
  if(isImg){
    overlay.querySelector("#shareOpenBtn").addEventListener("click", ()=>{
      const win = window.open("", "_blank");
      if(!win){ toast("새 탭 열기가 차단됐어요. 브라우저의 팝업 차단을 해제해주세요."); return; }
      win.document.write(`<!doctype html><title>${escapeHtml(opt.fname||"공유 카드")}</title><body style="margin:0;background:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${opt.dataUrl}" style="max-width:100%;height:auto;display:block;"></body>`);
      win.document.close();
    });
    overlay.querySelector("#shareDownloadBtn").addEventListener("click", async ()=>{
      try{
        const blob = opt.blob || await (await fetch(opt.dataUrl)).blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = opt.fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=> URL.revokeObjectURL(url), 4000);
        toast("이미지를 저장했어요");
      }catch(e){
        console.error(e);
        toast("저장에 실패했어요. 위 이미지를 길게 눌러 저장해보세요.");
      }
    });
    const copyImgBtn = overlay.querySelector("#shareCopyImgBtn");
    if(copyImgBtn){
      copyImgBtn.addEventListener("click", async ()=>{
        if(!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)){
          toast("이 브라우저/앱에서는 이미지 클립보드 복사를 지원하지 않아요. 이미지 저장을 이용해주세요.");
          return;
        }
        try{
          await navigator.clipboard.write([ new ClipboardItem({ "image/png": opt.blob }) ]);
          showCopyConfirm("image");
        }catch(err){
          console.warn("클립보드 복사 실패:", err);
          toast("클립보드 복사에 실패했어요. 이미지 저장을 이용해주세요.");
        }
      });
    }
  } else {
    overlay.querySelector("#shareCopyBtn").addEventListener("click", async ()=>{
      const ok = await copyTextRobust(opt.dataUrl);
      toast(ok ? "텍스트를 복사했어요" : "복사에 실패했어요. 텍스트를 직접 선택해 복사해주세요.");
    });
  }
}

/* ============ 중복 출제 상세보기: 카드 상단 별점(★★★) 배지를 탭하면 연도별 출제 이력을 모두 보여준다 ============ */
function openDuplicateModal(id){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  if("speechSynthesis" in window) speechSynthesis.cancel();
  const data = getData();
  const multiRound = datasetHasMultiRound(data);
  const groups = buildCombinedGroups(data);
  const g = groups.find(gr=> gr.some(qq=>qq.id===id));
  const list = (g||[]).slice().sort((a,b)=>{
    if(a.year!==b.year) return b.year-a.year;
    return (b.round||1)-(a.round||1);
  });
  const itemsHtml = list.map(c=>{
    const label = yearRoundLabel(c, multiRound) + (c.no?`-${c.no}`:"");
    return `
      <div class="tagmodal-item">
        <div class="tagmodal-meta" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span>${label} · ${c.year}년${c.round?" "+c.round+"회":""} · ${c.unitMajor}${c.unitMinor ? " · "+c.unitMinor : ""}${c.points?` · ${c.points}점`:""}${c.id===id?" · (현재 문제)":""}</span>
          ${list.length>1 ? `<button type="button" class="pdf-mini" data-dupunlink="${c.id}" style="flex-shrink:0;">이 그룹에서 해제</button>` : ""}
        </div>
        ${renderTextWithImages(c.question, c.images, c.answer)}
        <div class="answer-reveal qa-box" style="margin-top:32px;"><span class="qa-label answer">정답</span>${inlineImagesOnly(c.answer, c.images)}</div>
      </div>`;
  }).join("");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box tagmodal-box">
      <span class="close-x">✕</span>
      <div class="card-head" style="padding-right:24px;">
        <h3>★ 중복 출제 이력 · ${list.length}건</h3>
      </div>
      ${list.length>1 ? `<p style="font-size:0.78rem;color:var(--muted);padding:0 4px;">중복 연결이 잘못됐다면 해당 문항의 "이 그룹에서 해제"를 눌러주세요. 그 문항만 이 그룹에서 빠지고, 나머지는 그대로 서로 연결된 채 남아요.</p>` : ""}
      <div class="tagmodal-list">${itemsHtml || '<div class="empty-note">중복 출제 이력이 없습니다.</div>'}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector(".close-x").addEventListener("click", ()=> overlay.remove());
  overlay.querySelectorAll("[data-dupunlink]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const targetId = btn.dataset.dupunlink;
      if(!confirm("이 문항을 중복 그룹에서 해제할까요? (이 문항만 빠지고, 나머지 문항들끼리는 계속 연결된 채로 남아요. 앞으로 자동 재감지 대상에서도 제외돼요)")) return;
      removeFromDupGroup(targetId);
      overlay.remove();
      openDuplicateModal(id===targetId ? (list.find(x=>x.id!==targetId)||{}).id : id);
    });
  });
  let mouseDownOnDupModal = false;
  overlay.addEventListener("mousedown", e=>{ mouseDownOnDupModal = (e.target===overlay); });
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay && mouseDownOnDupModal) overlay.remove(); });
}

function revealAnswer(q){
  const noteHtml = q.note ? `<div class="note-box">${escapeHtml(q.note)}</div>` : "";

  document.getElementById("answerSlot").innerHTML = `
    <div class="answer-reveal qa-box"><span class="qa-label answer">정답</span>${inlineImagesOnly(q.answer, q.images)}</div>
    ${renderTagChips(q)}
    ${noteHtml}
  `;
  bindTagChips(document.getElementById("answerSlot"));
  document.getElementById("gradeSlot").innerHTML = `
    <div class="diff-note">내 답변과 비교해보고 상단 고정바의 [오답 X] / [정답 O]로 채점해주세요.</div>
  `;
  state.answerVisible = true;
  updateRevealBtnLabel();
  const navWrongBtn = document.getElementById("studyNavWrong");
  const navCorrectBtn = document.getElementById("studyNavCorrect");
  // 이미 채점된 카드(정답 O/오답 X를 이미 누름)라면, 정답을 다시 열어봐도 채점 버튼을 재활성화하지 않는다.
  if(navWrongBtn && navCorrectBtn && !state.cardGraded){
    navWrongBtn.disabled = false;
    navCorrectBtn.disabled = false;
  }
}
/* ---- 정답을 다시 가린다(연습모드에서 자동으로 정답이 보인 상태를 되돌려, 스스로 떠올려볼 수 있게) ---- */
function hideAnswerUI(){
  const answerSlot = document.getElementById("answerSlot");
  if(answerSlot) answerSlot.innerHTML = "";
  const gradeSlot = document.getElementById("gradeSlot");
  if(gradeSlot) gradeSlot.innerHTML = "";
  state.answerVisible = false;
  updateRevealBtnLabel();
  const navWrongBtn = document.getElementById("studyNavWrong");
  const navCorrectBtn = document.getElementById("studyNavCorrect");
  // 이미 채점된 카드라면 채점 버튼은 계속 비활성 상태로 둔다(재채점 방지).
  if(navWrongBtn && navCorrectBtn && !state.cardGraded){
    navWrongBtn.disabled = true;
    navCorrectBtn.disabled = true;
  }
}
/* ---- [정답보기]/[정답가리기] 버튼 및 카드 탭 공통으로 쓰는 토글 ---- */
function toggleAnswerVisibility(q){
  if(state.answerVisible) hideAnswerUI(); else revealAnswer(q);
}
function updateRevealBtnLabel(){
  const btn = document.getElementById("studyNavReveal");
  if(btn) btn.textContent = state.answerVisible ? "정답가리기" : "정답보기";
}

function selfGrade(q, isCorrect){
  const navCorrectBtn = document.getElementById("studyNavCorrect");
  const navWrongBtn = document.getElementById("studyNavWrong");
  if(navCorrectBtn.disabled) return; // 아직 정답을 보지 않았거나 이미 채점됨 - 중복 클릭 방지
  navCorrectBtn.disabled = true;
  navWrongBtn.disabled = true;
  state.cardGraded = true; // 명시적으로 채점됨 → 카드 전환 시 별도 passive 기록을 남기지 않음
  if(!state.passiveCounted) state.passiveCounted = new Set();
  state.passiveCounted.add(q.id);

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
  const allData = getData();
  const examParts = datasetExamParts(allData);
  const multiPart = examParts.length > 1;
  if(multiPart && !examParts.includes(state.examPart)) state.examPart = examParts[0];
  const partPool = multiPart ? allData.filter(q=> q.examPart === state.examPart) : allData;
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
      ${multiPart ? `
      <div class="settings-row" style="margin-top:10px;flex-direction:column;align-items:flex-start;">
        <div class="label" style="margin-bottom:6px;">시험 종류 (필답형·작업형은 서로 섞이지 않아요)</div>
        <div class="chip-row" id="examPartChipRow">
          ${examParts.map(p=>`<button class="chip ${p===state.examPart?'active':''}" data-part="${escapeHtml(p)}">${escapeHtml(p)} (${allData.filter(q=>q.examPart===p).length}문항)</button>`).join("")}
        </div>
      </div>` : ""}
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
  if(multiPart){
    app.querySelectorAll("#examPartChipRow [data-part]").forEach(b=>{
      b.addEventListener("click", ()=>{
        state.examPart = b.dataset.part;
        renderExamIntro(); // 문항 수 등 표시를 새로 고르는 종류 기준으로 다시 그림
      });
    });
  }
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
  const allData = getData();
  const examParts = datasetExamParts(allData);
  const pool = (examParts.length > 1 && state.examPart) ? allData.filter(q=> q.examPart === state.examPart) : allData;
  const data = [...pool].sort(()=>Math.random()-0.5).slice(0, Math.min(count, pool.length));
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
    if(state.examTimeLeft % 60 === 0) saveExamSession(); // 60초마다 자동저장(예전엔 5초라 동기화 뱃지가 너무 잦았음)
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
    if(state.examTimeLeft % 60 === 0) saveExamSession(); // 60초마다 자동저장(예전엔 5초라 동기화 뱃지가 너무 잦았음)
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
        recordResult(x.q.id, score, "exam"); // 75점 미만은 recordResult 내부 로직에 따라 자동으로 오답노트에 저장됨; 모의고사 채점은 state.mode와 무관하게 항상 "exam"으로 기록
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
  // 허브(로그인 있음)에서는 진짜 관리자 계정 여부로, standalone(로그인 없음)에서는 기존처럼
  // 화면 맨 아래 'Admin' 텍스트를 눌러 비밀번호(2026)를 입력하는 방식으로 관리자 전용
  // 메뉴(학습데이터만 백업 / 외부데이터 복원 / 외부 백업 데이터 병합 / 배포용 ZIP 생성)를 노출한다.
  const isHubContext = typeof supabaseClient !== "undefined" && !!supabaseClient;
  const showAdminOnlyMenus = isHubContext ? !!window.isAdmin : isAdminUnlocked;
  app.innerHTML = `
    <div class="section-card">
      <div class="settings-row"><div class="label">현재 자격증</div><div>${escapeHtml(cfg.titleText)}</div></div>
      <div class="settings-row"><div class="label">현재 문항 수</div><div>${getData().length}문항</div></div>
    </div>

    <div class="section-card">
      <h3>🔊 음성(TTS) 읽기 설정</h3>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:4px;line-height:1.5;">
        문제·정답 읽어주기와 회독 학습의 🔊음성모드에서 사용할 목소리를 고를 수 있어요. 브라우저(기기)에 설치된 음성 목록을 그대로 보여주며,
        같은 한국어라도 브라우저마다 제공되는 목소리 종류와 자연스러움이 달라요. 크롬은 대개 "Google 한국의" 계열이 가장 자연스러워요.
      </p>
      <div class="settings-row" style="margin-top:10px;">
        <div class="label">읽기 목소리</div>
        <select id="ttsVoiceSelect" style="max-width:220px;"></select>
      </div>
      <div class="btn-row" style="margin-top:10px;">
        <button class="btn ghost" id="ttsVoiceTestBtn">▶ 미리듣기</button>
        <button class="btn ghost" id="ttsVoiceRefreshBtn">🔄 목록 새로고침</button>
      </div>
      <p style="font-size:0.72rem;color:var(--muted);margin-top:8px;">
        목록이 비어있거나 "Google 한국의" 같은 음성이 안 보이면, 브라우저 자체 설정(예: 크롬 → 설정 → 접근성 → 텍스트 음성 변환)에서
        해당 음성이 다운로드/활성화되어 있는지 확인해보세요. 여기서는 브라우저가 제공하는 음성만 선택할 수 있어요.
      </p>
    </div>

    <div class="section-card">
      <div class="settings-row"><div class="label">① 학습 보조 기록 초기화</div><button id="resetAll">초기화</button></div>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:4px;">문제 데이터·수정내역은 그대로 두고 정답률·오답노트·즐겨찾기·진행도·회독수만 지웁니다.</p>
    </div>

    <div class="section-card">
      <h3>② 학습데이터 초기화 · 백업 · 복원</h3>
      <div class="settings-row" style="margin-top:6px;"><div class="label">원본 내장 데이터로 초기화</div><button id="restoreSample">초기화</button></div>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:2px;">수정한 내용이 모두 사라지고 앱이 원래 내장하고 있던 문제 데이터로 되돌아갑니다.</p>

      ${showAdminOnlyMenus ? `
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
        <div class="label" style="font-weight:700;margin-bottom:6px;">학습데이터만 백업${isHubContext ? ' <span style="font-size:0.68rem;color:var(--amber);font-weight:800;">(관리자)</span>' : ''}</div>
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
        <div class="label" style="font-weight:700;margin-bottom:6px;">외부데이터 복원${isHubContext ? ' <span style="font-size:0.68rem;color:var(--amber);font-weight:800;">(관리자)</span>' : ''}</div>
        <p style="font-size:0.76rem;color:var(--muted);">다른 사람이 "학습데이터만 백업"으로 내려받은 파일을 선택하면, 그 사람의 데이터로 전환됩니다.</p>
        <input type="file" accept="application/json" id="backupFile" style="margin-top:10px;">
      </div>
      ` : (isHubContext ? `
      <p style="font-size:0.74rem;color:var(--muted);margin-top:14px;padding-top:14px;border-top:1px solid var(--line);">
        학습기록은 이 계정으로 클라우드에 자동 저장되고 있어서, 별도의 파일 백업·복원 메뉴는
        일반 사용자에게는 숨겨져 있어요. (관리자 계정에서만 노출됩니다)
      </p>
      ` : ``)}
    </div>

    ${showAdminOnlyMenus ? `
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

    ${showAdminOnlyMenus ? `
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

    ${!isHubContext ? `
    <div style="text-align:center;margin-top:22px;">
      <span id="adminToggle" style="font-size:0.68rem;color:var(--line);cursor:pointer;user-select:none;">Admin</span>
    </div>
    ` : ``}
  `;
  const adminToggleEl = app.querySelector("#adminToggle");
  if(adminToggleEl){
    adminToggleEl.addEventListener("click", ()=>{
      if(isAdminUnlocked){ isAdminUnlocked = false; renderSettings(); return; }
      const pw = prompt("비밀번호를 입력하세요");
      if(pw === null) return;
      if(pw === "2026"){ isAdminUnlocked = true; renderSettings(); }
      else if(pw !== ""){ alert("비밀번호가 올바르지 않습니다."); }
    });
  }
  populateTtsVoiceSelect();
  app.querySelector("#ttsVoiceRefreshBtn").addEventListener("click", populateTtsVoiceSelect);
  app.querySelector("#ttsVoiceSelect").addEventListener("change", (e)=>{
    store.ttsVoiceName = e.target.value || null;
    saveStore();
  });
  app.querySelector("#ttsVoiceTestBtn").addEventListener("click", ()=>{
    speakText("안녕하세요. 이것은 선택하신 목소리로 읽어주는 미리듣기 예시입니다.");
  });
  app.querySelector("#resetAll").addEventListener("click", ()=>{
    if(confirm("모든 학습기록을 초기화할까요? (문제 데이터·수정내역은 유지됩니다)")){
      store = {progress:{}, wrong:{}, bookmarks:{}, penNotes:{}, penRemembered:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:store.customData, edits:store.edits, examConfig:store.examConfig, session:{}, examSession:null, setRepeats:{}, targetDate:store.targetDate};
      saveStore(); setView("home");
    }
  });

  const backupFileEl = app.querySelector("#backupFile");
  if(backupFileEl) backupFileEl.addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const parsed = decodeBackupPayload(reader.result);
        if(!parsed.data || !Array.isArray(parsed.data) || !parsed.data.length) throw new Error("invalid backup");
        const isFullBackup = parsed.kind === "full-backup";
        const name = (parsed.examConfig&&parsed.examConfig.titleText)||"새 자격증";
        const msg = isFullBackup
          ? `"${name}" 백업을 불러올까요? 학습기록까지 그대로 복원되며, 현재 데이터는 덮어써집니다.`
          : `"${name}" 데이터로 전환할까요? (학습기록이 없는 파일이라 현재 학습기록은 초기화됩니다.)`;
        if(!confirm(msg)) return;
        // 불러오는 데이터의 이미지가 표준(WebP·1000px·용량)을 벗어나면 저장 전에 자동 재압축한다.
        const imgStat = await normalizeDataListImages(parsed.data);
        store = {
          progress: isFullBackup ? (parsed.progress||{}) : {},
          wrong: isFullBackup ? (parsed.wrong||{}) : {},
          bookmarks: isFullBackup ? (parsed.bookmarks||{}) : {},
          penNotes: isFullBackup ? (parsed.penNotes||{}) : {},
          penRemembered: isFullBackup ? (parsed.penRemembered||{}) : {},
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
        const imgNote = imgStat.changedCount ? `\n(이미지 ${imgStat.checked}개 중 ${imgStat.changedCount}개가 용량 기준 초과로 자동 재압축됨)` : "";
        alert((isFullBackup ? "백업을 복원했습니다." : "자격증 데이터를 전환했습니다.") + imgNote);
        setView("home");
      }catch(err){ alert("올바른 백업 파일이 아닙니다."); }
    };
    reader.readAsText(file);
  });

  const exportPackageEl = app.querySelector("#exportPackage");
  if(exportPackageEl) exportPackageEl.addEventListener("click", ()=>{
    const includeProgress = app.querySelector("#includeProgressChkBackup").checked;
    const pkg = includeProgress ? {
      kind: "full-backup",
      version: 1,
      examConfig: activeExamConfig(),
      data: getData(),
      progress: store.progress,
      wrong: store.wrong,
      bookmarks: store.bookmarks,
      penNotes: store.penNotes,
      penRemembered: store.penRemembered,
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
    store = {progress:{}, wrong:{}, bookmarks:{}, penNotes:{}, penRemembered:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:null, session:{}, examSession:null, setRepeats:{}};
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
      reader.onload = async ()=>{
        const logEl = app.querySelector("#mergeResultLog");
        logEl.style.display = "block";
        logEl.textContent = "이미지 용량 확인 중...";
        try{
          const parsed = decodeBackupPayload(reader.result);
          if(!parsed.data || !Array.isArray(parsed.data) || !parsed.data.length) throw new Error("invalid backup");
          // 병합해 들어오는 문제 데이터의 이미지가 표준(WebP·1000px·용량)을 벗어나면 여기서 자동 재압축한다.
          const imgStat = await normalizeDataListImages(parsed.data);
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
          if(imgStat.changedCount){
            const savedKB = Math.max(0, Math.round((imgStat.bytesBefore-imgStat.bytesAfter)/1024*0.75));
            lines.push(`🖼 이미지 ${imgStat.checked}개 중 ${imgStat.changedCount}개가 용량 기준 초과로 자동 재압축됨 (약 ${savedKB}KB 절감)`);
          }
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

/* {{BOX}}...{{/BOX}} 마커로 감싸인 구간(보기/설명/단서 문구)을 점선 박스로 렌더링한다.
   escapeHtml() 이후의 텍스트에 적용하므로 마커 자체는 순수 문자열(중괄호)이라 안전하다. */
function renderBoxMarkers(html){
  return (html||"").replace(/\{\{BOX\}\}([\s\S]*?)\{\{\/BOX\}\}/g, (m, inner)=>`<div class="q-inline-box">${inner}</div>`);
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
    // 배포 시점 타임스탬프(YYYY.MM.DD_HH.MM) — 파일명과 화면의 Ver. 표시에 동일하게 사용
    const nowStampFn = ()=>{
      const d = new Date();
      const p = n=> String(n).padStart(2,"0");
      return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}_${p(d.getHours())}.${p(d.getMinutes())}`;
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
      : {progress:{}, wrong:{}, bookmarks:{}, penNotes:{}, penRemembered:{}, streak:{last:null,count:0}, solvedTotal:0, correctTotal:0, customData:null, edits:{}, examConfig:store.examConfig, session:{}, examSession:null, setRepeats:{}};

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
      const seedTailRe = /\n?<script data-seed="1">try\{localStorage\.setItem\([\s\S]*?\);\}catch\(e\)\{\}<\/script>\n?$/;
      let head = html.slice(0, bodyClose);
      let m;
      while((m = head.match(seedTailRe))){
        head = head.slice(0, head.length - m[0].length);
      }
      html = head + html.slice(bodyClose);
      bodyClose = html.lastIndexOf("</body>");
      const seed = "<script data-seed=\"1\">try{localStorage.setItem(" + JSON.stringify(LS_KEY) + "," + JSON.stringify(JSON.stringify(newStore)) + ");}catch(e){}<\/script>\n";
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
      return renderBoxMarkers(escapeHtml(text||"").replace(/\{\{img:(\d+)\}\}/g, (m, idxStr)=>{
        const idx = Number(idxStr);
        const src = imgSrcs[idx];
        if(!src) return "";
        used.add(idx);
        return `<img src="${src}" style="max-width:100%;margin:6px 0;display:block;">`;
      }));
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
      .q-inline-box{display:block;margin:8px 0;padding:8px 10px;border:1.5px dashed #c5934c;border-radius:6px;background:#fbf2e2;font-size:0.95em;white-space:pre-wrap;}
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
  el.style.transform = "translateX(0)";
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
      el.style.transform = `translateX(${dx}px)`;
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
        el.style.transform = `translateX(${dir*120}%)`;
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
    // 펜 필기장 위에서 시작한 터치는 카드 스와이프(이전/다음)로 오인하지 않도록 제외
    const t = e.touches[0].target;
    if(t && t.closest && t.closest(".pen-pad")) return;
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
    // 정답 영역(#answerSlot) 안의 이미지는 확대를 위해 제스처 추적을 계속 진행시킨다.
    // (그 외 #answerSlot 안의 다른 요소는 기존처럼 카드 스와이프/탭 대상에서 제외)
    const isAnswerImage = e.target.tagName === "IMG" && e.target.closest("#answerSlot");
    if(!isAnswerImage && e.target.closest("button,textarea,input,select,.mini-btn,.edit-image-del,#answerSlot,.pen-pad")) return;
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
/* ---- 이미지 확대 보기 (라이트박스) — 핀치줌·더블탭줌·휠줌·드래그 이동 지원 ----
   표(테이블)처럼 글씨가 작은 이미지는 화면 크기에 맞춘 정도로는 안 보여서,
   그 안에서 추가로 더 확대해볼 수 있어야 한다는 요청으로 추가함. */
function openImageZoom(src){
  const overlay = document.createElement("div");
  overlay.className = "zoom-overlay";
  overlay.innerHTML = `
    <button type="button" class="zoom-close-btn" aria-label="닫기">✕</button>
    <img src="${src}" class="zoom-img" draggable="false">`;
  document.body.appendChild(overlay);
  const img = overlay.querySelector(".zoom-img");
  const closeBtn = overlay.querySelector(".zoom-close-btn");

  const MIN_SCALE = 1, MAX_SCALE = 5;
  let scale = 1, tx = 0, ty = 0;
  const apply = ()=>{ img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; };
  const clampPan = ()=>{
    // 확대된 이미지가 화면 밖으로 과하게 밀려나가지 않도록 대략적으로 제한
    const rect = img.getBoundingClientRect();
    const maxX = Math.max(0, (rect.width*scale - rect.width)/2 + rect.width*0.15);
    const maxY = Math.max(0, (rect.height*scale - rect.height)/2 + rect.height*0.15);
    tx = Math.min(Math.max(tx, -maxX), maxX);
    ty = Math.min(Math.max(ty, -maxY), maxY);
  };
  const setScale = (newScale, cx, cy)=>{
    newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    if(newScale === scale) return;
    scale = newScale;
    if(scale === MIN_SCALE){ tx = 0; ty = 0; }
    clampPan();
    apply();
  };
  const close = ()=> overlay.remove();
  closeBtn.addEventListener("click", close);

  // ---- 더블클릭(데스크톱): 클릭 지점 기준으로 확대/원복 토글 ----
  img.addEventListener("dblclick", (e)=>{
    e.stopPropagation();
    setScale(scale > MIN_SCALE ? MIN_SCALE : 2.5);
  });

  // ---- 마우스 휠(데스크톱): 확대/축소 ----
  overlay.addEventListener("wheel", (e)=>{
    e.preventDefault();
    setScale(scale + (e.deltaY < 0 ? 0.35 : -0.35));
  }, {passive:false});

  // ---- 배경(이미지 바깥) 클릭 시에만 닫힘. 이미지 위 클릭은 더블클릭(확대)과 헷갈리지 않도록
  //      아예 닫기 동작과 무관하게 둔다(더블클릭의 첫 클릭에서 먼저 닫혀버리는 문제 방지). ----
  overlay.addEventListener("click", (e)=>{
    if(e.target === overlay) close();
  });

  // ---- 마우스 드래그로 이동(확대 중일 때만) ----
  let dragging = false, dragStartX=0, dragStartY=0, dragStartTx=0, dragStartTy=0, draggedThisGesture=false;
  img.addEventListener("mousedown", (e)=>{
    if(scale <= MIN_SCALE) return;
    dragging = true; draggedThisGesture = false;
    dragStartX = e.clientX; dragStartY = e.clientY; dragStartTx = tx; dragStartTy = ty;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e)=>{
    if(!dragging) return;
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if(Math.abs(dx) > 3 || Math.abs(dy) > 3) draggedThisGesture = true;
    tx = dragStartTx + dx; ty = dragStartTy + dy;
    clampPan();
    apply();
  });
  window.addEventListener("mouseup", ()=>{ dragging = false; });

  // ---- 터치: 한 손가락 드래그(확대 중 이동) + 두 손가락 핀치줌 + 더블탭줌 ----
  let touchMode = null; // "pan" | "pinch"
  let pinchStartDist = 0, pinchStartScale = 1;
  let panStartX=0, panStartY=0, panStartTx=0, panStartTy=0;
  let lastTapTime = 0;
  const touchDist = (t1, t2)=> Math.hypot(t1.clientX-t2.clientX, t1.clientY-t2.clientY);

  img.addEventListener("touchstart", (e)=>{
    if(e.touches.length === 2){
      touchMode = "pinch";
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = scale;
    } else if(e.touches.length === 1){
      const now = Date.now();
      if(now - lastTapTime < 300){
        // 더블탭: 탭 지점 기준으로 확대/원복 토글
        setScale(scale > MIN_SCALE ? MIN_SCALE : 2.5);
        touchMode = null;
      } else if(scale > MIN_SCALE){
        touchMode = "pan";
        panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
        panStartTx = tx; panStartTy = ty;
      } else {
        touchMode = null; // 확대 안 된 상태의 한 손가락 탭은 닫기 클릭으로 처리(overlay click)
      }
      lastTapTime = now;
    }
  }, {passive:true});
  img.addEventListener("touchmove", (e)=>{
    if(touchMode === "pinch" && e.touches.length === 2){
      const dist = touchDist(e.touches[0], e.touches[1]);
      setScale(pinchStartScale * (dist / pinchStartDist));
      if(e.cancelable) e.preventDefault();
    } else if(touchMode === "pan" && e.touches.length === 1){
      tx = panStartTx + (e.touches[0].clientX - panStartX);
      ty = panStartTy + (e.touches[0].clientY - panStartY);
      clampPan();
      apply();
      if(e.cancelable) e.preventDefault();
    }
  }, {passive:false});
  img.addEventListener("touchend", ()=>{ touchMode = null; });
}

/* ---- 카드 등장 애니메이션 (책장 넘기기 느낌) ---- */
function playCardEnterAnimation(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  // 직전 스와이프 중 남아있을 수 있는 인라인 transform/opacity를 먼저 완전히 초기화한다
  // (전환 중간에 다음 문제로 넘어가는 등 타이밍이 어긋나면 예전엔 기울어진 채로 멈춰있는 버그가 있었음)
  el.style.transition = "none";
  el.style.transform = "";
  el.style.opacity = "";
  el.classList.add("card-enter");
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=> el.classList.remove("card-enter"));
  });
}

/* ---- 문제/정답 텍스트에 이미지 삽입 위치({{img:N}}) 반영 렌더링 ---- */
function inlineImagesOnly(text, images){
  const safe = escapeHtml(text || "");
  if(!images || !images.length) return renderBoxMarkers(safe);
  return renderBoxMarkers(safe.replace(/\{\{img:(\d+)\}\}/g, (m, idxStr)=>{
    const idx = Number(idxStr);
    if(idx<0 || idx>=images.length) return "";
    const src = imgSrc(images[idx]);
    return src ? `<img src="${src}" alt="이미지 ${idx+1}" class="q-image inline-img">` : "";
  }));
}
function renderTextWithImages(text, images, otherText, extraLabelHtml){
  const safe = escapeHtml(text || "");
  const labelHtml = `<span class="qa-label">문제</span>${extraLabelHtml ? `<span class="card-edit-status-badges-inline">${extraLabelHtml}</span>` : ""}`;
  if(!images || !images.length){
    return `<div class="q-text">${labelHtml}${renderBoxMarkers(safe)}</div>`;
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
  return `<div class="q-text">${labelHtml}${renderBoxMarkers(withInline)}${tail}</div>`;
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
      openTagModal(el.dataset.tag);
    });
  });
}

/* ---- 특정 키워드 태그를 가진 문항들을 모달창으로 바로 보여준다 (학습 흐름을 벗어나지 않도록) ---- */
function openTagModal(tag){
  document.querySelectorAll(".modal-overlay").forEach(o=>o.remove());
  if("speechSynthesis" in window) speechSynthesis.cancel();
  const list = getData().filter(d=> (d.tags||[]).includes(tag));
  const itemsHtml = list.map(c=>{
    return `
      <div class="tagmodal-item">
        <div class="tagmodal-meta">${c.year}년${c.round?" "+c.round+"회":""} · ${c.unitMajor}${c.unitMinor ? " · "+c.unitMinor : ""}${c.points?` · ${c.points}점`:""}</div>
        ${renderTextWithImages(c.question, c.images, c.answer)}
        <div class="answer-reveal qa-box" style="margin-top:32px;"><span class="qa-label answer">정답</span>${inlineImagesOnly(c.answer, c.images)}</div>
      </div>`;
  }).join("");
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box tagmodal-box">
      <span class="close-x">✕</span>
      <div class="card-head" style="padding-right:24px;">
        <h3>#${escapeHtml(tag)} · ${list.length}건</h3>
      </div>
      <div class="tagmodal-list">${itemsHtml || '<div class="empty-note">관련 문제가 없습니다.</div>'}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector(".close-x").addEventListener("click", ()=> overlay.remove());
  let mouseDownOnTagModal = false;
  overlay.addEventListener("mousedown", e=>{ mouseDownOnTagModal = (e.target===overlay); });
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay && mouseDownOnTagModal) overlay.remove(); });
}

/* ---- 특정 키워드 태그를 가진 문항만 모아 '전체 문제 목록' 화면으로 이동 (태그 클라우드 등 탐색 목적 전용) ---- */
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
  const multiPart = datasetHasMultiExamPart(data);
  const combos = {};
  data.forEach(d=>{
    const key = d.year + "-" + (d.round||1) + (multiPart ? "-"+d.examPart : "");
    if(!combos[key]) combos[key] = {value:key, label:`${d.year}년${multiRound?" "+(d.round||1)+"회":""}${multiPart?" · "+d.examPart:""}`, year:d.year, round:d.round||1, examPart:d.examPart};
  });
  return Object.values(combos).sort((a,b)=> a.year-b.year || a.round-b.round || String(a.examPart||"").localeCompare(String(b.examPart||"")));
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
  const multiPart = datasetHasMultiExamPart(data);
  const freqMap = questionFrequencyMap(data);
  const recMap = questionRecencyMap(data);
  let list = data.slice();
  if(browseYearSelected.size) list = list.filter(c=> browseYearSelected.has(c.year + "-" + (c.round||1) + (multiPart ? "-"+c.examPart : "")));
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
      if(tagTarget){ openTagModal(tagTarget.dataset.tag); return; }
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
  if(!confirm("이 문항을 연결된 그룹에서 해제할까요? (앞으로 자동 재감지 대상에서도 제외돼요)")) return;
  removeFromDupGroup(id);
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
        <div class="btn-row" style="margin-top:6px;gap:8px;">
          <button type="button" class="btn ghost box-wrap-btn" data-target="editQuestion" style="min-height:36px;font-size:0.82rem;">🔲 선택 영역 박스로 감싸기</button>
          <button type="button" class="btn ghost box-unwrap-btn" data-target="editQuestion" style="min-height:36px;font-size:0.82rem;color:var(--brick);border-color:var(--brick);">박스 해제</button>
          <button type="button" class="btn ghost symbol-panel-btn" data-target="editQuestion" style="min-height:36px;font-size:0.82rem;">Ω 기호 삽입</button>
        </div>
      </div>
      <div class="edit-field">
        <label>정답 · 해설</label>
        <textarea class="edit-textarea" id="editAnswer">${escapeHtml(original.answer)}</textarea>
        <div class="btn-row" style="margin-top:6px;gap:8px;">
          <button type="button" class="btn ghost box-wrap-btn" data-target="editAnswer" style="min-height:36px;font-size:0.82rem;">🔲 선택 영역 박스로 감싸기</button>
          <button type="button" class="btn ghost box-unwrap-btn" data-target="editAnswer" style="min-height:36px;font-size:0.82rem;color:var(--brick);border-color:var(--brick);">박스 해제</button>
          <button type="button" class="btn ghost symbol-panel-btn" data-target="editAnswer" style="min-height:36px;font-size:0.82rem;">Ω 기호 삽입</button>
        </div>
      </div>
      <div class="edit-field" id="symbolPanelHost"></div>
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
        <label>이미지 (<span id="editImageCount">${workingImages.length}</span>장) <small style="font-weight:400;color:var(--muted);">(파일 선택 외에도 이미지를 이 영역으로 드래그하거나, 복사한 이미지를 여기에 붙여넣기(Ctrl+V) 할 수 있어요)</small></label>
        <div id="editImageDropzone" style="border:1.5px dashed var(--line);border-radius:10px;padding:10px;transition:border-color .15s,background .15s;">
          <div id="editImagePreview">${renderPreview()}</div>
        </div>
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
  /* 이미지 드래그&드롭 추가: 드롭존 영역에 이미지 파일을 끌어다 놓으면 파일 선택과 동일하게 처리 */
  const addImageFiles = async (files)=>{
    const imgFiles = Array.from(files || []).filter(f=>f && f.type && f.type.startsWith("image/"));
    if(!imgFiles.length) return;
    const uploadBtn = overlay.querySelector("#editImageUpload");
    if(uploadBtn){ uploadBtn.disabled = true; uploadBtn.textContent = "이미지 처리 중..."; }
    try{
      for(const file of imgFiles){
        const compressed = await compressImageFile(file);
        if(compressed) workingImages.push(compressed);
      }
    }finally{
      if(uploadBtn){ uploadBtn.disabled = false; uploadBtn.textContent = "이미지 추가"; }
      refreshPreview();
    }
  };
  const dropzone = overlay.querySelector("#editImageDropzone");
  if(dropzone){
    ["dragenter","dragover"].forEach(evt=>{
      dropzone.addEventListener(evt, e=>{
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = "var(--teal)";
        dropzone.style.background = "var(--teal-soft)";
      });
    });
    ["dragleave","dragend"].forEach(evt=>{
      dropzone.addEventListener(evt, e=>{
        e.preventDefault(); e.stopPropagation();
        dropzone.style.borderColor = "var(--line)";
        dropzone.style.background = "";
      });
    });
    dropzone.addEventListener("drop", e=>{
      e.preventDefault(); e.stopPropagation();
      dropzone.style.borderColor = "var(--line)";
      dropzone.style.background = "";
      const dt = e.dataTransfer;
      if(dt && dt.files && dt.files.length) addImageFiles(dt.files);
    });
  }
  /* 이미지 복사 붙여넣기: 편집창 어디에 포커스가 있든(문제/정답 텍스트 영역 포함) Ctrl+V로
     클립보드에 담긴 이미지를 바로 추가할 수 있게 한다 */
  overlay.addEventListener("paste", e=>{
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const pastedFiles = [];
    for(const item of items){
      if(item.kind === "file" && item.type && item.type.startsWith("image/")){
        const f = item.getAsFile();
        if(f) pastedFiles.push(f);
      }
    }
    if(pastedFiles.length){
      e.preventDefault();
      addImageFiles(pastedFiles);
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

  /* 박스 감싸기/해제는 버튼이 속한 필드(문제 또는 정답)에 각각 독립적으로 적용된다.
     즉 정답 쪽 텍스트를 선택하고 정답 밑의 버튼을 누르면 정답에, 문제 쪽을 선택하고
     문제 밑의 버튼을 누르면 문제에 반영된다. */
  overlay.querySelectorAll(".box-wrap-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const ta = overlay.querySelector("#"+btn.dataset.target);
      const start = ta.selectionStart, end = ta.selectionEnd;
      if(start === end){ toast("먼저 박스로 감쌀 문장을 드래그해서 선택해주세요"); return; }
      const val = ta.value;
      const wrapped = "{{BOX}}" + val.slice(start, end) + "{{/BOX}}";
      ta.value = val.slice(0, start) + wrapped + val.slice(end);
      ta.focus();
      ta.selectionStart = start;
      ta.selectionEnd = start + wrapped.length;
    });
  });
  overlay.querySelectorAll(".box-unwrap-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const ta = overlay.querySelector("#"+btn.dataset.target);
      const fieldLabel = btn.dataset.target === "editAnswer" ? "정답" : "문제";
      const start = ta.selectionStart, end = ta.selectionEnd;
      const val = ta.value;
      if(start !== end){
        const cleaned = val.slice(start, end).replace(/\{\{BOX\}\}/g, "").replace(/\{\{\/BOX\}\}/g, "");
        ta.value = val.slice(0, start) + cleaned + val.slice(end);
        ta.focus();
        ta.selectionStart = start;
        ta.selectionEnd = start + cleaned.length;
      }else{
        if(!(val.includes("{{BOX}}") || val.includes("{{/BOX}}"))){ toast(`이 ${fieldLabel}에는 박스 표시가 없습니다`); return; }
        if(!confirm(`선택된 부분이 없습니다. ${fieldLabel}의 모든 박스 표시를 제거할까요?`)) return;
        ta.value = val.replace(/\{\{BOX\}\}/g, "").replace(/\{\{\/BOX\}\}/g, "");
      }
    });
  });

  // ---- 기호 삽입 팔레트: 자격증 시험에 자주 나오는 로마자·원문자·그리스문자·수학기호 등을
  // 커서 위치에 바로 넣는다. LaTeX 같은 수식 편집기까지는 과해서, 실용적인 선에서 유니코드
  // 문자만으로 처리 — 렌더링 쪽 변경이 전혀 필요 없다는 것도 장점(그냥 평범한 텍스트라서). ----
  const SYMBOL_CATEGORIES = [
    { label: "로마자", chars: "Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ Ⅵ Ⅶ Ⅷ Ⅸ Ⅹ Ⅺ Ⅻ".split(" ") },
    { label: "원문자(숫자)", chars: "① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩ ⑪ ⑫ ⑬ ⑭ ⑮".split(" ") },
    { label: "원문자(가나다)", chars: "㉮ ㉯ ㉰ ㉱ ㉲ ㉳ ㉴ ㉵ ㉶ ㉷".split(" ") },
    { label: "원문자(영문)", chars: "Ⓐ Ⓑ Ⓒ Ⓓ Ⓔ Ⓕ ⓐ ⓑ ⓒ ⓓ ⓔ ⓕ".split(" ") },
    { label: "그리스 대문자", chars: "Α Β Γ Δ Ε Ζ Η Θ Λ Π Σ Φ Ψ Ω".split(" ") },
    { label: "그리스 소문자", chars: "α β γ δ ε θ λ μ π ρ σ τ φ ω".split(" ") },
    { label: "수학 연산", chars: "√ ± × ÷ ≠ ≤ ≥ ≈ ∞ ∑ ∏ ∫ ∂ ∴ ∵".split(" ") },
    { label: "위첨자(지수)", chars: "⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ⁿ".split(" ") },
    { label: "아래첨자", chars: "₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ₊ ₋".split(" ") },
    { label: "분수", chars: "½ ⅓ ⅔ ¼ ¾ ⅕ ⅙ ⅛".split(" ") },
    { label: "단위·온도", chars: "° ′ ″ ℃ ㎡ ㎥ ㎜ ㎝ ㎞ ㎏ ㏊".split(" ") },
    { label: "화살표", chars: "→ ← ↑ ↓ ⇒ ⇐ ↔".split(" ") },
    { label: "기타", chars: "§ ¶ • ‰ ※ ∈ ∉ ⊂ ⊃ ∪ ∩ ∀ ∃".split(" ") },
  ];
  let symbolPanelTarget = null;
  let symbolPanelOpen = false;
  const renderSymbolPanel = ()=>{
    const host = overlay.querySelector("#symbolPanelHost");
    if(!symbolPanelOpen){ host.innerHTML = ""; return; }
    host.innerHTML = `
      <div class="symbol-panel">
        <div class="symbol-panel-head">
          <b>기호 삽입</b> <small style="color:var(--muted);">누르면 "${symbolPanelTarget==="editAnswer"?"정답":"문제"}" 커서 위치에 들어가요</small>
          <span class="symbol-panel-close" id="symbolPanelCloseBtn">✕</span>
        </div>
        ${SYMBOL_CATEGORIES.map(cat=>`
          <div class="symbol-cat">
            <div class="symbol-cat-label">${cat.label}</div>
            <div class="symbol-cat-chars">
              ${cat.chars.map(ch=>`<button type="button" class="symbol-btn" data-ch="${ch}">${ch}</button>`).join("")}
            </div>
          </div>`).join("")}
      </div>`;
    host.querySelector("#symbolPanelCloseBtn").addEventListener("click", ()=>{ symbolPanelOpen = false; renderSymbolPanel(); });
    host.querySelectorAll(".symbol-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const ta = overlay.querySelector("#"+symbolPanelTarget);
        insertAtCursor(ta, btn.dataset.ch);
      });
    });
  };
  overlay.querySelectorAll(".symbol-panel-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const target = btn.dataset.target;
      if(symbolPanelOpen && symbolPanelTarget === target){ symbolPanelOpen = false; }
      else { symbolPanelOpen = true; symbolPanelTarget = target; }
      renderSymbolPanel();
      if(symbolPanelOpen) overlay.querySelector("#symbolPanelHost").scrollIntoView({behavior:"smooth", block:"nearest"});
    });
  });

  overlay.querySelector("#editSave").addEventListener("click", ()=>{
    const qText = overlay.querySelector("#editQuestion").value.trim();
    const aText = overlay.querySelector("#editAnswer").value.trim();
    if(!qText || !aText){ alert("문제와 정답을 모두 입력해주세요."); return; }
    const qBoxOpen = (qText.match(/\{\{BOX\}\}/g)||[]).length;
    const qBoxClose = (qText.match(/\{\{\/BOX\}\}/g)||[]).length;
    if(qBoxOpen !== qBoxClose){ alert("박스 표시({{BOX}}/{{/BOX}}) 개수가 맞지 않습니다. 문제 내용을 확인해주세요."); return; }
    const aBoxOpen = (aText.match(/\{\{BOX\}\}/g)||[]).length;
    const aBoxClose = (aText.match(/\{\{\/BOX\}\}/g)||[]).length;
    if(aBoxOpen !== aBoxClose){ alert("박스 표시({{BOX}}/{{/BOX}}) 개수가 맞지 않습니다. 정답 내용을 확인해주세요."); return; }
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
    const editPayload = {question:qText, answer:aText, images:workingImages, tags:tagsArr, unitMajor:newUnitMajor, unitMinor:newUnitMinor};
    targets.forEach(tid=>{
      store.edits[tid] = editPayload;
    });
    const ok = saveStore();
    if(!ok) return; // 저장 실패 시 편집창을 닫지 않고 이미지를 줄여 재시도할 수 있게 유지
    close();
    toast(targets.length>1 ? `중복 문제 ${targets.length}개를 함께 수정했습니다` : "저장되었습니다");
    if(onSaved) onSaved();
    // 관리자라면, 이 수정을 전체 사용자 기본값으로도 적용할지 물어본다 (개인 수정은 이미 위에서 저장 완료됨)
    targets.forEach(tid=>{ maybeAskAdminPublish(tid, editPayload); });
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

/* ---- 이미지 자르기 도구 (드래그로 영역 선택 + 모서리/변 핸들로 다시 조정 가능) ---- */
function openCropTool(src, onApply){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay crop-overlay";
  overlay.innerHTML = `
    <div class="modal-box crop-box">
      <span class="close-x">✕</span>
      <h3>이미지 자르기</h3>
      <p style="font-size:0.78rem;color:var(--muted);">영역을 드래그해서 선택하고, 모서리·변의 동그란 점을 잡아 다시 조정할 수 있어요. 박스 안쪽을 드래그하면 통째로 옮겨져요.</p>
      <div class="crop-canvas-wrap" id="cropWrap">
        <img id="cropImg" src="${src}" draggable="false">
        <div class="crop-rect" id="cropRect">
          <div class="crop-handle nw" data-h="nw"></div>
          <div class="crop-handle n" data-h="n"></div>
          <div class="crop-handle ne" data-h="ne"></div>
          <div class="crop-handle w" data-h="w"></div>
          <div class="crop-handle e" data-h="e"></div>
          <div class="crop-handle sw" data-h="sw"></div>
          <div class="crop-handle s" data-h="s"></div>
          <div class="crop-handle se" data-h="se"></div>
        </div>
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
  const MIN_SIZE = 0.03; // 너무 작아지지 않도록 최소 크기(비율)
  let rect = {x:0.05, y:0.05, w:0.9, h:0.9};
  const drawRect = ()=>{
    // CSS %는 부모(wrap)의 "보이는" 높이(max-height:60vh로 잘려 있음) 기준으로 계산되기 때문에,
    // 화면보다 세로로 긴 이미지에서는 선택 박스가 그 잘린 지점 아래로는 아예 그려지지도 않는
    // 문제가 있었다. 대신 이미지 자체의 실제 렌더링 픽셀 크기(imgEl.offsetWidth/Height)를
    // 기준으로 px 단위로 직접 계산하면, 스크롤 가능한 전체 영역에 정확히 걸쳐서 그려진다.
    const w = imgEl.offsetWidth, h = imgEl.offsetHeight;
    rectEl.style.left = (rect.x*w)+"px";
    rectEl.style.top = (rect.y*h)+"px";
    rectEl.style.width = (rect.w*w)+"px";
    rectEl.style.height = (rect.h*h)+"px";
  };
  imgEl.addEventListener("load", drawRect);
  drawRect();

  // 좌표는 wrap(보이는 영역)이 아니라 imgEl(이미지 자체)의 실제 렌더링 크기를 기준으로 계산한다.
  // 세로로 긴 이미지가 wrap의 max-height(60vh)를 넘어 overflow로 잘려 보일 때, wrap 기준으로
  // 계산하면 "보이는 부분"만을 이미지 전체인 것처럼 착각해서 선택 영역이 크게 어긋나는 문제가 있었음
  // (특히 좁은 화면일수록 이미지가 상대적으로 더 길게 렌더링되어 잘 드러남).
  const ptFromEvent = (e)=>{
    const r = imgEl.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    return { x: Math.min(Math.max((cx-r.left)/r.width,0),1), y: Math.min(Math.max((cy-r.top)/r.height,0),1) };
  };

  // mode: null(없음) | "new"(새로 그리기) | "move"(박스 이동) | "nw"/"n"/"ne"/"w"/"e"/"sw"/"s"/"se"(핸들 리사이즈)
  let mode = null;
  let startPt = null;
  let startRect = null;

  const onDown = (e)=>{
    const handle = e.target.closest && e.target.closest(".crop-handle");
    const isTouch = e.type.startsWith("touch");
    startPt = ptFromEvent(e);
    startRect = {...rect};
    if(handle){
      mode = handle.dataset.h;
    } else if(e.target === rectEl){
      mode = "move";
    } else if(isTouch){
      // 터치에서는 박스 바깥(어두운 영역)을 누르면 세로 스크롤로 취급해서 그대로 흘려보낸다.
      // (긴 이미지를 손가락으로 내려서 아래쪽도 볼 수 있어야 하므로, 여기서 새 박스를 시작하면
      // 스크롤 제스처와 충돌한다. 새로 그리고 싶으면 '전체 선택' 후 핸들로 조정하면 됨)
      return;
    } else {
      // 마우스: 박스 바깥을 누르면 그 지점부터 새로 그리기 시작
      mode = "new";
      rect = {x:startPt.x, y:startPt.y, w:0, h:0};
      drawRect();
    }
    e.preventDefault && e.preventDefault();
  };

  const onMove = (e)=>{
    if(!mode) return;
    const p = ptFromEvent(e);
    const dx = p.x - startPt.x, dy = p.y - startPt.y;

    if(mode === "new"){
      rect.x = Math.min(startPt.x, p.x); rect.y = Math.min(startPt.y, p.y);
      rect.w = Math.abs(p.x-startPt.x); rect.h = Math.abs(p.y-startPt.y);
    } else if(mode === "move"){
      const w = startRect.w, h = startRect.h;
      rect.x = Math.min(Math.max(startRect.x + dx, 0), 1 - w);
      rect.y = Math.min(Math.max(startRect.y + dy, 0), 1 - h);
      rect.w = w; rect.h = h;
    } else {
      // 핸들 리사이즈: 반대쪽 변/모서리는 고정한 채 잡은 쪽만 움직인다
      let {x, y, w, h} = startRect;
      const right = x + w, bottom = y + h;
      if(mode.includes("w")){ x = Math.min(Math.max(startRect.x + dx, 0), right - MIN_SIZE); w = right - x; }
      if(mode.includes("e")){ w = Math.min(Math.max(startRect.w + dx, MIN_SIZE), 1 - x); }
      if(mode.includes("n")){ y = Math.min(Math.max(startRect.y + dy, 0), bottom - MIN_SIZE); h = bottom - y; }
      if(mode.includes("s")){ h = Math.min(Math.max(startRect.h + dy, MIN_SIZE), 1 - y); }
      rect = {x, y, w, h};
    }
    drawRect();
  };
  const onUp = ()=>{ mode = null; };

  wrap.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  wrap.addEventListener("touchstart", onDown, {passive:false});
  window.addEventListener("touchmove", onMove, {passive:false});
  window.addEventListener("touchend", onUp);

  const close = ()=>{
    wrap.removeEventListener("mousedown", onDown);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    wrap.removeEventListener("touchstart", onDown);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
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
  const studyNavBarEl = document.getElementById("studyNavBar");
  if(studyNavBarEl) studyNavBarEl.style.display = (state.view==="card") ? "block" : "none";
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

/* ---- 문제 화면 키보드 단축키: Ctrl+←/→ 이전·다음 문제, Ctrl+Space 정답 보기/가리기 ----
   방향키 자체는 텍스트 입력창(키보드 연습장 등)에서 커서 이동에 계속 쓰이므로,
   Ctrl(또는 Cmd, 맥 대응)을 함께 눌러야만 반응하게 해서 일반 타이핑과 안 겹치게 했다. */
document.addEventListener("keydown", (e)=>{
  if(state.view !== "card") return;
  const ctrl = e.ctrlKey || e.metaKey;
  if(!ctrl) return;
  if(e.key === "ArrowLeft"){
    e.preventDefault();
    if(state.idx > 0) goToCard(state.idx-1);
  } else if(e.key === "ArrowRight"){
    e.preventDefault();
    if(state.idx < state.queue.length-1) goToCard(state.idx+1);
  } else if(e.key === " " || e.code === "Space"){
    e.preventDefault();
    const q = state.queue[state.idx];
    if(q) toggleAnswerVisibility(q);
  }
});

/* ---- 관리자 대시보드 등 외부에서 특정 문제로 바로 이동(딥링크): ?q=문제ID ---- */
(function(){
  try{
    const qid = new URLSearchParams(location.search).get("q");
    if(!qid){ render(); return; }
    const target = getData().find(x => String(x.id) === qid);
    if(target){
      startQueue([target], "single", "바로가기", "home");
      // URL은 정리해서, 뒤로가기/새로고침 시 계속 이 한 문제만 뜨지 않게 함
      history.replaceState(null, "", location.pathname);
      return; // 이미 startQueue 안에서 renderCard()까지 호출됨
    }
  }catch(e){ console.warn("문제 딥링크 처리 실패:", e); }
  render();
})();

/* ---- 새 버전 자동 감지: GitHub Pages/브라우저 캐시 때문에 배포 직후에도 옛날 화면이
   계속 보이는 문제를 줄이기 위해, 주기적으로 캐시를 건너뛰고 실제 버전이 들어있는
   assets/app.js 파일을 다시 받아와 APP_VERSION을 비교한다. 다르면 화면 하단에 배너를
   띄우고, 누르면 캐시 무시하고 새로고침한다.
   ⚠️ 예전 버전은 location.pathname(=이 HTML 페이지 자체)을 다시 받아와서 그 안에서
   APP_VERSION을 찾았는데, APP_VERSION은 HTML이 아니라 <script src="assets/app.js">로
   불러오는 외부 파일 안에만 있어서 정규식이 절대 매칭되지 않는 버그가 있었다(그래서
   이 배너가 사실상 한 번도 뜬 적이 없었음). 실제로 <script> 태그가 가리키는 app.js
   경로를 그대로 읽어서 그 파일 내용을 검사하도록 수정했다. ---- */
(function(){
  function appJsSrc(){
    const tag = document.querySelector('script[src*="assets/app.js"]');
    if(!tag) return null;
    return tag.getAttribute("src").split("?")[0]; // 기존 ?v=해시는 떼고, 아래서 캐시무효화용 쿼리를 새로 붙인다
  }
  function forceReload(){
    const url = new URL(location.href);
    url.searchParams.set("v", Date.now());
    location.href = url.toString();
  }
  async function checkForNewVersion(){
    try{
      const src = appJsSrc();
      if(!src) return;
      const res = await fetch(src + "?_check=" + Date.now(), { cache: "no-store" });
      if(!res.ok) return;
      const text = await res.text();
      const vMatch = text.match(/const APP_VERSION = "([^"]*)"/);
      const fMatch = text.match(/const FORCE_UPDATE_MIN_VERSION = "([^"]*)"/);
      const remoteVersion = vMatch && vMatch[1];
      const forceMinVersion = fMatch && fMatch[1];
      if(!remoteVersion || remoteVersion === APP_VERSION) return;
      // 이 배포 이전 버전을 쓰는 클라이언트에게 필수 업데이트가 걸려 있는 경우 강제 새로고침
      if(forceMinVersion && APP_VERSION < forceMinVersion){
        showUpdateBanner(true);
      } else {
        showUpdateBanner(false);
      }
    }catch(e){ /* 오프라인 등은 조용히 무시 */ }
  }
  function showUpdateBanner(critical){
    const existing = document.getElementById("versionUpdateBanner");
    if(existing){
      if(critical && !existing.classList.contains("vub-critical")) existing.remove();
      else return;
    }
    const bar = document.createElement("div");
    bar.id = "versionUpdateBanner";
    bar.className = "version-update-banner" + (critical ? " vub-critical" : "");
    if(critical){
      let secondsLeft = 8;
      bar.innerHTML = `<span class="vub-text">⚠️ 중요 업데이트가 있어 <b class="vub-countdown">${secondsLeft}</b>초 후 자동으로 새로고침됩니다</span>`;
      const countdownEl = bar.querySelector(".vub-countdown");
      const timer = setInterval(()=>{
        secondsLeft -= 1;
        if(secondsLeft <= 0){
          clearInterval(timer);
          forceReload();
          return;
        }
        if(countdownEl) countdownEl.textContent = String(secondsLeft);
      }, 1000);
      // 치명적 업데이트는 닫기 버튼을 두지 않는다(닫아도 다음 재확인 때 다시 뜨고,
      // 그 사이 옛날 데이터로 조작을 계속하면 DB와 충돌할 수 있는 상황을 막기 위함).
    } else {
      bar.innerHTML = `<span class="vub-text">🔄 새 버전이 있어요 · 탭해서 새로고침</span><span class="vub-close">✕</span>`;
      bar.querySelector(".vub-text").addEventListener("click", forceReload);
      bar.querySelector(".vub-close").addEventListener("click", (e)=>{
        e.stopPropagation();
        bar.remove();
      });
    }
    document.body.appendChild(bar);
  }
  setTimeout(checkForNewVersion, 4000); // 앱 켤 때 1차 확인
  setInterval(checkForNewVersion, 5 * 60 * 1000); // 켜둔 채로 오래 쓰는 경우를 위해 5분마다 재확인
  document.addEventListener("visibilitychange", ()=>{
    // 백그라운드에 있던 앱(특히 홈 화면에 추가한 PWA)을 다시 열었을 때 즉시 재확인
    if(document.visibilityState === "visible") checkForNewVersion();
  });
})();
