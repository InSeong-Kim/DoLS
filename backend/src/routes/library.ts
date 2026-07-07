import { Router, Request } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import { HttpError } from "../middlewares/errorHandler";

export const libraryRouter = Router();

const PAPERS_BUCKET = "papers";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// 프론트엔드 검증은 우회 가능하므로 서버 측에서도 PDF/20MB 제한을 강제합니다.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new HttpError(400, "PDF 파일만 업로드할 수 있습니다."));
      return;
    }
    cb(null, true);
  },
});

function getFrontendBaseUrl(req: Request): string {
  const origin = req.headers.origin;
  if (origin && typeof origin === "string") return origin;
  const configured = (process.env.CORS_ORIGINS ?? "").split(",")[0]?.trim();
  return configured || "http://localhost:3000";
}

// ---------------------------------------------------------------------
// 업로드한 PDF (uploaded_papers)
// ---------------------------------------------------------------------

libraryRouter.post("/upload", authMiddleware, (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(new HttpError(413, "파일 크기는 20MB를 초과할 수 없습니다."));
      }
      return next(err instanceof HttpError ? err : new HttpError(400, "파일 업로드에 실패했습니다."));
    }

    try {
      const file = req.file;
      if (!file) throw new HttpError(400, "업로드할 파일(file)이 필요합니다.");

      // multer/busboy는 multipart 파일명을 기본적으로 latin1로 디코딩하므로
      // 한글 등 비ASCII 파일명이 깨집니다. utf8로 다시 디코딩해야 합니다.
      const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");

      // Storage 객체 키는 한글/공백을 허용하지 않으므로 ASCII로만 구성합니다.
      // 화면에 보여줄 원본 파일명(originalName, 한글 포함)은 DB의 filename 컬럼에 그대로 저장합니다.
      const sanitized = originalName.replace(/[^\w.-]/g, "_");
      const storagePath = `${req.user!.id}/${Date.now()}_${sanitized}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(PAPERS_BUCKET)
        .upload(storagePath, file.buffer, { contentType: "application/pdf" });

      if (uploadError) throw new HttpError(500, `Storage 업로드 실패: ${uploadError.message}`);

      const { data, error } = await supabaseAdmin
        .from("uploaded_papers")
        .insert({
          user_id: req.user!.id,
          filename: originalName,
          storage_path: storagePath,
          related_keyword: req.body?.related_keyword ?? null,
          memo: req.body?.memo ?? null,
        })
        .select("*")
        .single();

      if (error) throw new HttpError(500, error.message);
      res.status(201).json(data);
    } catch (e) {
      next(e);
    }
  });
});

libraryRouter.get("/uploads", authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("uploaded_papers")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("upload_date", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

libraryRouter.get("/uploads/:id/download", authMiddleware, async (req, res, next) => {
  try {
    const { data: row, error } = await supabaseAdmin
      .from("uploaded_papers")
      .select("storage_path, user_id")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!row || row.user_id !== req.user!.id) throw new HttpError(404, "파일을 찾을 수 없습니다.");

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(PAPERS_BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);

    if (signError || !signed) throw new HttpError(500, "다운로드 URL 생성에 실패했습니다.");
    res.json({ url: signed.signedUrl });
  } catch (err) {
    next(err);
  }
});

libraryRouter.delete("/uploads/:id", authMiddleware, async (req, res, next) => {
  try {
    const { data: row, error } = await supabaseAdmin
      .from("uploaded_papers")
      .select("storage_path, user_id")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!row || row.user_id !== req.user!.id) throw new HttpError(404, "파일을 찾을 수 없습니다.");

    await supabaseAdmin.storage.from(PAPERS_BUCKET).remove([row.storage_path]);

    const { error: deleteError } = await supabaseAdmin
      .from("uploaded_papers")
      .delete()
      .eq("id", req.params.id);

    if (deleteError) throw new HttpError(500, deleteError.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------
// 저장한 PubMed 논문 목록 (saved_papers) — uploaded_papers 와 별개, 공유 대상 아님
// ---------------------------------------------------------------------

libraryRouter.post("/saved-papers", authMiddleware, async (req, res, next) => {
  try {
    const { pmid, title, authors, journal, pub_year, abstract } = req.body ?? {};
    if (!pmid || !title) throw new HttpError(400, "pmid, title이 필요합니다.");

    const { data: existing } = await supabaseAdmin
      .from("saved_papers")
      .select("*")
      .eq("user_id", req.user!.id)
      .eq("pmid", pmid)
      .maybeSingle();

    if (existing) return res.json(existing);

    const { data, error } = await supabaseAdmin
      .from("saved_papers")
      .insert({
        user_id: req.user!.id,
        pmid,
        title,
        authors: authors ?? [],
        journal: journal ?? null,
        pub_year: pub_year ?? null,
        abstract: abstract ?? null,
      })
      .select("*")
      .single();

    if (error) throw new HttpError(500, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

libraryRouter.get("/saved-papers", authMiddleware, async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from("saved_papers")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("saved_date", { ascending: false });

    const filter = String(req.query.filter ?? "all");
    if (filter === "read") query = query.eq("is_read", true);
    if (filter === "unread") query = query.eq("is_read", false);

    const { data, error } = await query;
    if (error) throw new HttpError(500, error.message);
    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

libraryRouter.patch("/saved-papers/:id", authMiddleware, async (req, res, next) => {
  try {
    const { memo, tags, is_read } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (memo !== undefined) patch.memo = memo;
    if (tags !== undefined) patch.tags = tags;
    if (is_read !== undefined) patch.is_read = is_read;

    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "수정할 필드(memo, tags, is_read)가 없습니다.");
    }

    const { data, error } = await supabaseAdmin
      .from("saved_papers")
      .update(patch)
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("*")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "저장된 논문을 찾을 수 없습니다.");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

libraryRouter.delete("/saved-papers/:id", authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("saved_papers")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user!.id)
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "저장된 논문을 찾을 수 없습니다.");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------
// PDF 라이브러리 공유 링크 (library_shares) — saved_papers 와 무관, uploaded_papers 만 노출
// ---------------------------------------------------------------------

libraryRouter.post("/share", authMiddleware, async (req, res, next) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from("library_shares")
      .select("*")
      .eq("user_id", req.user!.id)
      .maybeSingle();

    let token = existing?.share_token;

    if (existing) {
      const { error } = await supabaseAdmin
        .from("library_shares")
        .update({ is_enabled: true })
        .eq("user_id", req.user!.id);
      if (error) throw new HttpError(500, error.message);
    } else {
      token = randomUUID();
      const { error } = await supabaseAdmin
        .from("library_shares")
        .insert({ user_id: req.user!.id, share_token: token, is_enabled: true });
      if (error) throw new HttpError(500, error.message);
    }

    const shareUrl = `${getFrontendBaseUrl(req)}/shared/${token}`;
    res.json({ token, shareUrl });
  } catch (err) {
    next(err);
  }
});

libraryRouter.delete("/share", authMiddleware, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("library_shares")
      .update({ is_enabled: false })
      .eq("user_id", req.user!.id)
      .select("id")
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!data) throw new HttpError(404, "활성화된 공유 링크가 없습니다.");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 공개 엔드포인트: 인증 미들웨어를 적용하지 않습니다. 토큰 자체가 접근 권한입니다.
// 반드시 Service Role Key(supabaseAdmin)로만 조회하며, saved_papers는 절대 포함하지 않습니다.
libraryRouter.get("/shared/:token", async (req, res, next) => {
  try {
    const { data: share, error } = await supabaseAdmin
      .from("library_shares")
      .select("user_id, is_enabled")
      .eq("share_token", req.params.token)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    if (!share || !share.is_enabled) {
      throw new HttpError(404, "공유가 종료되었거나 존재하지 않는 링크입니다.");
    }

    const { data: files, error: filesError } = await supabaseAdmin
      .from("uploaded_papers")
      .select("id, filename, storage_path, upload_date")
      .eq("user_id", share.user_id)
      .order("upload_date", { ascending: false });

    if (filesError) throw new HttpError(500, filesError.message);

    const filesWithUrls = await Promise.all(
      (files ?? []).map(async (f) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(PAPERS_BUCKET)
          .createSignedUrl(f.storage_path, 60 * 60);
        return {
          filename: f.filename,
          upload_date: f.upload_date,
          downloadUrl: signed?.signedUrl ?? null,
        };
      })
    );

    res.json({ files: filesWithUrls });
  } catch (err) {
    next(err);
  }
});
