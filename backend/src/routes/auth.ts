import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import { HttpError } from "../middlewares/errorHandler";

export const authRouter = Router();

// 내 정보 조회 (인증 미들웨어 동작 확인 용도로도 사용)
authRouter.get("/me", authMiddleware, async (req, res) => {
  res.json({ id: req.user!.id, email: req.user!.email });
});

// 연구 관심사 조회
authRouter.get("/profile", authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("research_interest, updated_date")
      .eq("user_id", req.user!.id)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);

    res.json({
      research_interest: data?.research_interest ?? null,
      updated_date: data?.updated_date ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// 연구 관심사 수정 (없으면 생성)
authRouter.put("/profile", authMiddleware, async (req, res, next) => {
  try {
    const { research_interest } = req.body ?? {};
    if (research_interest !== null && typeof research_interest !== "string") {
      throw new HttpError(400, "research_interest는 문자열 또는 null이어야 합니다.");
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: req.user!.id,
          research_interest: research_interest ?? null,
          updated_date: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("research_interest, updated_date")
      .single();

    if (error) throw new HttpError(500, error.message);

    res.json(data);
  } catch (err) {
    next(err);
  }
});
