// admin.js — 관리자 대시보드 로직
// 접근 자체는 페이지 링크만으로 막지 않고, 매 RPC 호출마다 DB(admin_get_summary 등)가
// "auth.admins 테이블에 없으면 예외"로 거부하므로 실질적인 권한 체크는 DB 쪽에서 이뤄진다.
// (관리자가 아닌 사람이 admin.html 주소를 직접 열어도 데이터가 안 나오고 "권한 없음"만 보임)

const root = document.getElementById("root");
// 이 저장소들의 GitHub 조직/이름 — 다른 프로젝트에 재사용할 경우 여기만 바꾸면 됨
const GITHUB_REPOS = [
  { label: "허브 (do)", org: "challenge60", repo: "do" },
  { label: "건축기사 단독형 (a)", org: "challenge60", repo: "a" },
  { label: "방수산업기사 단독형 (b)", org: "challenge60", repo: "b" },
  { label: "산업안전기사 단독형 (c)", org: "challenge60", repo: "c" },
];

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtBytes(n) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function fmtDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderDenied() {
  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <div class="admin-denied">관리자 권한이 없어 이 페이지를 볼 수 없습니다.</div>
    </div>`;
}

function renderLoading() {
  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">관리자 대시보드</p>
      <div class="admin-loading">불러오는 중…</div>
    </div>`;
}

async function fetchSummary() {
  const { data, error } = await supabaseClient.rpc("admin_get_summary");
  if (error) throw error;
  return data || [];
}

async function fetchUserStats() {
  const { data, error } = await supabaseClient.rpc("admin_get_user_stats");
  if (error) throw error;
  return data || [];
}

function certLabel(certId) {
  const found = (typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : []).find((c) => c.id === certId);
  return found ? found.name : certId;
}

async function downloadBackup(btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "백업 파일 만드는 중…";
  try {
    const { data, error } = await supabaseClient.rpc("admin_export_backup");
    if (error) throw error;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `db-backup_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    btn.textContent = "다운로드 완료 ✓";
  } catch (e) {
    console.error(e);
    alert("백업 실패: " + e.message);
    btn.textContent = originalText;
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = originalText; }, 2500);
  }
}

async function renderDashboard() {
  renderLoading();
  let summary, userStats;
  try {
    [summary, userStats] = await Promise.all([fetchSummary(), fetchUserStats()]);
  } catch (e) {
    console.error(e);
    renderDenied();
    return;
  }

  const totalUsers = summary.length ? summary[0].total_users : 0;
  const totalBytes = summary.length ? summary[0].total_storage_bytes : 0;

  const certRows = summary.map((row) => `
    <tr>
      <td>${escapeHtml(certLabel(row.cert_id))}</td>
      <td class="num">${row.users_per_cert}명</td>
      <td class="num">${fmtBytes(row.bytes_per_cert)}</td>
    </tr>`).join("");

  const userRows = userStats.map((u) => `
    <tr>
      <td>${escapeHtml(u.email || "(이메일 없음)")}</td>
      <td>${fmtDate(u.signed_up_at)}</td>
      <td>${fmtDate(u.last_active_at)}</td>
      <td>${(u.certs_used || []).map(certLabel).map(escapeHtml).join(", ") || "—"}</td>
      <td class="num">${fmtBytes(u.total_bytes)}</td>
    </tr>`).join("");

  const repoLinks = GITHUB_REPOS.map((r) => `
    <a class="admin-back" style="display:block;margin-bottom:6px;"
       href="https://github.com/${r.org}/${r.repo}/archive/refs/heads/main.zip">
      ⬇ ${escapeHtml(r.label)} — ZIP 다운로드
    </a>`).join("");

  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">관리자 대시보드</p>
      <p class="admin-sub">가입자 현황, 계정별 사용량, 데이터 백업을 한 곳에서 확인합니다.</p>

      <div class="admin-summary-grid">
        <div class="admin-summary-card">
          <div class="num">${totalUsers}</div>
          <div class="label">전체 가입자</div>
        </div>
        <div class="admin-summary-card">
          <div class="num">${fmtBytes(totalBytes)}</div>
          <div class="label">전체 학습기록 용량</div>
        </div>
      </div>

      <p class="admin-section-title">자격증별 사용 현황</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>자격증</th><th>사용자 수</th><th>사용 용량</th></tr></thead>
          <tbody>${certRows || `<tr><td colspan="3" class="admin-empty">데이터 없음</td></tr>`}</tbody>
        </table>
      </div>

      <p class="admin-section-title">계정별 상세 (용량 많은 순)</p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>이메일</th><th>가입일</th><th>최근 활동</th><th>사용 중인 자격증</th><th>사용 용량</th></tr></thead>
          <tbody>${userRows || `<tr><td colspan="5" class="admin-empty">가입자가 없습니다</td></tr>`}</tbody>
        </table>
      </div>

      <p class="admin-section-title">💾 데이터베이스 백업</p>
      <div class="admin-table-wrap" style="padding:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          학습기록·관리자 수정사항·가입자 목록 전체를 JSON 파일 하나로 다운로드합니다.
          Supabase에 문제가 생기더라도 이 파일만 있으면 데이터를 복구할 수 있어요.
          주기적으로(예: 월 1회) 받아서 로컬이나 클라우드 드라이브에 보관하는 걸 추천드려요.
        </p>
        <button type="button" class="admin-link-btn-like" id="backupBtn"
          style="border:1px solid var(--amber);background:var(--amber);color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;">
          지금 백업 파일 다운로드 (JSON)
        </button>
      </div>

      <p class="admin-section-title">📦 소스코드 백업</p>
      <div class="admin-table-wrap" style="padding:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          코드는 GitHub에 커밋할 때마다 이미 버전 이력이 남아있어 사실상 자동 백업되고 있어요.
          다만 만약을 위해 4개 저장소를 현재 상태 그대로 ZIP으로 받아둘 수 있습니다.
        </p>
        ${repoLinks}
      </div>
    </div>`;

  document.getElementById("backupBtn").addEventListener("click", (e) => downloadBackup(e.currentTarget));
}

async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  renderDashboard();
}

boot();
