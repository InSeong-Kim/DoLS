import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../db/supabaseClient";

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

// 인증 필수 라우트에 사용. 토큰이 없거나 Supabase Auth 검증에 실패하면 401.
// 자체 JWT 서명/검증을 하지 않고 supabase.auth.getUser(token)으로 Supabase Auth
// 서버에 직접 질의하므로, 토큰 만료/로그아웃이 즉시 반영됩니다.
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "인증 토큰이 필요합니다." });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "유효하지 않거나 만료된 토큰입니다." });
  }

  req.user = { id: data.user.id, email: data.user.email ?? null };
  next();
}
