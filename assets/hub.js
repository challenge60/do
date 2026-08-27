// 허브 페이지 로직: 로그인 화면 ↔ 자격증 목록 화면 전환, 자격증별 진행률 표시.

const root = document.getElementById("root");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ============ PWA 설치("My도전" 허브 자체를 홈 화면 앱으로) ============
   각 자격증 페이지(engine/app.js)와 완전히 별개의 PWA로 설치되도록, id/scope를
   허브 경로("/") 기준으로 잡는다. 자격증별 앱과 이름·아이콘이 겹치지 않는다. */
try{
  (function(){
    function buildHubIcon(size){
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0f3d3e';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#d98e3f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(size * 0.22) + 'px sans-serif';
      ctx.fillText('My도전', size / 2, size * 0.42);
      ctx.font = 'bold ' + Math.round(size * 0.13) + 'px sans-serif';
      ctx.fillStyle = '#f4ede0';
      ctx.fillText('학습노트', size / 2, size * 0.66);
      return c.toDataURL('image/png');
    }

    try{
      const icon192 = buildHubIcon(192);
      const icon512 = buildHubIcon(512);
      const manifest = {
        id: location.pathname.replace(/[^/]*$/, ''),
        name: "My도전 자격증 학습노트",
        short_name: "My도전",
        start_url: location.origin + location.pathname,
        scope: location.origin + location.pathname.replace(/[^/]*$/, ''),
        display: "standalone",
        orientation: "portrait",
        background_color: "#faf7f0",
        theme_color: "#243c3d",
        icons: [
          { src: icon192, sizes: "192x192", type: "image/png" },
          { src: icon512, sizes: "512x512", type: "image/png" },
          { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
      let manifestLink = document.querySelector('link[rel="manifest"]');
      if(!manifestLink){
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = URL.createObjectURL(manifestBlob);
    }catch(e){ /* 매니페스트 생성 실패 시 무시 */ }

    if('serviceWorker' in navigator){
      try{
        const swCode = "self.addEventListener('install',e=>self.skipWaiting());" +
                       "self.addEventListener('activate',e=>self.clients.claim());" +
                       "self.addEventListener('fetch',e=>{});";
        const swBlob = new Blob([swCode], { type: 'application/javascript' });
        navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(()=>{});
      }catch(e){}
    }

    let isStandalone, isIOS, deferredPrompt = null;
    try {
      isStandalone = (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
      isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    } catch(e) { isStandalone = true; isIOS = false; }

    window.__hubPwa = { isStandalone, isIOS };

    if(!isStandalone){
      if(isIOS){
        window.__hubPwa.onInstallClick = function(){
          alert('Safari 하단 공유 버튼(⬆️)을 누른 뒤\n"홈 화면에 추가"를 선택하면 앱처럼 설치돼요.');
        };
      } else {
        window.addEventListener('beforeinstallprompt', function(e){
          e.preventDefault();
          deferredPrompt = e;
          const btn = document.getElementById('hubInstallBtn');
          if(btn) btn.style.display = 'inline-flex';
        });
        window.__hubPwa.onInstallClick = async function(){
          const btn = document.getElementById('hubInstallBtn');
          if(deferredPrompt){
            if(btn) btn.disabled = true;
            deferredPrompt.prompt();
            try{ await deferredPrompt.userChoice; }catch(e){}
            deferredPrompt = null;
            if(btn){ btn.style.display = 'none'; btn.disabled = false; }
          } else {
            alert('브라우저 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"를 눌러도 똑같이 설치할 수 있어요.');
          }
        };
        window.addEventListener('appinstalled', function(){
          const btn = document.getElementById('hubInstallBtn');
          if(btn) btn.style.display = 'none';
          deferredPrompt = null;
        });
      }
    }
  })();
}catch(e){ console.warn("허브 PWA 설치 기능 초기화 실패:", e); }

function bindHubInstallBtn(){
  const btn = document.getElementById('hubInstallBtn');
  if(!btn || !window.__hubPwa || window.__hubPwa.isStandalone) return;
  btn.style.display = 'inline-flex';
  if(window.__hubPwa.isIOS) btn.textContent = '📲 홈 화면에 추가';
  btn.addEventListener('click', () => { if(window.__hubPwa.onInstallClick) window.__hubPwa.onInstallClick(); });
  // beforeinstallprompt가 안 와도(다른 자격증을 먼저 설치해 크롬이 잠시 억제 중인 경우 등) 버튼은 보여준다
  setTimeout(() => { if(btn.style.display !== 'none') btn.style.display = 'inline-flex'; }, 2500);
}

function stampRing(pct, done) {
  const r = 24, c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return `
    <div class="stamp-ring${done ? " is-complete" : ""}">
      <svg viewBox="0 0 56 56" width="56" height="56">
        <circle class="stamp-track" cx="28" cy="28" r="${r}"></circle>
        <circle class="stamp-fill" cx="28" cy="28" r="${r}"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <span class="stamp-pct">${Math.round(pct)}%</span>
    </div>`;
}

async function fetchProgressMap(userId) {
  const map = {};
  try {
    const { data, error } = await supabaseClient
      .from("user_progress")
      .select("cert_id,data")
      .eq("user_id", userId);
    if (error) throw error;
    (data || []).forEach((row) => { map[row.cert_id] = row.data; });
  } catch (e) {
    console.warn("진행률을 불러오지 못했습니다:", e.message);
  }
  return map;
}

function computeStats(certProgress, questionCount) {
  const solved = certProgress && certProgress.progress ? Object.keys(certProgress.progress).length : 0;
  const pct = questionCount ? Math.min(100, (solved / questionCount) * 100) : 0;
  const solvedTotal = (certProgress && certProgress.solvedTotal) || 0;
  const correctTotal = (certProgress && certProgress.correctTotal) || 0;
  const acc = solvedTotal ? Math.round((correctTotal / solvedTotal) * 100) : null;
  return { solved, pct, acc };
}

async function checkIsAdmin(userId) {
  try {
    const { data, error } = await supabaseClient
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    console.warn("관리자 여부 확인 실패:", e.message);
    return false;
  }
}

async function renderHub(session) {
  const user = session.user;
  const [progressMap, isAdmin] = await Promise.all([
    fetchProgressMap(user.id),
    checkIsAdmin(user.id),
  ]);

  const cards = CERTS_REGISTRY.map((cert) => {
    const { solved, pct, acc } = computeStats(progressMap[cert.id], cert.questionCount);
    const metaLine = `${escapeHtml(cert.subtitle)} · 진도 ${solved}/${cert.questionCount.toLocaleString()}문항`
      + (acc !== null ? ` · 정답률 ${acc}%` : "");
    return `
      <a class="ticket" href="${escapeHtml(cert.path)}">
        ${stampRing(pct, pct >= 100)}
        <div class="ticket-body">
          <p class="ticket-name">${escapeHtml(cert.name)}</p>
          <p class="ticket-subtitle">${metaLine}</p>
          <p class="ticket-cta">${pct > 0 ? "이어서 학습 →" : "학습 시작 →"}</p>
        </div>
      </a>`;
  }).join("");

  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">자격증 학습노트</span>
        <button type="button" class="hub-install-btn" id="hubInstallBtn" style="display:none;">📲 앱 설치</button>
      </div>
    </header>
    <div class="wrap">
      <header class="hub-header">
        <p class="eyebrow">Study Ledger</p>
        <p class="hub-desc">기록은 이 계정에 저장되어, 어떤 기기·브라우저에서 로그인해도 이어서 학습할 수 있어요.</p>
        <div class="hub-user-row">
          <span>로그인: <span class="email">${escapeHtml(user.email)}</span></span>
          <div class="hub-user-actions">
            ${isAdmin ? `<a class="admin-link-btn" href="admin.html">🛠 관리자</a>` : ""}
            <button class="logout-btn" id="logoutBtn">로그아웃</button>
          </div>
        </div>
      </header>
      <div class="cert-grid">
        ${cards}
        <div class="ticket ghost">
          <div class="stamp-ring"><span class="stamp-pct" style="color:var(--muted)">+</span></div>
          <div class="ticket-body">
            <p class="ticket-name">다음 자격증 준비 중</p>
            <p class="ticket-subtitle">추가되는 대로 여기에 나타나요</p>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
  bindHubInstallBtn();
}

function renderLogin(statusMsg, statusType) {
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">자격증 학습노트</span>
        <button type="button" class="hub-install-btn" id="hubInstallBtn" style="display:none;">📲 앱 설치</button>
      </div>
    </header>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">My도전 자격증 학습노트</h1>
        <p class="login-desc">이메일로 로그인 링크를 보내드려요.<br>비밀번호 없이 링크만 누르면 바로 접속돼요.</p>
        <form id="loginForm">
          <input type="email" class="login-input" id="emailInput" placeholder="you@example.com" required autocomplete="email">
          <button type="submit" class="login-btn" id="loginBtn">로그인 링크 보내기</button>
        </form>
        <p class="login-status ${statusType || ""}" id="loginStatus">${statusMsg || ""}</p>
      </div>
    </div>`;

  bindHubInstallBtn();
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput").value.trim();
    const btn = document.getElementById("loginBtn");
    const status = document.getElementById("loginStatus");
    if (!email) return;
    btn.disabled = true;
    status.textContent = "링크를 보내는 중...";
    status.className = "login-status";
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href.split("#")[0] },
      });
      if (error) throw error;
      status.textContent = `${email} 주소로 로그인 링크를 보냈어요. 메일함을 확인해주세요.`;
      status.className = "login-status ok";
    } catch (err) {
      status.textContent = "링크 전송에 실패했어요: " + err.message;
      status.className = "login-status err";
      btn.disabled = false;
    }
  });
}

function nextCertPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) return null;
  const cert = CERTS_REGISTRY.find((c) => c.id === next);
  return cert ? cert.path : null;
}

function goToNextIfAny() {
  const path = nextCertPath();
  if (path) {
    window.location.href = path;
    return true;
  }
  return false;
}

async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    if (goToNextIfAny()) return;
    renderHub(session);
  } else {
    renderLogin();
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session) {
    if (goToNextIfAny()) return;
    renderHub(session);
  } else if (event === "SIGNED_OUT") {
    renderLogin();
  }
});

boot();
