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

  async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      goToLoginWithReturn();
      return;
    }
    const userId = session.user.id;

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
