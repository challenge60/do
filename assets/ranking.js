// ranking.js — 학습 랭킹 페이지. get_rankings() RPC 결과를 4가지 기준으로 정렬해서 보여준다.
// 닉네임을 설정한 사용자만 랭킹에 나타남(닉네임 없으면 랭킹 미참여로 간주).

const root = document.getElementById("root");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const TABS = [
  { key: "total_solved", label: "풀이수", fmt: (v) => `${(v || 0).toLocaleString()}문항`, sort: (a, b) => (b.total_solved || 0) - (a.total_solved || 0) },
  { key: "accuracy_pct", label: "정답률", fmt: (v) => (v === null ? "—" : `${v}%`), sort: (a, b) => (b.accuracy_pct ?? -1) - (a.accuracy_pct ?? -1) },
  { key: "progress_pct", label: "진도율", fmt: (v) => `${v || 0}%`, sort: (a, b) => (b.progress_pct || 0) - (a.progress_pct || 0) },
  { key: "composite_score", label: "종합", fmt: (v) => `${v || 0}점`, sort: (a, b) => (b.composite_score || 0) - (a.composite_score || 0) },
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

function renderPage(rows, activeKey) {
  const tabs = TABS.map((t) => `
    <button type="button" class="login-mode-tab ranking-tab ${t.key === activeKey ? "active" : ""}" data-key="${t.key}">${t.label}</button>
  `).join("");
  const activeTab = TABS.find((t) => t.key === activeKey) || TABS[0];
  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">🏆 학습 랭킹</p>
      <p class="admin-sub">닉네임을 설정한 사용자만 순위에 표시돼요. 종합점수는 진도율·정답률을 절반씩 반영해요.</p>
      <div class="login-mode-tabs" style="margin-bottom:16px;">${tabs}</div>
      ${renderTable(rows, activeTab)}
    </div>`;
  root.querySelectorAll(".ranking-tab").forEach((btn) => {
    btn.addEventListener("click", () => renderPage(rows, btn.dataset.key));
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
    const { data, error } = await supabaseClient.rpc("get_rankings");
    if (error) throw error;
    renderPage(data || [], "composite_score");
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="admin-wrap"><a class="admin-back" href="index.html">← 목록으로</a><div class="admin-denied">랭킹을 불러오지 못했어요: ${escapeHtml(e.message)}</div></div>`;
  }
}

boot();
