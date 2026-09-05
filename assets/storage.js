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
        .select("question_id,question,answer,images,tags,unit_major,unit_minor,year,round,no,points")
        .eq("cert_id", CERT_ID);
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        // 값이 실제로 채워진 필드만 포함한다. DB에는 컬럼이 NULL로 남아있을 수 있는데
        // (예: "출제 정보만" 발행하고 question/answer는 손댄 적 없는 경우), 여기서
        // question:null 같은 값을 넣어버리면 withEdits()의 스프레드 병합이 원본 문제
        // 텍스트를 null로 덮어써서 화면에서 문제가 사라져 보이는 심각한 버그가 생긴다.
        const entry = {};
        if (row.question != null) entry.question = row.question;
        if (row.answer != null) entry.answer = row.answer;
        if (row.images != null) entry.images = row.images;
        if (row.tags != null) entry.tags = row.tags;
        if (row.unit_major != null) entry.unitMajor = row.unit_major;
        if (row.unit_minor != null) entry.unitMinor = row.unit_minor;
        if (row.year != null) entry.year = row.year;
        if (row.round != null) entry.round = row.round;
        if (row.no != null) entry.no = row.no;
        if (row.points != null) entry.points = row.points;
        map[row.question_id] = entry;
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

  // ---------- 회원 등급 확인 (편집자는 지정된 종목에 한해 문제 수정 전체 적용 가능) ----------
  async function fetchMemberRoleInfo(userId) {
    try {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("role, editor_certs")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? { role: data.role, editorCerts: data.editor_certs || [] } : { role: "general", editorCerts: [] };
    } catch (e) {
      console.warn("회원 등급 확인 실패:", e.message);
      return { role: "general", editorCerts: [] };
    }
  }

  // ---------- 관리자 전용: 문제 수정사항을 전체 사용자 기본값으로 발행 ----------
  window.publishAdminOverride = async function (questionId, payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error("로그인이 필요합니다");
    // payload가 문제/정답 등 전체 필드를 담고 있을 수도, "출제 정보 수정" 팝업처럼
    // year/round/no/points만 담고 있을 수도 있다. 기존에 발행된 값이 있다면 먼저
    // 가져와서 병합한 뒤 upsert해야, 부분 수정이 나머지 필드를 null로 지워버리는
    // 사고를 막을 수 있다.
    const { data: existingRows } = await supabaseClient
      .from("question_overrides")
      .select("question,answer,images,tags,unit_major,unit_minor,year,round,no,points")
      .eq("cert_id", CERT_ID)
      .eq("question_id", questionId)
      .maybeSingle();
    const existing = existingRows || {};
    const merged = {
      question: payload.question !== undefined ? payload.question : existing.question,
      answer: payload.answer !== undefined ? payload.answer : existing.answer,
      images: payload.images !== undefined ? payload.images : existing.images,
      tags: payload.tags !== undefined ? payload.tags : existing.tags,
      unit_major: payload.unitMajor !== undefined ? payload.unitMajor : existing.unit_major,
      unit_minor: payload.unitMinor !== undefined ? payload.unitMinor : existing.unit_minor,
      year: payload.year !== undefined ? payload.year : existing.year,
      round: payload.round !== undefined ? payload.round : existing.round,
      no: payload.no !== undefined ? payload.no : existing.no,
      points: payload.points !== undefined ? payload.points : existing.points,
    };
    const { error } = await supabaseClient.from("question_overrides").upsert(
      {
        cert_id: CERT_ID,
        question_id: questionId,
        ...merged,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      },
      { onConflict: "cert_id,question_id" }
    );
    if (error) throw error;
    // 방금 발행한 내용을 즉시 로컬 오버레이에도 반영 (재접속 없이 바로 확인 가능하도록)
    if (!window.adminOverrides) window.adminOverrides = {};
    const prevLocal = window.adminOverrides[questionId] || {};
    const nextLocal = { ...prevLocal };
    // merged.question 등이 undefined면(=이번에도 이전에도 값이 없었던 필드) 키 자체를
    // 넣지 않는다. { question: undefined, ... }처럼 객체에 명시적으로 undefined를
    // 넣으면, withEdits()의 스프레드 병합({...q, ...adminOv})이 "값이 없다"가 아니라
    // "값을 undefined/null로 덮어써라"로 동작해서 원래 있던 문제/정답 텍스트가 화면에서
    // 그대로 사라져버린다. 방금 이 버그로 실제 화면이 깨졌었다.
    // (1차 수정 때는 undefined만 걸렀는데, 두 번째로 같은 문제를 또 수정할 때는
    // DB에서 다시 읽어온 기존값이 undefined가 아니라 이미 null이라서 그대로 통과돼
    // 버렸다 — null도 함께 걸러야 한다)
    const setIfDefined = (key, value) => { if (value != null) nextLocal[key] = value; };
    setIfDefined("question", merged.question);
    setIfDefined("answer", merged.answer);
    setIfDefined("images", merged.images);
    setIfDefined("tags", merged.tags);
    setIfDefined("unitMajor", merged.unit_major);
    setIfDefined("unitMinor", merged.unit_minor);
    setIfDefined("year", merged.year);
    setIfDefined("round", merged.round);
    setIfDefined("no", merged.no);
    setIfDefined("points", merged.points);
    window.adminOverrides[questionId] = nextLocal;
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

    // 0) 승인 여부를 이 페이지에서 직접 다시 확인한다.
    //    허브 화면의 내비게이션 차단만으로는 URL 직접 접근·뒤로가기·공유링크·가입 직후
    //    타이밍(레이스 컨디션)으로 우회될 수 있으므로, 실제 데이터를 읽고 쓰는 이 지점에서
    //    최종적으로 한 번 더 막아야 안전하다.
    try {
      const { data: profileRow } = await supabaseClient
        .from("profiles")
        .select("approved")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileRow && profileRow.approved === false) {
        window.location.href = "../../index.html";
        return;
      }
    } catch (e) {
      console.warn("승인 여부 확인 실패 — 허브로 돌려보냅니다:", e.message);
      window.location.href = "../../index.html";
      return;
    }

    // 0-1) 이 브라우저에 남아있는 로컬 학습기록이 지금 로그인한 사람 것이 맞는지 확인한다.
    //    같은 기기에서 계정을 바꿔가며 로그인하면(예: 관리자로 쓰다가 로그아웃 후 다른 계정으로
    //    가입), 로컬 저장소(LS_KEY)는 기기+자격증 단위라 계정이 구분되지 않는다. 그 상태로
    //    두면 (a) 화면에 남의 진도가 잠깐 보이는 것뿐 아니라 (b) 아래에서 클라우드에 처음
    //    올릴 때 그 남의 진도를 이번 계정 기록으로 그대로 업로드해버리는 심각한 데이터
    //    오염이 생긴다. 그래서 소유자가 다르면 완전히 새로 시작한다.
    if (store.__ownerUserId && store.__ownerUserId !== userId) {
      store = blankStore();
      saveStore();
    }

    // 1) 관리자 수정 오버레이를 먼저 불러와 둔다 (모든 로그인 사용자 대상)
    await loadAdminOverrides();
    window.isAdmin = await checkIsAdmin(userId);
    const memberRoleInfo = await fetchMemberRoleInfo(userId);
    // '문제 수정 전체 적용' 기능: 관리자는 항상 가능, 편집자는 이 자격증(CERT_ID)이
    // 본인의 editor_certs 목록에 포함되어 있을 때만 가능 (종목별 편집 권한)
    window.canPublishOverride = window.isAdmin
      || memberRoleInfo.role === "admin"
      || (memberRoleInfo.role === "editor" && typeof CERT_ID !== "undefined" && memberRoleInfo.editorCerts.includes(CERT_ID));

    // 1) 클라우드 기록 반영 (있으면 로컬보다 우선 — 다른 기기에서 이어 학습하는 경우 대비)
    const cloud = await pullFromCloud(userId);
    if (cloud) {
      store = cloud;
      if (!store.edits) store.edits = {};
      if (!("examConfig" in store)) store.examConfig = null;
      if (!store.setRepeats) store.setRepeats = {};
      store.__ownerUserId = userId;
      saveStore(); // 로컬 캐시도 최신화
      if (typeof render === "function") render();
      showBadge("클라우드 학습기록을 불러왔어요", true);
    } else {
      // 이 자격증은 이 계정으로 처음 여는 것 → 지금 로컬(비어있음 — 위에서 소유자 다르면
      // 이미 초기화됨)을 이 계정 소유로 표시하고 클라우드에 올림
      store.__ownerUserId = userId;
      saveStore();
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
