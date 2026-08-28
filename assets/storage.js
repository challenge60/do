// lib/storage.js
// app.js는 그대로 두고, 이 파일이 뒤에서 store를 Supabase와 동기화합니다.
//   1) 로그인 안 되어 있으면 → 허브로 돌려보냄 (돌아올 때 이 자격증으로 바로 오도록 next 파라미터 사용)
//   2) 로그인 되어 있으면 → 클라우드에 저장된 학습기록을 불러와 화면에 반영
//   3) 이후 saveStore()가 호출될 때마다(문제 풀이/오답 체크 등) 클라우드에도 저장(디바운스)

(function () {
  const SYNC_DEBOUNCE_MS = 1200;

  function certPathParam() {
    return CERT_ID;
  }

  function goToLoginWithReturn() {
    const here = certPathParam();
    window.location.href = `../../index.html?next=${encodeURIComponent(here)}`;
  }

  // ---------- 작은 동기화 상태 배지 ----------
  let badgeEl = null;
  function ensureBadge() {
    if (badgeEl) return badgeEl;
    badgeEl = document.createElement("div");
    badgeEl.id = "syncBadge";
    badgeEl.style.cssText =
      "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);" +
      "background:#1c2430;color:#fff;font-size:11.5px;padding:5px 12px;" +
      "border-radius:999px;opacity:0;transition:opacity .25s ease;" +
      "pointer-events:none;z-index:9999;letter-spacing:.02em;";
    document.body.appendChild(badgeEl);
    return badgeEl;
  }
  function showBadge(text, autoHide) {
    const el = ensureBadge();
    el.textContent = text;
    el.style.opacity = "1";
    if (autoHide) {
      clearTimeout(showBadge._t);
      showBadge._t = setTimeout(() => { el.style.opacity = "0"; }, 1400);
    }
  }

  // ---------- 클라우드 → 로컬 ----------
  async function pullFromCloud(userId) {
    const { data, error } = await supabaseClient
      .from("user_progress")
      .select("data,updated_at")
      .eq("user_id", userId)
      .eq("cert_id", CERT_ID)
      .maybeSingle();
    if (error) {
      console.warn("클라우드 학습기록을 불러오지 못했어요:", error.message);
      return null;
    }
    return data ? data.data : null;
  }

  // ---------- 로컬 → 클라우드 (디바운스) ----------
  let pushTimer = null;
  function schedulePush(userId) {
    showBadge("동기화 대기 중…");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushToCloud(userId), SYNC_DEBOUNCE_MS);
  }
  async function pushToCloud(userId) {
    showBadge("동기화 중…");
    const { error } = await supabaseClient.from("user_progress").upsert(
      {
        user_id: userId,
        cert_id: CERT_ID,
        data: store,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,cert_id" }
    );
    if (error) {
      console.warn("클라우드 저장 실패:", error.message);
      showBadge("동기화 실패 (다음 저장 때 재시도)", true);
    } else {
      showBadge("동기화 완료", true);
    }
  }

  // ---------- 관리자 수정 오버레이 (전체 사용자 공용) ----------
  // 로그인한 사용자라면 누구나 읽을 수 있음(RLS: authenticated select true).
  // 이 문제를 개인적으로 수정한 적 없는 사용자에게만 화면에 반영됨 (app.js의 withEdits()에서 우선순위 처리).
  async function loadAdminOverrides() {
    try {
      const { data, error } = await supabaseClient
        .from("question_overrides")
        .select("question_id,question,answer,images,tags,unit_major,unit_minor")
        .eq("cert_id", CERT_ID);
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        map[row.question_id] = {
          question: row.question,
          answer: row.answer,
          images: row.images,
          tags: row.tags,
          unitMajor: row.unit_major,
          unitMinor: row.unit_minor,
        };
      });
      window.adminOverrides = map;
    } catch (e) {
      console.warn("관리자 수정사항을 불러오지 못했어요:", e.message);
      window.adminOverrides = {};
    }
  }

  // ---------- 관리자 여부 확인 ----------
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

  // ---------- 회원 등급 확인 (편집자는 관리자처럼 문제 수정 전체 적용 가능) ----------
  async function fetchMemberRole(userId) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? data.role : "general";
    } catch (e) {
      console.warn("회원 등급 확인 실패:", e.message);
      return "general";
    }
  }

  // ---------- 관리자 전용: 문제 수정사항을 전체 사용자 기본값으로 발행 ----------
  window.publishAdminOverride = async function (questionId, payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("로그인이 필요합니다");
    const { error } = await supabaseClient.from("question_overrides").upsert(
      {
        cert_id: CERT_ID,
        question_id: questionId,
        question: payload.question,
        answer: payload.answer,
        images: payload.images,
        tags: payload.tags,
        unit_major: payload.unitMajor,
        unit_minor: payload.unitMinor,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      },
      { onConflict: "cert_id,question_id" }
    );
    if (error) throw error;
    // 방금 발행한 내용을 즉시 로컬 오버레이에도 반영 (재접속 없이 바로 확인 가능하도록)
    if (!window.adminOverrides) window.adminOverrides = {};
    window.adminOverrides[questionId] = { ...payload };
  };

  // ---------- 로그아웃 후에도 화면이 남아있는 문제 방지 ----------
  // 브라우저 "뒤로가기"로 이 페이지에 돌아오면, 크롬 등이 페이지를 새로 불러오지 않고
  // 캐시된 화면(bfcache)을 그대로 복원하는 경우가 있다. 그러면 이 파일의 init() 코드가
  // 다시 실행되지 않아 로그아웃 여부를 재확인하지 못하고, 로그아웃 전 화면(문항 데이터 등)이
  // 그대로 남아있게 된다. pageshow(bfcache 복원 시 event.persisted===true로 발생)와
  // 화면이 다시 보이는 시점(visibilitychange)마다 세션을 다시 확인해서, 로그아웃 상태라면
  // 즉시 로그인 화면으로 돌려보낸다.
  async function recheckSessionOrRedirect() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) goToLoginWithReturn();
    } catch (e) {
      // 세션 확인 자체가 실패하면(네트워크 오류 등) 안전한 쪽으로 판단해 로그인 화면으로 보낸다
      goToLoginWithReturn();
    }
  }
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) recheckSessionOrRedirect();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recheckSessionOrRedirect();
  });

  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      goToLoginWithReturn();
      return;
    }
    const userId = session.user.id;

    // 0) 관리자 수정 오버레이를 먼저 불러와 둔다 (모든 로그인 사용자 대상)
    await loadAdminOverrides();
    window.isAdmin = await checkIsAdmin(userId);
    const memberRole = await fetchMemberRole(userId);
    // '문제 수정 전체 적용' 기능은 관리자뿐 아니라 편집자 등급도 사용 가능
    window.canPublishOverride = window.isAdmin || memberRole === "editor" || memberRole === "admin";

    // 1) 클라우드 기록 반영 (있으면 로컬보다 우선 — 다른 기기에서 이어 학습하는 경우 대비)
    const cloud = await pullFromCloud(userId);
    if (cloud) {
      store = cloud;
      if (!store.edits) store.edits = {};
      if (!("examConfig" in store)) store.examConfig = null;
      if (!store.setRepeats) store.setRepeats = {};
      saveStore(); // 로컬 캐시도 최신화
      if (typeof render === "function") render();
      showBadge("클라우드 학습기록을 불러왔어요", true);
    } else {
      // 이 자격증은 이 계정으로 처음 여는 것 → 지금 로컬(비어있거나 이전 게스트 기록)을 클라우드에 올림
      pushToCloud(userId);
    }
    if (typeof render === "function") render(); // adminOverrides 반영을 위해 한 번 더 갱신

    // 2) 이후 저장(saveStore)마다 클라우드에도 반영
    const originalSaveStore = saveStore;
    saveStore = function () {
      const ok = originalSaveStore();
      if (ok) schedulePush(userId);
      return ok;
    };

    // 3) 다른 기기/탭에서 로그아웃하면 이 탭도 로그인 화면으로
    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") goToLoginWithReturn();
    });
  }

  init();
})();
