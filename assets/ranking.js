// ranking.js — 학습 랭킹 페이지.
// '전체(종합)' 탭: get_rankings() — 3개 자격증 합산, 풀이수/정답률/진도율/종합 4개 기준
// 종목별 탭: get_cert_rankings() — 그 자격증 안에서만 풀이수/정답률/진도율 3개 기준
// 닉네임을 설정한 사용자만 랭킹에 나타남(닉네임 없으면 랭킹 미참여로 간주).

const root = document.getElementById("root");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const OVERALL_TABS = [
  { key: "total_solved", label: "풀이수", fmt: (v) => `${(v || 0).toLocaleString()}문항`, sort: (a, b) => (b.total_solved || 0) - (a.total_solved || 0) },
  { key: "accuracy_pct", label: "정답률", fmt: (v) => (v === null ? "—" : `${v}%`), sort: (a, b) => (b.accuracy_pct ?? -1) - (a.accuracy_pct ?? -1) },
  { key: "progress_pct", label: "진도율", fmt: (v) => `${v || 0}%`, sort: (a, b) => (b.progress_pct || 0) - (a.progress_pct || 0) },
  { key: "composite_score", label: "종합", fmt: (v) => `${v || 0}점`, sort: (a, b) => (b.composite_score || 0) - (a.composite_score || 0) },
];
const CERT_TABS = [
  { key: "solved", label: "풀이수", fmt: (v) => `${(v || 0).toLocaleString()}문항`, sort: (a, b) => (b.solved || 0) - (a.solved || 0) },
  { key: "accuracy_pct", label: "정답률", fmt: (v) => (v === null ? "—" : `${v}%`), sort: (a, b) => (b.accuracy_pct ?? -1) - (a.accuracy_pct ?? -1) },
  { key: "progress_pct", label: "진도율", fmt: (v) => `${v || 0}%`, sort: (a, b) => (b.progress_pct || 0) - (a.progress_pct || 0) },
];

function medal(rank) {
  if (rank === 0) return "🥇";
  if (rank === 1) return "🥈";
  if (rank === 2) return "🥉";
  return `${rank + 1}`;
}

function renderTable(rows, tab) {
  const sorted = [...rows].sort(tab.sort);
  const body = sorted.map((row, i) => `
    <tr>
      <td class="num" style="text-align:center;">${medal(i)}</td>
      <td>${escapeHtml(row.nickname)}</td>
      <td class="num">${tab.fmt(row[tab.key])}</td>
    </tr>`).join("");
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th style="width:50px;text-align:center;">순위</th><th>닉네임</th><th>${tab.label}</th></tr></thead>
        <tbody>${body || `<tr><td colspan="3" class="admin-empty">아직 랭킹에 참여한 사람이 없어요. 닉네임을 설정하면 참여할 수 있어요.</td></tr>`}</tbody>
      </table>
    </div>`;
}

// state.certKey: "overall" | 자격증 id
function renderPage(overallRows, certRowsByCert, state) {
  const certList = typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : [];
  const certSelectorTabs = [
    `<button type="button" class="login-mode-tab cert-select-tab ${state.certKey === "overall" ? "active" : ""}" data-cert="overall">전체(종합)</button>`,
    ...certList.map((c) => `<button type="button" class="login-mode-tab cert-select-tab ${state.certKey === c.id ? "active" : ""}" data-cert="${c.id}">${escapeHtml(c.name)}</button>`),
  ].join("");

  const isOverall = state.certKey === "overall";
  const tabDefs = isOverall ? OVERALL_TABS : CERT_TABS;
  const rows = isOverall ? overallRows : (certRowsByCert[state.certKey] || []);
  const activeTab = tabDefs.find((t) => t.key === state.metricKey) || tabDefs[0];

  const metricTabs = tabDefs.map((t) => `
    <button type="button" class="login-mode-tab ranking-tab ${t.key === activeTab.key ? "active" : ""}" data-key="${t.key}">${t.label}</button>
  `).join("");

  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">🏆 학습 랭킹</p>
      <p class="admin-sub">닉네임을 설정한 사용자만 순위에 표시돼요. '전체(종합)'는 3개 자격증을 합산한 순위, 종목을 선택하면 그 자격증 안에서만의 순위예요.</p>
      <div class="login-mode-tabs" style="margin-bottom:10px;flex-wrap:wrap;">${certSelectorTabs}</div>
      <div class="login-mode-tabs" style="margin-bottom:16px;">${metricTabs}</div>
      ${renderTable(rows, activeTab)}
    </div>`;

  root.querySelectorAll(".cert-select-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const newCertKey = btn.dataset.cert;
      const stillValid = newCertKey === "overall" ? OVERALL_TABS : CERT_TABS;
      renderPage(overallRows, certRowsByCert, { certKey: newCertKey, metricKey: stillValid[0].key });
    });
  });
  root.querySelectorAll(".ranking-tab").forEach((btn) => {
    btn.addEventListener("click", () => renderPage(overallRows, certRowsByCert, { certKey: state.certKey, metricKey: btn.dataset.key }));
  });
}

function renderLoading() {
  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">🏆 학습 랭킹</p>
      <div class="admin-loading">불러오는 중…</div>
    </div>`;
}

function renderNeedsLogin() {
  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <div class="admin-denied">랭킹은 로그인해야 볼 수 있어요.</div>
    </div>`;
}

async function boot() {
  renderLoading();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { renderNeedsLogin(); return; }
  try {
    const [overallRes, certRes] = await Promise.all([
      supabaseClient.rpc("get_rankings"),
      supabaseClient.rpc("get_cert_rankings"),
    ]);
    if (overallRes.error) throw overallRes.error;
    if (certRes.error) throw certRes.error;

    const certRowsByCert = {};
    (certRes.data || []).forEach((row) => {
      if (!certRowsByCert[row.cert_id]) certRowsByCert[row.cert_id] = [];
      certRowsByCert[row.cert_id].push(row);
    });

    renderPage(overallRes.data || [], certRowsByCert, { certKey: "overall", metricKey: "composite_score" });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="admin-wrap"><a class="admin-back" href="index.html">← 목록으로</a><div class="admin-denied">랭킹을 불러오지 못했어요: ${escapeHtml(e.message)}</div></div>`;
  }
}

boot();
