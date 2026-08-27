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
            alert('이미 이 사이트의 다른 자격증 앱을 설치하셨다면, 크롬이 "이미 설치된 앱의 일부"로 인식해서 자동 설치 팝업을 안 띄운 것일 수 있어요.\n\n→ 브라우저 메뉴(⋮) → "홈 화면에 추가" 또는 "앱 설치"를 눌러 수동으로 설치해보세요.\n\n팁: My도전 허브(범위가 가장 넓음)는 다른 자격증들을 먼저 설치한 뒤 맨 마지막에 설치하시면 이 문제를 피할 수 있어요.');
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

async function fetchProfile(userId) {
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("nickname")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.nickname : null;
  } catch (e) {
    console.warn("닉네임을 불러오지 못했습니다:", e.message);
    return null;
  }
}

function openNicknameModal(currentNickname, onSaved) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h2 class="modal-title">${currentNickname ? "닉네임 변경" : "닉네임 설정"}</h2>
      <p class="modal-desc">랭킹과 오답의견에 이 닉네임으로 표시돼요. 이메일은 공개되지 않아요.</p>
      <input type="text" class="login-input" id="nicknameInput" maxlength="20" placeholder="예: 열공하는건축가" value="${currentNickname ? escapeHtml(currentNickname) : ""}">
      <p class="login-status err" id="nicknameStatus" style="min-height:auto;"></p>
      <div class="modal-actions">
        <button type="button" class="logout-btn" id="nicknameCancelBtn">취소</button>
        <button type="button" class="login-btn" id="nicknameSaveBtn" style="width:auto;padding:10px 18px;">저장</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("nicknameCancelBtn").addEventListener("click", close);
  document.getElementById("nicknameSaveBtn").addEventListener("click", async () => {
    const input = document.getElementById("nicknameInput");
    const status = document.getElementById("nicknameStatus");
    const nickname = input.value.trim();
    if (!nickname) { status.textContent = "닉네임을 입력해주세요."; return; }
    if (nickname.length < 2) { status.textContent = "2글자 이상 입력해주세요."; return; }
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { status.textContent = "로그인이 필요해요."; return; }
    const { error } = await supabaseClient.from("profiles").upsert(
      { user_id: session.user.id, nickname, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) {
      status.textContent = /duplicate|unique/i.test(error.message)
        ? "이미 다른 사람이 쓰고 있는 닉네임이에요."
        : "저장 실패: " + error.message;
      return;
    }
    close();
    if (onSaved) onSaved(nickname);
  });
}

async function renderHub(session) {
  const user = session.user;
  const [progressMap, isAdmin, nickname] = await Promise.all([
    fetchProgressMap(user.id),
    checkIsAdmin(user.id),
    fetchProfile(user.id),
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
          <span>
            로그인: <span class="email">${escapeHtml(user.email)}</span>
            ${nickname
              ? ` · 닉네임: <b>${escapeHtml(nickname)}</b> <button type="button" class="nickname-edit-link" id="nicknameEditBtn">변경</button>`
              : ` · <button type="button" class="nickname-edit-link" id="nicknameEditBtn">🙋 닉네임 설정하기</button>`}
          </span>
          <div class="hub-user-actions">
            <a class="admin-link-btn" href="ranking.html" style="background:var(--teal);">🏆 랭킹</a>
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
  document.getElementById("nicknameEditBtn").addEventListener("click", () => {
    openNicknameModal(nickname, () => renderHub(session));
  });
  bindHubInstallBtn();
}

function renderLogin(statusMsg, statusType, mode) {
  mode = mode === "signup" ? "signup" : "login";
  const isSignup = mode === "signup";
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
        <div class="login-mode-tabs">
          <button type="button" class="login-mode-tab ${!isSignup ? "active" : ""}" data-mode="login">로그인</button>
          <button type="button" class="login-mode-tab ${isSignup ? "active" : ""}" data-mode="signup">회원가입</button>
        </div>
        <p class="login-desc">${
          isSignup
            ? "이메일과 비밀번호로 가입해주세요.<br>최초 1회만 이메일 인증이 필요하고, 이후엔 이메일 없이 비밀번호로 바로 로그인돼요."
            : "가입하신 이메일과 비밀번호로 로그인하세요."
        }</p>
        <form id="authForm">
          <input type="email" class="login-input" id="emailInput" placeholder="you@example.com" required autocomplete="email">
          <input type="password" class="login-input" id="passwordInput" placeholder="비밀번호 (6자 이상)" required minlength="6" autocomplete="${isSignup ? "new-password" : "current-password"}">
          ${isSignup ? `<input type="password" class="login-input" id="passwordConfirmInput" placeholder="비밀번호 확인" required minlength="6" autocomplete="new-password">` : ""}
          <button type="submit" class="login-btn" id="authBtn">${isSignup ? "가입하고 인증 메일 받기" : "로그인"}</button>
        </form>
        <p class="login-status ${statusType || ""}" id="loginStatus">${statusMsg || ""}</p>
      </div>
    </div>`;

  bindHubInstallBtn();
  document.querySelectorAll(".login-mode-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => renderLogin(null, null, tabBtn.dataset.mode));
  });

  document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const btn = document.getElementById("authBtn");
    const status = document.getElementById("loginStatus");
    btn.disabled = true;
    status.className = "login-status";

    if (isSignup) {
      const passwordConfirm = document.getElementById("passwordConfirmInput").value;
      if (password !== passwordConfirm) {
        status.textContent = "비밀번호가 서로 달라요.";
        status.className = "login-status err";
        btn.disabled = false;
        return;
      }
      status.textContent = "가입 처리 중...";
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw error;
        // Supabase의 알려진 신호: 이미 가입(인증 완료)된 이메일로 signUp을 다시 호출하면
        // 에러 없이 성공 응답이 오지만 data.user.identities가 빈 배열로 온다(사용자 존재 여부를
        // 외부에 노출하지 않기 위한 설계). 이 경우 실제로는 인증 메일이 발송되지 않고, 대신
        // 방금 입력한 비밀번호가 그 기존 계정에 설정된다 — 바로 로그인하면 된다.
        const alreadyExists = data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (alreadyExists) {
          status.textContent = `이미 가입되어 있는 이메일이에요. 인증 메일은 따로 가지 않아요 — 방금 입력하신 비밀번호가 그 계정에 저장됐으니, "로그인" 탭에서 바로 로그인해보세요.`;
          status.className = "login-status ok";
        } else {
          status.textContent = `${email} 주소로 인증 메일을 보냈어요. 메일함(스팸함도 확인!)에서 인증 링크를 눌러주시면, 그 다음부턴 이메일 없이 비밀번호로 바로 로그인할 수 있어요.`;
          status.className = "login-status ok";
        }
      } catch (err) {
        const isRateLimit = /rate limit/i.test(err.message);
        status.textContent = isRateLimit
          ? "메일 발송 요청이 너무 잦아서 잠시 제한됐어요(보통 시간당 몇 통 수준). 1시간 정도 뒤에 다시 시도해주세요."
          : "가입 실패: " + err.message;
        status.className = "login-status err";
      } finally {
        btn.disabled = false;
      }
    } else {
      status.textContent = "로그인 중...";
      try {
        const next = new URLSearchParams(window.location.search).get("next");
        if (next) sessionStorage.setItem("loginNext", next);
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // 성공하면 아래 onAuthStateChange(SIGNED_IN)가 자동으로 목록 화면(또는 next 자격증)으로 이동시킴
      } catch (err) {
        const isBadCreds = /invalid login credentials/i.test(err.message);
        status.textContent = isBadCreds
          ? "이메일 또는 비밀번호가 올바르지 않아요. (가입 시 인증 이메일을 확인하셨는지도 확인해주세요)"
          : "로그인 실패: " + err.message;
        status.className = "login-status err";
        btn.disabled = false;
      }
    }
  });
}

function nextCertPath(explicitNext) {
  const next = explicitNext !== undefined ? explicitNext : new URLSearchParams(window.location.search).get("next");
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

// ============ 로그인 링크 "확인 클릭"으로 완료하기 ============
// 이메일 클라이언트/보안 스캐너가 링크를 미리 열어봐서 원-타임 토큰을 먼저 소모해버리면
// 정작 사용자가 눌렀을 때는 '만료됨' 오류가 뜨는 문제가 자주 발생한다(Gmail, Outlook 등에서
// 흔히 보고되는 현상). 이를 막기 위해 이메일의 링크는 곧바로 로그인시키지 않고, 이 페이지에서
// "로그인 완료하기" 버튼을 사람이 직접 눌러야만 실제 토큰 소모(verifyOtp)가 일어나도록 만든다.
// 스캐너는 페이지를 열어만 볼 뿐 버튼을 누르지 않으므로 토큰이 보존된다.
// ※ 이 기능이 동작하려면 Supabase 대시보드의 매직 링크 이메일 템플릿도 함께 바꿔야 한다.
//   (docs/PROJECT_GUIDE.md 참고)
function getTokenHashParams() {
  const params = new URLSearchParams(window.location.search);
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  if (token_hash && type) return { token_hash, type };
  return null;
}

function renderConfirm(tokenHashParams) {
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">자격증 학습노트</span>
      </div>
    </header>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">로그인 계속하기</h1>
        <p class="login-desc">이메일 링크를 눌러 여기까지 오셨어요.<br>아래 버튼을 한 번 더 눌러야 로그인이 완료돼요.<br>(이메일 앱이 미리 열어봐서 토큰이 먼저 소모되는 걸 막기 위한 절차예요)</p>
        <button type="button" class="login-btn" id="confirmLoginBtn">로그인 완료하기</button>
        <p class="login-status" id="confirmStatus"></p>
      </div>
    </div>`;

  document.getElementById("confirmLoginBtn").addEventListener("click", async () => {
    const btn = document.getElementById("confirmLoginBtn");
    const status = document.getElementById("confirmStatus");
    btn.disabled = true;
    status.textContent = "로그인 처리 중...";
    status.className = "login-status";
    const { error } = await supabaseClient.auth.verifyOtp(tokenHashParams);
    const pendingNext = sessionStorage.getItem("loginNext");
    sessionStorage.removeItem("loginNext");
    if (error) {
      history.replaceState(null, "", window.location.pathname);
      status.textContent = "로그인 링크가 만료됐거나 이미 사용됐어요. 아래에서 새로 요청해주세요.";
      status.className = "login-status err";
      btn.disabled = false;
      setTimeout(() => renderLogin(status.textContent, "err"), 1500);
      return;
    }
    const path = nextCertPath(pendingNext);
    if (path) {
      window.location.href = path;
    } else {
      history.replaceState(null, "", window.location.pathname);
      // 세션이 생겼으므로 아래 onAuthStateChange(SIGNED_IN)가 자동으로 목록 화면을 그려준다
    }
  });
}

// Supabase가 매직링크 오류 시 URL 해시에 실어 보내는 정보(#error=access_denied&error_code=otp_expired...)를
// 읽어서 친절한 한글 안내로 바꿔준다. 원래는 아무 안내 없이 빈 화면만 보이는 문제가 있었음.
function parseAuthErrorFromUrl() {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const error = params.get("error");
  if (!error) return null;
  const errorCode = params.get("error_code");
  // 새로고침하거나 다시 방문해도 같은 오류가 재생되지 않도록 주소창의 해시를 정리
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (errorCode === "otp_expired") {
    return "로그인 링크가 만료됐어요. 아래에 이메일을 다시 입력해서 새 링크를 받아주세요.";
  }
  return "로그인 링크가 유효하지 않아요. 아래에 이메일을 다시 입력해서 새 링크를 받아주세요.";
}

async function boot() {
  const tokenHashParams = getTokenHashParams();
  if (tokenHashParams) {
    renderConfirm(tokenHashParams);
    return;
  }
  const authError = parseAuthErrorFromUrl();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    if (goToNextIfAny()) return;
    renderHub(session);
  } else {
    renderLogin(authError, authError ? "err" : undefined);
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
