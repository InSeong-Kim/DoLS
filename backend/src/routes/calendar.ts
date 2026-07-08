import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import { HttpError } from "../middlewares/errorHandler";

export const calendarRouter = Router();

interface EventBody {
  title?: string;
  description?: string | null;
  start_datetime?: string;
  end_datetime?: string | null;
  is_all_day?: boolean;
  uploaded_paper_id?: string | null;
}

// uploaded_paper_id로 다른 사람의 업로드 파일을 몰래 연결하지 못하도록,
// 넘어온 id가 실제로 이 사용자 소유인지 확인합니다.
async function assertOwnsUpload(userId: string, uploadedPaperId: string) {
  const { data } = await supabaseAdmin
    .from("uploaded_papers")
    .select("id")
    .eq("id", uploadedPaperId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new HttpError(404, "연결하려는 업로드 파일을 찾을 수 없습니다.");
}

calendarRouter.get("/events", authMiddleware, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) throw new HttpError(400, "from, to 쿼리 파라미터가 필요합니다.");

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .select("*, uploaded_papers(id, filename)")
      .eq("user_id", req.user!.id)
      .gte("start_datetime", String(from))
      .lte("start_datetime", String(to))
      .order("start_datetime", { ascending: true });

    if (error) throw new HttpError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

calendarRouter.post("/events", authMiddleware, async (req, res, next) => {
  try {
    const body = req.body as EventBody;
    const title = (body.title ?? "").trim();
    if (!title) throw new HttpError(400, "title이 필요합니다.");
    if (!body.start_datetime) throw new HttpError(400, "start_datetime이 필요합니다.");
    if (body.uploaded_paper_id) await assertOwnsUpload(req.user!.id, body.uploaded_paper_id);

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .insert({
        user_id: req.user!.id,
        title,
        description: body.description ?? null,
        start_datetime: body.start_datetime,
        end_datetime: body.end_datetime ?? null,
        is_all_day: Boolean(body.is_all_day),
        uploaded_paper_id: body.uploaded_paper_id ?? null,
      })
      .select("*, uploaded_papers(id, filename)")
      .single();

    if (error) throw new HttpError(500, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

calendarRouter.patch("/events/:id", authMiddleware, async (req, res, next) => {
  try {
    const body = req.body as EventBody;
    const patch: Record<string, unknown> = {};
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.description !== undefined) patch.description = body.description;
    if (body.start_datetime !== undefined) patch.start_datetime = body.start_datetime;
    if (body.end_datetime !== undefined) patch.end_datetime = body.end_datetime;
    if (body.is_all_day !== undefined) patch.is_all_day = body.is_all_day;
    if (body.uploaded_paper_id !== undefined) {
      if (body.uploaded_paper_id) await assertOwnsUpload(req.user!.id, body.uploaded_paper_id);
      patch.uploaded_paper_id = body.uploaded_paper_id;
    }

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "수정할 필드가 없습니다.");
    }

    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .update(patch)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("*, uploaded_papers(id, filename)")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "일정을 찾을 수 없습니다.");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

calendarRouter.delete("/events/:id", authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("calendar_events")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "일정을 찾을 수 없습니다.");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
