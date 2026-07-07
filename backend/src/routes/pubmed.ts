import { Router } from "express";
import { optionalAuthMiddleware } from "../middlewares/optionalAuthMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import { searchPubmed, PubmedArticle } from "../services/pubmedService";
import { HttpError } from "../middlewares/errorHandler";

export const pubmedRouter = Router();

interface SearchRequestBody {
  keyword?: string;
  retmax?: number;
  sort?: "relevance" | "date";
  author?: string;
  year?: string;
  journal?: string;
  forceRefresh?: boolean;
}

function clampRetmax(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "10"), 10);
  if (Number.isNaN(n)) return 10;
  return Math.min(30, Math.max(5, n));
}

function rowToArticle(row: any): PubmedArticle {
  return {
    pmid: row.pmid,
    title: row.title,
    authors: Array.isArray(row.authors) ? row.authors : [],
    journal: row.journal ?? "",
    pubYear: row.pub_year ?? null,
    abstract: row.abstract ?? "",
  };
}

// PubMed 검색 (비로그인 사용자도 사용 가능한 공개 캐시 성격의 엔드포인트).
// optionalAuthMiddleware로 로그인 여부만 구분하며, 로그인 여부 자체는 이
// 라우트의 동작(결과 반환)에는 영향을 주지 않고 /api/summarize의 개인화에 쓰입니다.
pubmedRouter.post("/search", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const body = req.body as SearchRequestBody;
    const keyword = (body.keyword ?? "").trim();
    if (!keyword) {
      throw new HttpError(400, "검색 키워드를 입력하세요.");
    }

    const retmax = clampRetmax(body.retmax);
    const sort = body.sort === "date" ? "date" : "relevance";
    const hasFilters = Boolean(body.author || body.year || body.journal);
    const forceRefresh = Boolean(body.forceRefresh);

    let articles: PubmedArticle[] = [];
    let fromCache = false;

    if (!forceRefresh && !hasFilters) {
      const { data } = await supabaseAdmin
        .from("search_results")
        .select("pmid, title, authors, journal, pub_year, abstract")
        .eq("keyword", keyword)
        .order("search_date", { ascending: false })
        .limit(retmax);

      if (data && data.length > 0) {
        articles = data.map(rowToArticle);
        fromCache = true;
      }
    }

    if (!fromCache) {
      articles = await searchPubmed({
        keyword,
        retmax,
        sort,
        author: body.author,
        year: body.year,
        journal: body.journal,
      });

      if (articles.length > 0) {
        const rows = articles.map((a) => ({
          keyword,
          pmid: a.pmid,
          title: a.title,
          authors: a.authors,
          journal: a.journal,
          pub_year: a.pubYear,
          abstract: a.abstract,
        }));
        // 캐시 저장 실패는 검색 결과 반환을 막지 않습니다.
        await supabaseAdmin.from("search_results").insert(rows);
      }
    }

    res.json({ articles, fromCache });
  } catch (err) {
    next(err);
  }
});
