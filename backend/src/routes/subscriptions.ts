import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import { searchPubmed } from "../services/pubmedService";
import { HttpError } from "../middlewares/errorHandler";

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authMiddleware);

// 구독 등록 (이미 구독 중이면 그대로 반환)
subscriptionsRouter.post("/", async (req, res, next) => {
  try {
    const keyword = String(req.body?.keyword ?? "").trim();
    if (!keyword) throw new HttpError(400, "keyword가 필요합니다.");

    const { data: existing } = await supabaseAdmin
      .from("keyword_subscriptions")
      .select("*")
      .eq("user_id", req.user!.id)
      .eq("keyword", keyword)
      .maybeSingle();

    if (existing) return res.json(existing);

    const { data, error } = await supabaseAdmin
      .from("keyword_subscriptions")
      .insert({ user_id: req.user!.id, keyword, last_checked_date: new Date().toISOString() })
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// 구독 키워드 목록
subscriptionsRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("keyword_subscriptions")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_date", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

// 구독 키워드마다 last_checked_date 이후 발행된 신규 논문을 요청 시점에 계산.
// 별도 스케줄러/이메일 발송 없이, 사용자가 접속했을 때만 확인합니다.
subscriptionsRouter.get("/check", async (req, res, next) => {
  try {
    const { data: subs, error } = await supabaseAdmin
      .from("keyword_subscriptions")
      .select("*")
      .eq("user_id", req.user!.id);

    if (error) throw new HttpError(500, error.message);

    const results = await Promise.all(
      (subs ?? []).map(async (sub) => {
        const lastCheckedYear = new Date(sub.last_checked_date).getFullYear();
        let newArticles: Awaited<ReturnType<typeof searchPubmed>> = [];
        try {
          const articles = await searchPubmed({
            keyword: sub.keyword,
            retmax: 20,
            sort: "date",
          });
          newArticles = articles.filter(
            (a) => a.pubYear !== null && a.pubYear >= lastCheckedYear
          );
        } catch {
          // 개별 키워드 조회 실패는 다른 키워드 확인을 막지 않습니다.
          newArticles = [];
        }
        return { subscription: sub, newArticles };
      })
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// 새 논문 목록 확인 표시 -> last_checked_date 갱신
subscriptionsRouter.post("/:id/ack", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("keyword_subscriptions")
      .update({ last_checked_date: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("*")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "구독을 찾을 수 없습니다.");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 구독 해제
subscriptionsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("keyword_subscriptions")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "구독을 찾을 수 없습니다.");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
