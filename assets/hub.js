// 허브 페이지 로직: 로그인 화면 ↔ 자격증 목록 화면 전환, 자격증별 진행률 표시.

const root = document.getElementById("root");

// 회원가입 처리 도중(signUp 호출 ~ profiles.upsert로 approved:false 저장 완료까지)에는
// 전역 onAuthStateChange(SIGNED_IN) 리스너가 끼어들지 못하게 막는 플래그.
// signUp()이 세션을 만들자마자 SIGNED_IN 이벤트가 곧바로 발생할 수 있는데, 이게 뒤이어
// 실행되는 profiles.upsert({approved:false})보다 먼저 끝나버리면 프로필이 아직 DB에
// 없는 찰나에 승인 여부를 확인하게 되어(레이스 컨디션) "미승인" 계정이 순간적으로
// 허브 화면(및 그 뒤 자격증 화면)에 들어가버리는 사고가 있었다. 가입 흐름은 이 플래그로
// 리스너를 잠가두고, 저장이 다 끝난 뒤 직접 화면을 그려서 안전하게 처리한다.
let signupInFlight = false;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ============ 짧은 공유 링크 처리: ?q=<shortCode>-<문항ID> ============
   예: challenge60.github.io/do/?q=a-2026-1-11 → certs/arch-siljak/index.html?q=2026-1-11 로 이동
   외부 단축 서비스(is.gd 등)에 기대지 않고, 허브 자체 주소만으로 짧은 링크를 만들기 위함.
   shortCode는 assets/certs-registry.js에 자격증별로 지정되어 있음(a/b/c).
   반환값 true면 리다이렉트를 시작한 것이므로, 호출한 쪽에서 boot()를 생략해야 함. */
function handleShortDeepLinkIfAny() {
  const qParam = new URLSearchParams(location.search).get("q");
  if (!qParam) return false;
  const dashIdx = qParam.indexOf("-");
  if (dashIdx === -1) return false;
  const shortCode = qParam.slice(0, dashIdx);
  const questionId = qParam.slice(dashIdx + 1);
  const cert = (typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : []).find((c) => c.shortCode === shortCode);
  if (!cert) return false;
  window.location.replace(`${cert.path}?q=${encodeURIComponent(questionId)}`);
  return true;
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
        name: "My도전 Note",
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
      .select("nickname, approved, role, editor_certs")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    // 프로필 자체가 없는 사용자(이 기능이 생기기 전 가입자 등)는 승인 게이트가 없던 시절
    // 가입한 사람이므로 차단하지 않는다. approved는 프로필이 있을 때만 의미를 가짐.
    return {
      nickname: data ? data.nickname : null,
      approved: data ? data.approved : true,
      role: data ? data.role : null,
      editorCerts: (data && data.editor_certs) || [],
    };
  } catch (e) {
    console.warn("프로필을 불러오지 못했습니다:", e.message);
    return { nickname: null, approved: true, role: null, editorCerts: [] };
  }
}

// 자격증별 상태 접근 제어.
// - "open"(기본값, 필드 생략 시): 누구나 정상 이용
// - "maintenance": 점검 중 — 일반 사용자는 안내만 보고, 관리자/해당 종목 편집자는 그대로 이용(백업/수정 작업용)
// - "coming_soon": 준비 중 — 일반 사용자는 안내만 보고, 관리자/해당 종목 편집자는 데이터 작업을 위해 그대로 이용
function canBypassCertStatus(cert, isAdmin, profile) {
  if (isAdmin || profile.role === "admin") return true;
  if (profile.role === "editor" && (profile.editorCerts || []).includes(cert.id)) return true;
  return false;
}

const CERT_STATUS_LABEL = {
  maintenance: { badge: "🛠 점검 중", alertMsg: "지금 점검 중입니다. 잠시 후 다시 이용해주세요." },
  coming_soon: { badge: "🚧 준비 중", alertMsg: "아직 준비 중인 자격증이에요. 곧 만나요!" },
};

function openNicknameModal(currentNickname, onSaved, extraFields) {
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
      { user_id: session.user.id, nickname, updated_at: new Date().toISOString(), ...(extraFields || {}) },
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

function openPasswordChangeModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h2 class="modal-title">비밀번호 변경</h2>
      <p class="modal-desc">새 비밀번호를 입력해주세요. 이 계정으로 로그인된 상태라 기존 비밀번호 확인 없이 바로 바꿀 수 있어요.</p>
      <input type="password" class="login-input" id="newPasswordInput" placeholder="새 비밀번호 (6자 이상)" minlength="6" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
      <input type="password" class="login-input" id="newPasswordConfirmInput" placeholder="새 비밀번호 확인" minlength="6" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
      <p class="login-status err" id="passwordChangeStatus" style="min-height:auto;"></p>
      <div class="modal-actions">
        <button type="button" class="logout-btn" id="passwordChangeCancelBtn">취소</button>
        <button type="button" class="login-btn" id="passwordChangeSaveBtn" style="width:auto;padding:10px 18px;">변경</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("passwordChangeCancelBtn").addEventListener("click", close);
  document.getElementById("passwordChangeSaveBtn").addEventListener("click", async () => {
    const pw = document.getElementById("newPasswordInput").value;
    const pwConfirm = document.getElementById("newPasswordConfirmInput").value;
    const status = document.getElementById("passwordChangeStatus");
    const btn = document.getElementById("passwordChangeSaveBtn");
    if (pw.length < 6) { status.textContent = "6자 이상 입력해주세요."; return; }
    if (pw !== pwConfirm) { status.textContent = "두 비밀번호가 서로 달라요."; return; }
    btn.disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    btn.disabled = false;
    if (error) { status.textContent = "변경 실패: " + error.message; return; }
    close();
    alert("비밀번호가 변경됐어요. 다음 로그인부터 새 비밀번호를 사용해주세요.");
  });
}


async function fetchCertTopRankers() {
  try {
    const { data, error } = await supabaseClient.rpc("get_cert_top_rankers");
    if (error) throw error;
    const byCert = {};
    (data || []).forEach((row) => {
      if (!byCert[row.cert_id]) byCert[row.cert_id] = [];
      byCert[row.cert_id].push(row);
    });
    return byCert;
  } catch (e) {
    console.warn("과목별 랭킹을 불러오지 못했습니다:", e.message);
    return {};
  }
}
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

async function fetchPendingApprovalCount() {
  try {
    const { count, error } = await supabaseClient
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("approved", false);
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.warn("가입 승인 대기 수를 불러오지 못했습니다:", e.message);
    return 0;
  }
}

async function renderHub(session) {
  const user = session.user;
  const [progressMap, isAdmin, profile, topRankersByCert] = await Promise.all([
    fetchProgressMap(user.id),
    checkIsAdmin(user.id),
    fetchProfile(user.id),
    fetchCertTopRankers(),
  ]);
  const nickname = profile.nickname;

  const cards = CERTS_REGISTRY.map((cert) => {
    const { solved, pct, acc } = computeStats(progressMap[cert.id], cert.questionCount);
    const metaLine = `${escapeHtml(cert.subtitle)} · 진도 ${solved}/${cert.questionCount.toLocaleString()}문항`
      + (acc !== null ? ` · 정답률 ${acc}%` : "");
    const topRankers = topRankersByCert[cert.id] || [];
    const rankersLine = topRankers.length
      ? `<p class="ticket-rankers">${topRankers.map((r, i) => `${RANK_MEDALS[i] || ""}${escapeHtml(r.nickname)}`).join(" ")}</p>`
      : "";
    const status = cert.status || "open";
    const isLocked = status !== "open" && !canBypassCertStatus(cert, isAdmin, profile);
    const statusInfo = CERT_STATUS_LABEL[status];
    const bypassBadge = status !== "open" && !isLocked
      ? `<span class="ticket-status-badge">${statusInfo.badge} · 관리자/편집자만 접근 중</span>` : "";
    const bodyHtml = `
        ${stampRing(pct, pct >= 100)}
        <div class="ticket-body">
          <p class="ticket-name">${escapeHtml(cert.name)}</p>
          <p class="ticket-subtitle">${metaLine}</p>
          ${bypassBadge}
          ${rankersLine}
          <p class="ticket-cta">${isLocked ? statusInfo.badge : (pct > 0 ? "이어서 학습 →" : "학습 시작 →")}</p>
        </div>`;
    if (isLocked) {
      return `<div class="ticket ticket-locked" data-locked-cert="${escapeHtml(cert.id)}" data-alert-msg="${escapeHtml(statusInfo.alertMsg)}">${bodyHtml}</div>`;
    }
    return `<a class="ticket" href="${escapeHtml(cert.path)}">${bodyHtml}</a>`;
  }).join("");

  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">Note</span>
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
            · <button type="button" class="nickname-edit-link" id="passwordChangeBtn">🔑 비밀번호 변경</button>
          </span>
          <div class="hub-user-actions">
            <a class="admin-link-btn" href="ranking.html" style="background:var(--teal);">🏆 랭킹</a>
            ${isAdmin ? `<a class="admin-link-btn" href="admin.html">🛠 관리자<span id="pendingApprovalBadge" class="admin-link-badge" style="display:none;"></span></a>` : ""}
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
  document.getElementById("passwordChangeBtn").addEventListener("click", () => {
    openPasswordChangeModal();
  });
  document.getElementById("nicknameEditBtn").addEventListener("click", () => {
    openNicknameModal(nickname, () => renderHub(session));
  });
  document.querySelectorAll(".ticket-locked").forEach((el) => {
    el.addEventListener("click", () => alert(el.getAttribute("data-alert-msg")));
  });
  bindHubInstallBtn();
  if (isAdmin) {
    fetchPendingApprovalCount().then((count) => {
      const badge = document.getElementById("pendingApprovalBadge");
      if (!badge || count <= 0) return;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.style.display = "block";
    });
  }
}

function renderLogin(statusMsg, statusType, mode) {
  mode = mode === "signup" ? "signup" : "login";
  const isSignup = mode === "signup";
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">Note</span>
        <button type="button" class="hub-install-btn" id="hubInstallBtn" style="display:none;">📲 앱 설치</button>
      </div>
    </header>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">My도전 Note</h1>
        <div class="login-mode-tabs">
          <button type="button" class="login-mode-tab ${!isSignup ? "active" : ""}" data-mode="login">로그인</button>
          <button type="button" class="login-mode-tab ${isSignup ? "active" : ""}" data-mode="signup">회원가입</button>
        </div>
        <p class="login-desc">${
          isSignup
            ? "이메일과 비밀번호로 가입해주세요."
            : "가입하신 이메일과 비밀번호로 로그인하세요."
        }</p>
        <form id="authForm">
          <input type="email" class="login-input" id="emailInput" placeholder="you@example.com" required autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input type="password" class="login-input" id="passwordInput" placeholder="비밀번호 (6자 이상)" required minlength="6" autocomplete="${isSignup ? "new-password" : "current-password"}" autocapitalize="off" autocorrect="off" spellcheck="false">
          ${isSignup ? `
          <input type="password" class="login-input" id="passwordConfirmInput" placeholder="비밀번호 확인" required minlength="6" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">
          <input type="text" class="login-input" id="nicknameInput" placeholder="닉네임 (2자 이상, 랭킹·오답의견에 표시돼요)" required minlength="2" maxlength="20">
          <p class="login-field-label">관심 있는 자격증 (여러 개 선택 가능)</p>
          <div class="cert-check-group" id="certCheckGroup">
            ${(typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : []).map((c) => `
              <label class="cert-check-item">
                <input type="checkbox" value="${escapeHtml(c.id)}" class="cert-check-input">
                <span>${escapeHtml(c.name)}</span>
              </label>`).join("")}
          </div>` : ""}
          <button type="submit" class="login-btn" id="authBtn">${isSignup ? "가입하기" : "로그인"}</button>
        </form>
        ${!isSignup ? `<p style="text-align:center;margin-top:10px;"><a href="#" id="forgotPwLink" style="font-size:0.8rem;color:var(--muted);text-decoration:underline;">비밀번호를 잊으셨나요?</a></p>` : ""}
        <p class="login-status ${statusType || ""}" id="loginStatus">${statusMsg || ""}</p>
      </div>
    </div>`;

  bindHubInstallBtn();
  const forgotLink = document.getElementById("forgotPwLink");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      openForgotPasswordModal();
    });
  }
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

    // 형식 자체가 엉터리인 이메일(예: '@' 뒤에 점(.)이 없는 'leejabbu@gmail' 같은 경우)을
    // 여기서 미리 걸러낸다. Supabase 서버 쪽 검증만 믿었다가, 실제로 '.com'이 빠진 주소로도
    // 가입이 되어버려서 나중에 로그인을 못 하는 사고가 있었음 — 그 재발 방지용.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!EMAIL_RE.test(email)) {
      status.textContent = "이메일 형식이 올바르지 않아요. (예: name@example.com) '.com' 같은 부분이 빠지지 않았는지 확인해주세요.";
      status.className = "login-status err";
      btn.disabled = false;
      return;
    }

    if (isSignup) {
      const passwordConfirm = document.getElementById("passwordConfirmInput").value;
      const nickname = document.getElementById("nicknameInput").value.trim();
      const interestedCerts = Array.from(document.querySelectorAll(".cert-check-input:checked")).map((el) => el.value);
      if (password !== passwordConfirm) {
        status.textContent = "비밀번호가 서로 달라요.";
        status.className = "login-status err";
        btn.disabled = false;
        return;
      }
      if (!nickname) {
        status.textContent = "닉네임을 입력해주세요.";
        status.className = "login-status err";
        btn.disabled = false;
        return;
      }
      status.textContent = "가입 처리 중...";
      signupInFlight = true; // 저장 끝날 때까지 전역 SIGNED_IN 리스너가 먼저 화면을 넘기지 못하게 잠금
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) throw error;
        // Supabase의 알려진 신호: 이미 가입(인증 완료)된 이메일로 signUp을 다시 호출하면
        // 에러 없이 성공 응답이 오지만 data.user.identities가 빈 배열로 온다(사용자 존재 여부를
        // 외부에 노출하지 않기 위한 설계). 이 경우 비밀번호만 그 기존 계정에 반영되고 새로 만들어지진 않음.
        const alreadyExists = data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (alreadyExists) {
          signupInFlight = false;
          status.textContent = `이미 가입되어 있는 이메일이에요. 방금 입력하신 비밀번호가 그 계정에 저장됐으니, "로그인" 탭에서 바로 로그인해보세요.`;
          status.className = "login-status ok";
          btn.disabled = false;
          return;
        }
        // 닉네임 · 관심 자격증 저장 (프로젝트에서 "Confirm email"을 꺼둔 경우 signUp() 즉시
        // 로그인 세션이 생기므로 바로 저장 가능; 켜져 있는 경우엔 세션이 아직 없어 저장을
        // 건너뛰고, 이메일 인증 링크를 누른 뒤 처음 로그인할 때 다시 물어보는 게 안전함)
        if (data.session) {
          const { error: profileError } = await supabaseClient.from("profiles").upsert(
            { user_id: data.user.id, nickname, interested_certs: interestedCerts, approved: false, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
          if (profileError) {
            signupInFlight = false;
            // 계정 자체는 이미 만들어졌고 로그인도 된 상태 — 닉네임만 다시 정하면 되므로
            // 회원가입을 처음부터 다시 시키지 않고, 그 자리에서 바로 닉네임 재입력 모달을 띄운다.
            const isDup = /duplicate|unique/i.test(profileError.message);
            status.textContent = isDup
              ? "가입은 완료됐는데, 그 닉네임은 이미 다른 사람이 쓰고 있어요. 아래에서 다른 닉네임으로 다시 설정해주세요."
              : "가입은 완료됐지만 닉네임 저장에 실패했어요: " + profileError.message;
            status.className = "login-status err";
            btn.disabled = false;
            openNicknameModal(null, () => { window.location.reload(); }, { approved: false, interested_certs: interestedCerts });
            return;
          }
          status.textContent = "가입 완료! 관리자 승인 후 이용하실 수 있어요.";
          status.className = "login-status ok";
          // approved:false 저장이 확실히 끝난 지금 이 시점에 직접 승인 대기 화면으로 넘긴다.
          // (레이스 컨디션 방지를 위해 잠가뒀던 전역 리스너는 이제 풀어주되, 화면 전환은
          // 리스너에 맡기지 않고 여기서 확정적으로 처리한다)
          signupInFlight = false;
          renderPendingApproval(email);
        } else {
          signupInFlight = false;
          sessionStorage.setItem("pendingNickname", nickname);
          sessionStorage.setItem("pendingInterestedCerts", JSON.stringify(interestedCerts));
          status.textContent = `${email} 주소로 인증 메일을 보냈어요. 메일함(스팸함도 확인!)에서 인증 링크를 눌러주시면 가입이 완료돼요.`;
          status.className = "login-status ok";
          btn.disabled = false;
        }
      } catch (err) {
        signupInFlight = false;
        const isRateLimit = /rate limit/i.test(err.message);
        status.textContent = isRateLimit
          ? "메일 발송 요청이 너무 잦아서 잠시 제한됐어요(보통 시간당 몇 통 수준). 1시간 정도 뒤에 다시 시도해주세요."
          : "가입 실패: " + err.message;
        status.className = "login-status err";
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
// 비밀번호를 잊었을 때: 본인 이메일로 재설정 링크를 받는 모달.
// 관리자를 포함해 그 누구도 실제 비밀번호 값을 보거나 정하지 않고, 본인만 새 비밀번호를 입력한다.
function openForgotPasswordModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <h2 class="modal-title">비밀번호 재설정</h2>
      <p class="modal-desc">가입하신 이메일 주소를 입력하시면, 새 비밀번호를 설정할 수 있는 링크를 보내드려요.</p>
      <input type="email" class="login-input" id="forgotEmailInput" placeholder="you@example.com" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false">
      <p class="login-status err" id="forgotStatus" style="min-height:auto;"></p>
      <div class="modal-actions">
        <button type="button" class="logout-btn" id="forgotCancelBtn">취소</button>
        <button type="button" class="login-btn" id="forgotSendBtn" style="width:auto;padding:10px 18px;">재설정 링크 보내기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("forgotCancelBtn").addEventListener("click", close);
  document.getElementById("forgotSendBtn").addEventListener("click", async () => {
    const input = document.getElementById("forgotEmailInput");
    const status = document.getElementById("forgotStatus");
    const email = input.value.trim();
    if (!email) { status.textContent = "이메일을 입력해주세요."; return; }
    const btn = document.getElementById("forgotSendBtn");
    btn.disabled = true;
    status.className = "login-status";
    status.textContent = "보내는 중...";
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });
      if (error) throw error;
      status.className = "login-status ok";
      status.textContent = "메일함을 확인해주세요! 링크를 누르면 새 비밀번호를 정할 수 있어요.";
      btn.disabled = true;
    } catch (e) {
      status.className = "login-status err";
      status.textContent = "전송 실패: " + e.message;
      btn.disabled = false;
    }
  });
}

// 비밀번호 재설정 이메일의 링크를 눌러 돌아왔을 때(Supabase가 자동으로 "복구 세션"을 만들어주고
// PASSWORD_RECOVERY 이벤트를 쏴줌): 새 비밀번호를 직접 입력하는 화면. 관리자도 이 값을 알 수 없다.
function renderSetNewPassword() {
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">Note</span>
      </div>
    </header>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">새 비밀번호 설정</h1>
        <p class="login-desc">본인만 알 수 있는 새 비밀번호를 입력해주세요.</p>
        <input type="password" class="login-input" id="newPwInput" placeholder="새 비밀번호 (6자 이상)" minlength="6" autocomplete="new-password">
        <input type="password" class="login-input" id="newPwConfirmInput" placeholder="새 비밀번호 확인" minlength="6" autocomplete="new-password">
        <button type="button" class="login-btn" id="setNewPwBtn">비밀번호 설정하고 계속하기</button>
        <p class="login-status" id="newPwStatus"></p>
      </div>
    </div>`;
  document.getElementById("setNewPwBtn").addEventListener("click", async () => {
    const pw = document.getElementById("newPwInput").value;
    const pwConfirm = document.getElementById("newPwConfirmInput").value;
    const status = document.getElementById("newPwStatus");
    const btn = document.getElementById("setNewPwBtn");
    if (pw.length < 6) { status.textContent = "6자 이상 입력해주세요."; status.className = "login-status err"; return; }
    if (pw !== pwConfirm) { status.textContent = "비밀번호가 서로 달라요."; status.className = "login-status err"; return; }
    btn.disabled = true;
    status.className = "login-status";
    status.textContent = "설정 중...";
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: pw });
      if (error) throw error;
      history.replaceState(null, "", window.location.pathname);
      status.className = "login-status ok";
      status.textContent = "완료! 잠시 후 이동해요.";
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) setTimeout(() => proceedAfterLogin(session), 600);
    } catch (e) {
      status.className = "login-status err";
      status.textContent = "설정 실패: " + e.message;
      btn.disabled = false;
    }
  });
}

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
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">Note</span>
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

async function applyPendingProfileIfAny(userId) {
  const nickname = sessionStorage.getItem("pendingNickname");
  if (!nickname) return;
  const interestedCerts = JSON.parse(sessionStorage.getItem("pendingInterestedCerts") || "[]");
  sessionStorage.removeItem("pendingNickname");
  sessionStorage.removeItem("pendingInterestedCerts");
  try {
    await supabaseClient.from("profiles").upsert(
      { user_id: userId, nickname, interested_certs: interestedCerts, approved: false, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch (e) {
    console.warn("가입 시 입력한 닉네임 반영 실패:", e.message);
  }
}

function renderPendingApproval(email) {
  const kakaoUrl = "https://open.kakao.com/me/upvip";
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">Note</span>
      </div>
    </header>
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">가입 승인 대기 중</h1>
        <p class="login-desc">${escapeHtml(email)} 계정은 아직 관리자 승인을 기다리고 있어요.</p>
        <div class="kakao-approval-box">
          <p class="kakao-approval-desc">지금은 폐쇄 서비스로 운영 중이라, 아래 카카오톡 오픈채팅으로 <b>1:1 승인 요청</b>을 보내주셔야 빠르게 확인돼요.</p>
          <a class="kakao-approval-btn" href="${kakaoUrl}" target="_blank" rel="noopener">💬 카카오톡 1:1로 승인 요청하기</a>
        </div>
        <button type="button" class="logout-btn" id="pendingLogoutBtn" style="width:100%;">로그아웃</button>
      </div>
    </div>`;
  document.getElementById("pendingLogoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
  });
}

// 로그인 성공 직후 공통으로 거치는 관문: 승인 대기 중이면 허브로 못 들어가게 막는다.
async function proceedAfterLogin(session) {
  const profile = await fetchProfile(session.user.id);
  if (profile.approved === false) {
    renderPendingApproval(session.user.email);
    return;
  }
  if (goToNextIfAny()) return;
  renderHub(session);
}

async function boot() {
  if (handleShortDeepLinkIfAny()) return; // 리다이렉트 중이므로 나머지 부트 과정 생략
  const tokenHashParams = getTokenHashParams();
  if (tokenHashParams) {
    renderConfirm(tokenHashParams);
    return;
  }
  if (!supabaseClient) {
    root.innerHTML = `<div class="login-screen"><div class="login-card"><p class="login-status err">서비스 연결에 실패했어요. 새로고침해주세요.</p></div></div>`;
    return;
  }
  const authError = parseAuthErrorFromUrl();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await applyPendingProfileIfAny(session.user.id);
    await proceedAfterLogin(session);
  } else {
    renderLogin(authError, authError ? "err" : undefined);
  }
}

// supabaseClient가 null일 수 있음(CDN 로딩 실패 등, assets/supabase-client.js 참고).
// 이 최상위 호출이 예외를 던지면 바로 아래의 boot() 자체가 실행이 안 돼서 페이지 전체가
// 먹통이 되므로, null이면 조용히 건너뛴다.
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      // 비밀번호 재설정 이메일 링크로 돌아온 경우: 로그인 처리를 하지 말고
      // 새 비밀번호를 직접 입력하는 화면부터 보여준다.
      renderSetNewPassword();
    } else if (event === "SIGNED_IN" && session) {
      if (signupInFlight) return; // 가입 처리 중이면 이 리스너는 개입하지 않는다 (submit 핸들러가 직접 화면 전환)
      await applyPendingProfileIfAny(session.user.id);
      await proceedAfterLogin(session);
    } else if (event === "SIGNED_OUT") {
      renderLogin();
    }
  });
}

boot();
