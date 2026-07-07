import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabaseClient] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. " +
      "frontend/.env.local 을 확인하세요."
  );
}

// 브라우저용 클라이언트 (anon key). 회원가입/로그인/세션 갱신에 사용합니다.
// 환경변수가 없어도 createClient가 (build 단계 등에서) throw하지 않도록 placeholder로 대체합니다.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
