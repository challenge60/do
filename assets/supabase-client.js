// 모든 페이지(허브 + 각 자격증 학습 페이지)가 공유하는 Supabase 클라이언트.
// URL과 anon key는 공개되어도 안전한 값입니다 (실제 접근 제어는 DB의 RLS 정책이 담당).
//
// 이 파일을 쓰려면 먼저 아래 스크립트를 이 파일보다 앞에 로드해야 합니다:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

const SUPABASE_URL = "https://fcxpzpdsqwzwaiwhjzqn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gig8Cm1XRn8CjUZz3goNLQ_N3YrytyL";

// let(const가 아님) + try/catch로 초기화: CDN 로딩 실패 등으로 window.supabase가 없을 때도
// supabaseClient가 "선언은 됐지만 아직 초기화 전"(TDZ) 상태로 남지 않도록 한다. TDZ 상태에서는
// typeof supabaseClient 체크조차 ReferenceError를 던져서 앱 전체가 멎을 수 있기 때문.
// 실패 시 null로 남겨두고, 이걸 쓰는 코드들은 truthy 체크(`supabaseClient &&`)로 안전하게 우회한다.
let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
} catch (e) {
  console.error("Supabase 클라이언트 초기화 실패(네트워크 문제 등):", e);
}
