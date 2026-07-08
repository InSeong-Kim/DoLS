import { parseStringPromise } from "xml2js";
import { ncbiRequestQueue } from "../utils/requestQueue";
import { HttpError } from "../middlewares/errorHandler";

const ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const NCBI_TIMEOUT_MS = 15000;

export interface PubmedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubYear: number | null;
  abstract: string;
  // 가능한 만큼 정밀하게(YYYY-MM-DD) 뽑은 발행일. 월/일을 알 수 없으면 그 해
  // 1월 1일로 보수적으로 채워, 구독 키워드의 "새 논문" 판단에 사용합니다.
  pubDate: string | null;
}

export interface SearchPubmedParams {
  keyword: string;
  retmax?: number;
  sort?: "relevance" | "date";
  author?: string;
  year?: string;
  journal?: string;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseMonth(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  const numeric = parseInt(s, 10);
  if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  return MONTH_ABBREVIATIONS[s.slice(0, 3)] ?? null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// PubDate/ArticleDate 노드에서 뽑을 수 있는 만큼 정밀하게 날짜를 만듭니다.
// 월/일이 없으면 그 해 1월 1일로 보수적으로 채웁니다(비워두면 "새 논문" 비교 시
// 항상 최신으로 오인되어 같은 논문이 매번 다시 "새 논문"으로 잡히는 문제가 생김).
function toDateString(node: any): string | null {
  if (!node) return null;
  const year = node.Year ? parseInt(String(node.Year), 10) : NaN;
  if (Number.isNaN(year)) return null;
  const month = parseMonth(node.Month) ?? 1;
  const dayRaw = node.Day ? parseInt(String(node.Day), 10) : NaN;
  const day = Number.isNaN(dayRaw) ? 1 : dayRaw;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function buildTerm(params: SearchPubmedParams): string {
  const clauses = [params.keyword];
  if (params.author) clauses.push(`${params.author}[Author]`);
  if (params.year) clauses.push(`${params.year}[dp]`);
  if (params.journal) clauses.push(`${params.journal}[Journal]`);
  return clauses.join(" AND ");
}

async function fetchWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NCBI_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new HttpError(
        502,
        `PubMed(NCBI) 요청이 실패했습니다. (status ${response.status})`
      );
    }
    return await response.text();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(504, "PubMed(NCBI) 요청이 시간 초과되었습니다.");
    }
    throw new HttpError(502, "PubMed(NCBI) 요청 중 네트워크 오류가 발생했습니다.");
  } finally {
    clearTimeout(timer);
  }
}

function ncbiAuthParams(): string {
  const parts: string[] = [];
  if (process.env.NCBI_API_KEY) parts.push(`api_key=${process.env.NCBI_API_KEY}`);
  if (process.env.ENTREZ_EMAIL) parts.push(`email=${encodeURIComponent(process.env.ENTREZ_EMAIL)}`);
  return parts.length ? `&${parts.join("&")}` : "";
}

async function esearch(params: SearchPubmedParams): Promise<string[]> {
  const term = encodeURIComponent(buildTerm(params));
  const retmax = params.retmax ?? 10;
  const sort = params.sort === "date" ? "pub+date" : "relevance";
  const url = `${ESEARCH_URL}?db=pubmed&term=${term}&retmax=${retmax}&sort=${sort}&retmode=json${ncbiAuthParams()}`;

  const text = await ncbiRequestQueue.enqueue(() => fetchWithTimeout(url));
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, "PubMed(NCBI) 응답을 해석할 수 없습니다.");
  }
  const ids: string[] | undefined = parsed?.esearchresult?.idlist;
  return ids ?? [];
}

async function efetch(pmids: string[]): Promise<PubmedArticle[]> {
  if (pmids.length === 0) return [];
  const ids = encodeURIComponent(pmids.join(","));
  const url = `${EFETCH_URL}?db=pubmed&id=${ids}&retmode=xml&rettype=abstract${ncbiAuthParams()}`;

  const xml = await ncbiRequestQueue.enqueue(() => fetchWithTimeout(url));
  let parsed: any;
  try {
    parsed = await parseStringPromise(xml, { explicitArray: false });
  } catch {
    throw new HttpError(502, "PubMed(NCBI) 응답 XML을 해석할 수 없습니다.");
  }

  const articles = asArray(parsed?.PubmedArticleSet?.PubmedArticle);
  return articles.map((entry): PubmedArticle => {
    const citation = entry?.MedlineCitation ?? {};
    const article = citation?.Article ?? {};
    const pmid = String(citation?.PMID?._ ?? citation?.PMID ?? "");

    const title =
      typeof article?.ArticleTitle === "string"
        ? article.ArticleTitle
        : article?.ArticleTitle?._ ?? "(제목 없음)";

    const abstractTextRaw = article?.Abstract?.AbstractText;
    const abstract = asArray(abstractTextRaw)
      .map((part: any) => (typeof part === "string" ? part : part?._ ?? ""))
      .join(" ")
      .trim();

    const authorList = asArray(article?.AuthorList?.Author);
    const authors = authorList.map((author: any) => {
      if (author?.CollectiveName) return String(author.CollectiveName);
      const last = author?.LastName ?? "";
      const initials = author?.Initials ?? "";
      return [last, initials].filter(Boolean).join(" ").trim() || "Unknown";
    });

    const journal = article?.Journal?.Title ?? article?.Journal?.ISOAbbreviation ?? "";
    const pubDateNode = article?.Journal?.JournalIssue?.PubDate;
    const yearRaw =
      pubDateNode?.Year ?? (pubDateNode?.MedlineDate ? String(pubDateNode.MedlineDate).slice(0, 4) : undefined);
    const pubYear = yearRaw ? parseInt(yearRaw, 10) : null;

    // ArticleDate(전자출판일)는 항상 숫자 Year/Month/Day라 PubDate보다 더 정확한 경우가
    // 많습니다. 없으면 PubDate로, 그마저 월/일이 없으면 연도만으로 보수적으로 채웁니다.
    const articleDateNode = asArray(article?.ArticleDate)[0];
    const pubDate =
      toDateString(articleDateNode) ??
      toDateString(pubDateNode) ??
      (yearRaw && !Number.isNaN(pubYear) ? `${yearRaw}-01-01` : null);

    return {
      pmid,
      title,
      authors,
      journal,
      pubYear: Number.isNaN(pubYear) ? null : pubYear,
      abstract,
      pubDate,
    };
  });
}

export async function searchPubmed(params: SearchPubmedParams): Promise<PubmedArticle[]> {
  const pmids = await esearch(params);
  if (pmids.length === 0) return [];
  return efetch(pmids);
}
