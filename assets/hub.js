// 허브 페이지 로직: 로그인 화면 ↔ 자격증 목록 화면 전환, 자격증별 진행률 표시.

const root = document.getElementById("root");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
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
}

function renderLogin(statusMsg, statusType) {
  root.innerHTML = `
    <header class="hub-topbar">
      <div class="wrap">
        <span class="hub-mark">My도전</span><span class="hub-mark-sub">자격증 학습노트</span>
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
