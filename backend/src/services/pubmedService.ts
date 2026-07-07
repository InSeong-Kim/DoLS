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
    const pubDate = article?.Journal?.JournalIssue?.PubDate;
    const yearRaw = pubDate?.Year ?? (pubDate?.MedlineDate ? String(pubDate.MedlineDate).slice(0, 4) : undefined);
    const pubYear = yearRaw ? parseInt(yearRaw, 10) : null;

    return {
      pmid,
      title,
      authors,
      journal,
      pubYear: Number.isNaN(pubYear) ? null : pubYear,
      abstract,
    };
  });
}

export async function searchPubmed(params: SearchPubmedParams): Promise<PubmedArticle[]> {
  const pmids = await esearch(params);
  if (pmids.length === 0) return [];
  return efetch(pmids);
}
