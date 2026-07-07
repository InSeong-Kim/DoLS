import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../db/supabaseClient";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

// 비로그인 사용자도 접근 가능한 라우트(PubMed 검색 등)에 사용.
// 토큰이 있으면 검증해 req.user를 채우고, 없거나 검증에 실패해도 요청을 막지 않습니다.
// 이 구분으로 검색 결과 개인화 관련성 점수 기능의 on/off를 결정합니다.
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user) {
      req.user = { id: data.user.id, email: data.user.email ?? null };
    }
  } catch {
    // 검증 실패는 조용히 무시하고 비로그인 상태로 취급합니다.
  }
  next();
}
