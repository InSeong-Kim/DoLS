import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. " +
      "backend/.env 를 확인하세요."
  );
}

// 서버 전용 클라이언트: Service Role Key로 RLS를 우회합니다.
// 반드시 authMiddleware/optionalAuthMiddleware에서 검증한 user_id로
// 애플리케이션 레벨 필터링을 수행해야 합니다.
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceRoleKey || "placeholder-service-role-key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
