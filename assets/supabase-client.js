// 모든 페이지(허브 + 각 자격증 학습 페이지)가 공유하는 Supabase 클라이언트.
// URL과 anon key는 공개되어도 안전한 값입니다 (실제 접근 제어는 DB의 RLS 정책이 담당).
//
// 이 파일을 쓰려면 먼저 아래 스크립트를 이 파일보다 앞에 로드해야 합니다:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

const SUPABASE_URL = "https://fcxpzpdsqwzwaiwhjzqn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_gig8Cm1XRn8CjUZz3goNLQ_N3YrytyL";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
