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

    // 캐시는 정렬 방식을 구분해 저장하지 않으므로, "최신순"은 정의상 캐시를 쓰지 않고
    // 항상 PubMed에서 새로 가져옵니다 (그렇지 않으면 예전 "관련도순" 캐시가 그대로 반환됨).
    if (!forceRefresh && !hasFilters && sort !== "date") {
      const { data } = await supabaseAdmin
        .from("search_results")
        .select("pmid, title, authors, journal, pub_year, abstract")
        .eq("keyword", keyword)
        .order("search_date", { ascending: false })
        .limit(retmax);

      if (data && data.length > 0) {
        // 과거에 같은 키워드로 여러 번 검색해 캐시에 중복 pmid가 쌓여있을 수 있으므로
        // 읽을 때도 한 번 더 방어적으로 중복을 제거합니다(최근 것 우선).
        const seen = new Set<string>();
        const deduped = data.filter((row) => {
          if (seen.has(row.pmid)) return false;
          seen.add(row.pmid);
          return true;
        });
        articles = deduped.map(rowToArticle);
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
        // 이미 캐시된 pmid는 다시 넣지 않아 search_results에 중복이 쌓이는 것을 막습니다.
        const { data: existing } = await supabaseAdmin
          .from("search_results")
          .select("pmid")
          .eq("keyword", keyword)
          .in(
            "pmid",
            articles.map((a) => a.pmid)
          );
        const existingPmids = new Set((existing ?? []).map((r) => r.pmid));

        const rows = articles
          .filter((a) => !existingPmids.has(a.pmid))
          .map((a) => ({
            keyword,
            pmid: a.pmid,
            title: a.title,
            authors: a.authors,
            journal: a.journal,
            pub_year: a.pubYear,
            abstract: a.abstract,
          }));

        // 캐시 저장 실패는 검색 결과 반환을 막지 않습니다.
        if (rows.length > 0) {
          await supabaseAdmin.from("search_results").insert(rows);
        }
      }
    }

    res.json({ articles, fromCache });
  } catch (err) {
    next(err);
  }
});
