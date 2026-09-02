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

async function fetchCommentedQuestions() {
  const { data, error } = await supabaseClient.rpc("admin_get_commented_questions");
  if (error) throw error;
  return data || [];
}

async function fetchPendingApprovals() {
  const { data, error } = await supabaseClient.rpc("admin_get_pending_approvals");
  if (error) throw error;
  return data || [];
}

async function setApproval(userId, isApproved, btn) {
  if (btn) btn.disabled = true;
  try {
    const { error } = await supabaseClient.rpc("admin_set_approval", {
      target_user_id: userId,
      is_approved: isApproved,
    });
    if (error) throw error;
    return true;
  } catch (e) {
    alert("처리 실패: " + e.message);
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function certPathFor(certId) {
  const found = (typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : []).find((c) => c.id === certId);
  return found ? found.path : null;
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

async function downloadAllQuestionData(btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "문제 데이터 모으는 중…";
  try {
    const zip = new JSZip();
    const certs = typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : [];
    for (const cert of certs) {
      const res = await fetch(cert.path.replace(/index\.html$/, "data.js"), { cache: "no-store" });
      if (!res.ok) throw new Error(`${cert.name} data.js 다운로드 실패 (${res.status})`);
      const text = await res.text();
      zip.file(`${cert.id}.data.js`, text);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `question-data-backup_${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    btn.textContent = "다운로드 완료 ✓";
  } catch (e) {
    console.error(e);
    alert("문제 데이터 백업 실패: " + e.message);
    btn.textContent = originalText;
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = originalText; }, 2500);
  }
}

/* data.js 텍스트 안의 'const SAMPLE_DATA = [...]' 배열 부분만 정확히 찾아서,
   해당 자격증의 question_overrides(전체 적용된 관리자 수정)를 id 기준으로 덮어쓴 뒤
   다시 그 자리에 끼워넣는다. 다른 부분(UNIT_TAXONOMY, IMAGES, EXAM_CONFIG 등)은 그대로 둔다. */
function mergeOverridesIntoDataJs(jsText, overrides) {
  if (!overrides || !overrides.length) return jsText;
  const marker = "const SAMPLE_DATA";
  const markerIdx = jsText.indexOf(marker);
  if (markerIdx === -1) throw new Error("SAMPLE_DATA 선언을 찾을 수 없어요");
  const arrStart = jsText.indexOf("[", markerIdx);
  let depth = 0, i = arrStart;
  for (; i < jsText.length; i++) {
    if (jsText[i] === "[") depth++;
    else if (jsText[i] === "]") { depth--; if (depth === 0) break; }
  }
  const arrEnd = i + 1;
  const arrText = jsText.slice(arrStart, arrEnd);
  // eslint-disable-next-line no-new-func
  const data = new Function(`return ${arrText};`)();
  const byId = {};
  overrides.forEach((o) => { byId[o.question_id] = o; });
  const merged = data.map((q) => {
    const ov = byId[q.id];
    if (!ov) return q;
    return {
      ...q,
      question: ov.question ?? q.question,
      answer: ov.answer ?? q.answer,
      images: ov.images ?? q.images,
      tags: ov.tags ?? q.tags,
      unitMajor: ov.unit_major ?? q.unitMajor,
      unitMinor: ov.unit_minor ?? q.unitMinor,
    };
  });
  return jsText.slice(0, arrStart) + JSON.stringify(merged) + jsText.slice(arrEnd);
}

async function downloadMergedQuestionData(btn) {
  const originalText = btn.textContent;
  const certs = typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : [];
  btn.disabled = true;
  btn.textContent = "확인 중…";
  try {
    const { data: overrides, error } = await supabaseClient.from("question_overrides").select("*");
    if (error) throw error;
    if (!overrides || !overrides.length) {
      alert("현재 '전체 적용됨' 상태인 관리자 수정이 없어요. 병합할 내용이 없습니다.");
      return;
    }
    const byCert = {};
    overrides.forEach((o) => { (byCert[o.cert_id] ||= []).push(o); });
    const summary = certs.map((c) => `${c.name}: ${(byCert[c.id] || []).length}건`).join("\n");
    const ok = confirm(
      `현재 '전체 적용됨' 상태로 쌓인 관리자 수정사항을 원본 데이터에 병합해서 새 파일을 만들까요?\n\n${summary}\n\n` +
      `⚠️ 다운로드된 파일로 실제 certs/<자격증>/data.js를 직접 교체해야 반영됩니다(자동 반영 아님).\n` +
      `교체하고 나면 그 수정사항들이 새로운 '원본'이 되어, 문제 화면의 '전체 적용됨' 배지는 사라져요.\n\n` +
      `확인: 병합된 파일 다운로드 / 취소: 취소`
    );
    if (!ok) return;

    btn.textContent = "병합 중…";
    const zip = new JSZip();
    for (const cert of certs) {
      const res = await fetch(cert.path.replace(/index\.html$/, "data.js"), { cache: "no-store" });
      if (!res.ok) throw new Error(`${cert.name} data.js 다운로드 실패 (${res.status})`);
      const text = await res.text();
      const mergedText = mergeOverridesIntoDataJs(text, byCert[cert.id] || []);
      zip.file(`${cert.id}.data.js`, mergedText);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `question-data-merged_${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    btn.textContent = "병합 완료 ✓";
  } catch (e) {
    console.error(e);
    alert("병합 백업 실패: " + e.message);
    btn.textContent = originalText;
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = originalText; }, 3000);
  }
}

async function renderDashboard() {
  renderLoading();
  let summary, userStats, commentedQuestions, pendingApprovals;
  try {
    [summary, userStats, commentedQuestions, pendingApprovals] = await Promise.all([
      fetchSummary(),
      fetchUserStats(),
      fetchCommentedQuestions(),
      fetchPendingApprovals(),
    ]);
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

  const ROLE_LABELS = { admin: "관리자", editor: "편집자", general: "일반", excellent: "우수회원" };
  const allCerts = typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : [];
  const userRows = userStats.map((u) => `
    <tr data-user-id="${escapeHtml(u.user_id)}">
      <td>${escapeHtml(u.nickname || "(닉네임 없음)")}${u.suspended ? ' <span style="color:var(--rose,#c0392b);font-size:11px;font-weight:800;">[정지중]</span>' : ""}</td>
      <td>${escapeHtml(u.email || "(이메일 없음)")}</td>
      <td>
        <select class="role-select" style="border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-size:12px;background:#fff;">
          ${Object.entries(ROLE_LABELS).map(([val, label]) => `<option value="${val}" ${u.role === val ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <div class="editor-certs-box" style="margin-top:4px;${u.role === "editor" ? "" : "display:none;"}">
          ${allCerts.map((c) => `
            <label style="display:block;font-size:11px;white-space:nowrap;">
              <input type="checkbox" class="editor-cert-chk" value="${escapeHtml(c.id)}" ${(u.editor_certs || []).includes(c.id) ? "checked" : ""}>
              ${escapeHtml(c.name)}
            </label>`).join("")}
        </div>
      </td>
      <td>${(u.interested_certs || []).map(certLabel).map(escapeHtml).join(", ") || "—"}</td>
      <td>${fmtDate(u.signed_up_at)}</td>
      <td>${fmtDate(u.last_active_at)}</td>
      <td>${(u.certs_used || []).map(certLabel).map(escapeHtml).join(", ") || "—"}</td>
      <td class="num">${fmtBytes(u.total_bytes)}</td>
      <td>
        <button type="button" class="user-action-btn suspend-btn" style="font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid ${u.suspended ? "var(--teal)" : "var(--rose,#c0392b)"};background:#fff;color:${u.suspended ? "var(--teal)" : "var(--rose,#c0392b)"};cursor:pointer;white-space:nowrap;margin-bottom:4px;">${u.suspended ? "정지 해제" : "활동 정지"}</button>
        <button type="button" class="user-action-btn resetpw-btn" style="font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid var(--amber);background:#fff;color:var(--amber);cursor:pointer;white-space:nowrap;">비번 재설정 메일</button>
      </td>
    </tr>`).join("");

  const commentRows = commentedQuestions.map((row) => {
    const path = certPathFor(row.cert_id);
    const link = path ? `${path}?q=${encodeURIComponent(row.question_id)}` : null;
    const preview = escapeHtml((row.last_content || "").slice(0, 40)) + (row.last_content && row.last_content.length > 40 ? "…" : "");
    return `
    <tr>
      <td>${escapeHtml(certLabel(row.cert_id))}</td>
      <td style="white-space:normal;max-width:220px;">${preview}</td>
      <td class="num">${row.comment_count}개</td>
      <td>${fmtDate(row.last_comment_at)}</td>
      <td>${link ? `<a class="admin-back" style="margin:0;display:inline;" href="${link}" target="_blank" rel="noopener">문제로 이동 →</a>` : "—"}</td>
    </tr>`;
  }).join("");

  const repoLinks = GITHUB_REPOS.map((r) => `
    <a class="admin-back" style="display:block;margin-bottom:6px;"
       href="https://github.com/${r.org}/${r.repo}/archive/refs/heads/main.zip">
      ⬇ ${escapeHtml(r.label)} — ZIP 다운로드
    </a>`).join("");

  const certs = typeof CERTS_REGISTRY !== "undefined" ? CERTS_REGISTRY : [];
  const questionDataLinks = certs.map((cert) => `
    <a class="admin-back" style="display:block;margin-bottom:6px;"
       href="${escapeHtml(cert.path.replace(/index\.html$/, "data.js"))}" download>
      ⬇ ${escapeHtml(cert.name)} — data.js 다운로드 (${cert.questionCount.toLocaleString()}문항)
    </a>`).join("");

  const pendingRows = pendingApprovals.map((p) => `
    <tr data-user-id="${escapeHtml(p.user_id)}">
      <td>${escapeHtml(p.nickname || "(닉네임 없음)")}</td>
      <td>${escapeHtml(p.email || "-")}</td>
      <td>${(p.interested_certs || []).map(certLabel).map(escapeHtml).join(", ") || "—"}</td>
      <td>${fmtDate(p.signed_up_at)}</td>
      <td>
        <button type="button" class="admin-approve-btn" data-action="approve" style="border:1px solid var(--teal);background:var(--teal);color:#fff;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer;margin-right:6px;">승인</button>
        <button type="button" class="admin-approve-btn" data-action="reject" style="border:1px solid var(--rose,#c0392b);background:#fff;color:var(--rose,#c0392b);font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer;">거절</button>
      </td>
    </tr>`).join("");

  root.innerHTML = `
    <div class="admin-wrap">
      <a class="admin-back" href="index.html">← 목록으로</a>
      <p class="admin-title">관리자 대시보드</p>
      <p class="admin-sub">가입자 현황, 계정별 사용량, 데이터 백업을 한 곳에서 확인합니다.</p>

      ${pendingApprovals.length ? `
      <p class="admin-section-title">🔔 승인 대기 중인 가입자 (${pendingApprovals.length}명)</p>
      <div class="admin-table-wrap" style="margin-bottom:24px;border-color:var(--amber);">
        <table class="admin-table">
          <thead><tr><th>닉네임</th><th>이메일</th><th>관심 자격증</th><th>가입일</th><th>처리</th></tr></thead>
          <tbody>${pendingRows}</tbody>
        </table>
      </div>` : ""}

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
          <thead><tr><th>닉네임</th><th>이메일</th><th>등급</th><th>관심 자격증</th><th>가입일</th><th>최근 활동</th><th>사용 중인 자격증</th><th>사용 용량</th><th>관리</th></tr></thead>
          <tbody>${userRows || `<tr><td colspan="9" class="admin-empty">가입자가 없습니다</td></tr>`}</tbody>
        </table>
      </div>

      <p class="admin-section-title">💬 오답의견 올라온 문제 (최신순)</p>
      <div class="admin-table-wrap" style="white-space:normal;">
        <table class="admin-table" style="white-space:normal;">
          <thead><tr><th>자격증</th><th>최근 의견</th><th>개수</th><th>최근 작성</th><th></th></tr></thead>
          <tbody>${commentRows || `<tr><td colspan="5" class="admin-empty">아직 올라온 의견이 없습니다</td></tr>`}</tbody>
        </table>
      </div>

      <p class="admin-section-title">💾 데이터베이스 백업 (학습기록 · 관리자 수정사항 · 가입자)</p>
      <div class="admin-table-wrap" style="padding:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          학습기록·관리자 수정사항·가입자 목록 전체를 JSON 파일 하나로 다운로드합니다.
          Supabase에 문제가 생기더라도 이 파일만 있으면 데이터를 복구할 수 있어요.
          주기적으로(예: 월 1회) 받아서 로컬이나 클라우드 드라이브에 보관하는 걸 추천드려요.
        </p>
        <button type="button" id="backupBtn"
          style="border:1px solid var(--amber);background:var(--amber);color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;">
          지금 백업 파일 다운로드 (JSON)
        </button>
      </div>

      <p class="admin-section-title">📚 원본 문제 데이터 백업 (문제 · 정답 · 이미지)</p>
      <div class="admin-table-wrap" style="padding:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          자격증별 원본 문제은행(<code>data.js</code>) 자체를 백업합니다. 이건 GitHub에 커밋될 때마다
          버전 이력이 남긴 하지만, 자주는 아니어도 가끔 로컬에 사본을 받아두면 안심할 수 있어요.
          (관리자가 문제를 고친 내용은 위 "데이터베이스 백업"의 <code>question_overrides</code> 항목에
          이미 포함되어 있습니다)
        </p>
        <button type="button" id="allDataBtn" style="margin-bottom:12px;
          border:1px solid var(--teal);background:var(--teal);color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;">
          전체 자격증 문제 데이터 ZIP으로 한 번에 다운로드 (원본 그대로)
        </button>
        <button type="button" id="mergeDataBtn" style="margin-bottom:12px;margin-left:8px;
          border:1px solid var(--amber);background:#fff;color:var(--amber);font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;cursor:pointer;">
          🔀 전체 적용된 수정사항 병합해서 다운로드
        </button>
        <p style="font-size:12px;color:var(--muted);margin:6px 0 0;">
          "병합해서 다운로드"는 Supabase에 '전체 적용됨' 상태로 쌓인 관리자 수정사항을 원본에
          합쳐서 새 <code>data.js</code>를 만들어줘요. 대량 수정 후 한 번씩 이걸로 원본 자체를
          정리해두면 안전해요(다운로드만 될 뿐, 실제 반영은 이 파일로 certs 폴더의 data.js를
          직접 교체해야 해요).
        </p>
        <div style="margin-top:6px;">${questionDataLinks || `<p class="admin-empty" style="padding:8px 0;">등록된 자격증이 없습니다</p>`}</div>
      </div>

      <p class="admin-section-title">📦 소스코드(엔진) 백업</p>
      <div class="admin-table-wrap" style="padding:16px;">
        <p style="font-size:13px;color:var(--muted);margin:0 0 12px;">
          코드는 GitHub에 커밋할 때마다 이미 버전 이력이 남아있어 사실상 자동 백업되고 있어요.
          다만 만약을 위해 4개 저장소를 현재 상태 그대로 ZIP으로 받아둘 수 있습니다.
        </p>
        ${repoLinks}
      </div>
    </div>`;

  document.getElementById("backupBtn").addEventListener("click", (e) => downloadBackup(e.currentTarget));
  document.querySelectorAll(".admin-approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const userId = row.dataset.userId;
      const approve = btn.dataset.action === "approve";
      if (!approve && !confirm("이 가입 신청을 거절할까요? (계정 자체는 삭제되지 않고, 나중에 다시 승인할 수 있어요)")) return;
      const ok = await setApproval(userId, approve, btn);
      if (ok) {
        row.style.opacity = "0.4";
        row.querySelectorAll("button").forEach((b) => (b.disabled = true));
      }
    });
  });
  document.querySelectorAll(".role-select").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const row = sel.closest("tr");
      const userId = row.dataset.userId;
      const newRole = sel.value;
      const editorBox = row.querySelector(".editor-certs-box");
      if (editorBox) editorBox.style.display = newRole === "editor" ? "" : "none";
      sel.disabled = true;
      try {
        const { error } = await supabaseClient.from("profiles").update({ role: newRole }).eq("user_id", userId);
        if (error) throw error;
      } catch (e) {
        alert("등급 변경 실패: " + e.message);
      } finally {
        sel.disabled = false;
      }
    });
  });
  document.querySelectorAll(".editor-cert-chk").forEach((chk) => {
    chk.addEventListener("change", async () => {
      const row = chk.closest("tr");
      const userId = row.dataset.userId;
      const checkedCerts = Array.from(row.querySelectorAll(".editor-cert-chk:checked")).map((el) => el.value);
      chk.disabled = true;
      try {
        const { error } = await supabaseClient.from("profiles").update({ editor_certs: checkedCerts }).eq("user_id", userId);
        if (error) throw error;
      } catch (e) {
        alert("편집 가능 종목 변경 실패: " + e.message);
      } finally {
        chk.disabled = false;
      }
    });
  });
  document.querySelectorAll(".suspend-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const userId = row.dataset.userId;
      const willSuspend = btn.textContent.trim() === "활동 정지";
      if (willSuspend && !confirm("이 계정의 로그인·이용을 정지할까요? (나중에 다시 해제할 수 있어요)")) return;
      btn.disabled = true;
      try {
        const { error } = await supabaseClient.rpc("admin_set_suspended", { target_user_id: userId, suspended: willSuspend });
        if (error) throw error;
        btn.textContent = willSuspend ? "정지 해제" : "활동 정지";
        btn.style.borderColor = willSuspend ? "var(--teal)" : "var(--rose,#c0392b)";
        btn.style.color = willSuspend ? "var(--teal)" : "var(--rose,#c0392b)";
        const nickCell = row.querySelector("td");
        const badge = nickCell.querySelector("span");
        if (willSuspend && !badge) {
          nickCell.insertAdjacentHTML("beforeend", ' <span style="color:var(--rose,#c0392b);font-size:11px;font-weight:800;">[정지중]</span>');
        } else if (!willSuspend && badge) {
          badge.remove();
        }
      } catch (e) {
        alert("처리 실패: " + e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
  document.querySelectorAll(".resetpw-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const email = row.children[1].textContent.trim();
      if (!email || email === "(이메일 없음)") { alert("이메일 정보가 없어서 보낼 수 없어요."); return; }
      if (!confirm(`${email} 주소로 비밀번호 재설정 링크를 보낼까요?\n\n(관리자는 실제 비밀번호를 알 수 없고, 본인만 링크를 눌러 새 비밀번호를 정할 수 있어요)`)) return;
      btn.disabled = true;
      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname.replace(/admin\.html$/, "index.html"),
        });
        if (error) throw error;
        alert(`${email} 주소로 재설정 메일을 보냈어요. 본인이 메일의 링크를 눌러 새 비밀번호를 직접 설정하면 돼요.`);
      } catch (e) {
        alert("전송 실패: " + e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
  document.getElementById("allDataBtn").addEventListener("click", (e) => downloadAllQuestionData(e.currentTarget));
  document.getElementById("mergeDataBtn").addEventListener("click", (e) => downloadMergedQuestionData(e.currentTarget));
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
