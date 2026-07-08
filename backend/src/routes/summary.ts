import { Router } from "express";
import { optionalAuthMiddleware } from "../middlewares/optionalAuthMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware";
import { supabaseAdmin } from "../db/supabaseClient";
import {
  summarizeLiterature,
  askAboutPaper,
  analyzeSinglePaper,
  explainTerm,
  SummaryResult,
  PaperAnalysisResult,
} from "../services/llmService";
import { PubmedArticle } from "../services/pubmedService";
import { HttpError } from "../middlewares/errorHandler";

export const summaryRouter = Router();

interface SummarizeRequestBody {
  keyword?: string;
  articles?: PubmedArticle[];
  forceRefresh?: boolean;
}

function rowToSummary(row: any): SummaryResult {
  const result: SummaryResult = {
    trend_summary: row.trend_summary ?? "",
    key_technologies: Array.isArray(row.key_technologies) ? row.key_technologies : [],
    frequent_genes: Array.isArray(row.frequent_genes) ? row.frequent_genes : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    future_directions: row.future_directions ?? "",
  };
  if (Array.isArray(row.paper_relevance)) result.paper_relevance = row.paper_relevance;
  return result;
}

function sortedPmidsOf(articles: PubmedArticle[]): string[] {
  return articles.map((a) => a.pmid).sort();
}

function sameArticleSet(cachedPmids: unknown, currentSortedPmids: string[]): boolean {
  if (!Array.isArray(cachedPmids)) return false;
  if (cachedPmids.length !== currentSortedPmids.length) return false;
  const sorted = [...cachedPmids].sort();
  return sorted.every((pmid, i) => pmid === currentSortedPmids[i]);
}

function rowToPaperAnalysis(row: any): PaperAnalysisResult {
  return {
    key_technologies: Array.isArray(row.key_technologies) ? row.key_technologies : [],
    frequent_genes: Array.isArray(row.frequent_genes) ? row.frequent_genes : [],
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    future_directions: row.future_directions ?? "",
  };
}

// AI 요약. 로그인 상태이고 profiles.research_interest가 채워져 있으면
// 논문별 개인화 관련성(paper_relevance)을 함께 요청합니다.
// 캐시는 (키워드 + 연구관심사) 조합으로 찾되, 그때 요약한 논문 목록(PMID 집합)이
// 지금 검색된 목록과 다르면(= 새 논문이 섞여 들어왔으면) 캐시를 쓰지 않고 새로
// 계산합니다. 그래야 새로고침을 누르지 않아도 새 논문이 있을 땐 자동으로 반영되고,
// 없을 땐(=논문 목록이 그대로면) AI를 다시 호출하지 않아 매번 결과가 흔들리지 않습니다.
summaryRouter.post("/summarize", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const body = req.body as SummarizeRequestBody;
    const keyword = (body.keyword ?? "").trim();
    const articles = body.articles ?? [];

    if (!keyword) throw new HttpError(400, "keyword가 필요합니다.");
    if (!Array.isArray(articles) || articles.length === 0) {
      throw new HttpError(400, "요약할 논문 목록(articles)이 필요합니다.");
    }

    let researchInterest: string | null = null;
    if (req.user) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("research_interest")
        .eq("user_id", req.user.id)
        .maybeSingle();
      researchInterest = data?.research_interest ?? null;
    }
    const personalize = Boolean(researchInterest && researchInterest.trim());
    const currentPmids = sortedPmidsOf(articles);

    if (!body.forceRefresh) {
      let query = supabaseAdmin.from("summaries").select("*").eq("keyword", keyword);
      query = personalize ? query.eq("research_interest", researchInterest) : query.is("research_interest", null);
      const { data } = await query.order("created_date", { ascending: false }).limit(1).maybeSingle();

      if (data && sameArticleSet(data.pmids, currentPmids)) {
        return res.json({ summary: rowToSummary(data), fromCache: true });
      }
    }

    const summary = await summarizeLiterature(keyword, articles, researchInterest);

    await supabaseAdmin.from("summaries").insert({
      keyword,
      research_interest: personalize ? researchInterest : null,
      pmids: currentPmids,
      trend_summary: summary.trend_summary,
      key_technologies: summary.key_technologies,
      frequent_genes: summary.frequent_genes,
      keywords: summary.keywords,
      future_directions: summary.future_directions,
      paper_relevance: summary.paper_relevance ?? null,
    });

    res.json({ summary, fromCache: false });
  } catch (err) {
    next(err);
  }
});

// 논문 카드에서 "AI 분석 보기"를 눌렀을 때, 그 논문 한 편의 초록만 근거로
// 핵심 기술/유전자/키워드/향후 방향을 온디맨드로 분석합니다(검색 목록 전체를
// 미리 다 분석하지 않고, 사용자가 실제로 펼쳐본 논문만 계산합니다).
summaryRouter.post("/summary/paper", async (req, res, next) => {
  try {
    const body = req.body as PubmedArticle;
    if (!body?.pmid || !body?.title) {
      throw new HttpError(400, "pmid, title이 필요합니다.");
    }

    const { data: cached } = await supabaseAdmin
      .from("paper_analyses")
      .select("*")
      .eq("pmid", body.pmid)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return res.json({ analysis: rowToPaperAnalysis(cached), fromCache: true });
    }

    const analysis = await analyzeSinglePaper({
      pmid: body.pmid,
      title: body.title,
      authors: Array.isArray(body.authors) ? body.authors : [],
      journal: body.journal ?? "",
      pubYear: body.pubYear ?? null,
      abstract: body.abstract ?? "",
      pubDate: null,
    });

    await supabaseAdmin.from("paper_analyses").insert({
      pmid: body.pmid,
      key_technologies: analysis.key_technologies,
      frequent_genes: analysis.frequent_genes,
      keywords: analysis.keywords,
      future_directions: analysis.future_directions,
    });

    res.json({ analysis, fromCache: false });
  } catch (err) {
    next(err);
  }
});

// 핵심 기술/유전자/키워드 칩을 눌렀을 때 그 용어가 무엇인지 짧게 설명합니다.
// 재검색이 아니라 이 응답만 그 자리에 표시하는 용도입니다.
summaryRouter.post("/summary/explain", async (req, res, next) => {
  try {
    const term = String(req.body?.term ?? "").trim();
    if (!term) throw new HttpError(400, "term이 필요합니다.");
    const normalizedTerm = term.toLowerCase();

    const { data: cached } = await supabaseAdmin
      .from("term_explanations")
      .select("explanation")
      .eq("term", normalizedTerm)
      .order("created_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return res.json({ explanation: cached.explanation, fromCache: true });
    }

    const explanation = await explainTerm(term);
    await supabaseAdmin.from("term_explanations").insert({ term: normalizedTerm, explanation });

    res.json({ explanation, fromCache: false });
  } catch (err) {
    next(err);
  }
});

interface AskRequestBody {
  pmid?: string;
  title?: string;
  abstract?: string;
  question?: string;
}

// 저장한 논문별 AI 질의응답. 초록 원문을 프롬프트에 직접 포함하는 단순한 방식이며,
// 답변은 DB에 저장하지 않고 응답으로만 반환합니다(대화 기록은 프론트엔드 세션에만 유지).
summaryRouter.post("/summary/ask", authMiddleware, async (req, res, next) => {
  try {
    const body = req.body as AskRequestBody;
    const question = (body.question ?? "").trim();
    if (!question) throw new HttpError(400, "question이 필요합니다.");

    let title = body.title ?? "";
    let abstract = body.abstract ?? "";

    if (!abstract && body.pmid) {
      const { data: saved } = await supabaseAdmin
        .from("saved_papers")
        .select("title, abstract")
        .eq("user_id", req.user!.id)
        .eq("pmid", body.pmid)
        .maybeSingle();

      if (saved) {
        title = saved.title;
        abstract = saved.abstract ?? "";
      } else {
        const { data: cached } = await supabaseAdmin
          .from("search_results")
          .select("title, abstract")
          .eq("pmid", body.pmid)
          .order("search_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cached) {
          title = cached.title;
          abstract = cached.abstract ?? "";
        }
      }
    }

    if (!abstract) {
      throw new HttpError(400, "질문할 논문의 초록 정보를 찾을 수 없습니다. pmid 또는 abstract를 전달하세요.");
    }

    const answer = await askAboutPaper({ title, abstract }, question);
    res.json({ answer });
  } catch (err) {
    next(err);
  }
});
