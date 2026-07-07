import OpenAI from "openai";
import { PubmedArticle } from "./pubmedService";

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "[llmService] OPENAI_API_KEY 가 설정되지 않았습니다. AI 요약/질의응답 호출 시 실패합니다. " +
      "backend/.env 를 확인하세요."
  );
}

// apiKey가 없어도 서버 기동 시 OpenAI 생성자가 throw하지 않도록 placeholder로 대체합니다.
// 실제 요약/질의응답 호출 시점에는 정상적으로 provider 에러가 발생합니다.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "placeholder-key",
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface PaperRelevance {
  pmid: string;
  score: "high" | "medium" | "low";
  comment: string;
}

export interface SummaryResult {
  trend_summary: string;
  key_technologies: string[];
  frequent_genes: string[];
  keywords: string[];
  future_directions: string;
  paper_relevance?: PaperRelevance[];
  raw?: string;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function fallbackResult(rawText: string): SummaryResult {
  return {
    trend_summary: rawText,
    key_technologies: [],
    frequent_genes: [],
    keywords: [],
    future_directions: "",
    raw: rawText,
  };
}

function buildArticlesBlock(articles: PubmedArticle[]): string {
  return articles
    .map(
      (a, idx) =>
        `[${idx + 1}] PMID: ${a.pmid}\n제목: ${a.title}\n저널: ${a.journal} (${a.pubYear ?? "연도 미상"})\n초록: ${a.abstract || "(초록 없음)"}`
    )
    .join("\n\n");
}

export async function summarizeLiterature(
  keyword: string,
  articles: PubmedArticle[],
  researchInterest?: string | null
): Promise<SummaryResult> {
  const personalize = Boolean(researchInterest && researchInterest.trim());

  const schemaDescription = personalize
    ? `{
  "trend_summary": "string",
  "key_technologies": ["string"],
  "frequent_genes": ["string"],
  "keywords": ["string"],
  "future_directions": "string",
  "paper_relevance": [{ "pmid": "string", "score": "high"|"medium"|"low", "comment": "string" }]
}`
    : `{
  "trend_summary": "string",
  "key_technologies": ["string"],
  "frequent_genes": ["string"],
  "keywords": ["string"],
  "future_directions": "string"
}`;

  const personalizeInstruction = personalize
    ? `\n\n또한 이 사용자의 연구 관심사는 다음과 같습니다: "${researchInterest}".\n각 논문(PMID 기준)이 이 연구 관심사와 얼마나 관련이 있는지 "high"/"medium"/"low"로 평가하고 한 줄 코멘트를 "paper_relevance" 배열에 담아주세요.`
    : "";

  const systemPrompt = `당신은 생명정보학(bioinformatics) 분야의 전공 문헌 분석 도우미입니다. 아래 JSON 스키마를 반드시 그대로 지켜서 응답하세요. 다른 설명이나 마크다운 없이 JSON 객체만 출력하세요.\n\n${schemaDescription}`;

  const userPrompt = `검색 키워드: "${keyword}"\n\n아래는 검색된 논문 목록입니다.\n\n${buildArticlesBlock(
    articles
  )}\n\n이 논문들을 종합해 연구 동향, 핵심 기술, 자주 언급되는 유전자, 핵심 키워드, 향후 연구 방향을 분석해 JSON으로 응답하세요.${personalizeInstruction}`;

  let content: string;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    content = completion.choices[0]?.message?.content ?? "";
  } catch {
    // response_format을 지원하지 않는 모델(일부 무료 티어)을 위한 재시도.
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    content = completion.choices[0]?.message?.content ?? "";
  }

  try {
    const parsed = JSON.parse(content);
    const result: SummaryResult = {
      trend_summary: typeof parsed.trend_summary === "string" ? parsed.trend_summary : "",
      key_technologies: toStringArray(parsed.key_technologies),
      frequent_genes: toStringArray(parsed.frequent_genes),
      keywords: toStringArray(parsed.keywords),
      future_directions:
        typeof parsed.future_directions === "string" ? parsed.future_directions : "",
    };
    if (personalize && Array.isArray(parsed.paper_relevance)) {
      result.paper_relevance = parsed.paper_relevance
        .filter((item: any) => item && typeof item.pmid === "string")
        .map((item: any) => ({
          pmid: item.pmid,
          score: ["high", "medium", "low"].includes(item.score) ? item.score : "low",
          comment: typeof item.comment === "string" ? item.comment : "",
        }));
    }
    return result;
  } catch {
    return fallbackResult(content);
  }
}

export interface PaperAnalysisResult {
  key_technologies: string[];
  frequent_genes: string[];
  keywords: string[];
  future_directions: string;
  raw?: string;
}

function fallbackPaperAnalysis(rawText: string): PaperAnalysisResult {
  return {
    key_technologies: [],
    frequent_genes: [],
    keywords: [],
    future_directions: rawText,
    raw: rawText,
  };
}

// 논문 한 편의 초록만을 근거로 핵심 기술/유전자/키워드/향후 방향을 분석합니다.
// (여러 논문을 종합하는 trend_summary는 전체 요약(summarizeLiterature) 전용이라
// 개별 논문 분석에는 포함하지 않습니다.) PubMed API는 전체 원문의 방법/논의 절을
// 따로 제공하지 않으므로, 초록 텍스트 안에 담긴 배경/방법/결과/논의 내용을 근거로 삼습니다.
export async function analyzeSinglePaper(article: PubmedArticle): Promise<PaperAnalysisResult> {
  const schemaDescription = `{
  "key_technologies": ["string"],
  "frequent_genes": ["string"],
  "keywords": ["string"],
  "future_directions": "string"
}`;

  const systemPrompt = `당신은 생명정보학(bioinformatics) 분야의 전공 문헌 분석 도우미입니다. 아래 JSON 스키마를 반드시 그대로 지켜서 응답하세요. 다른 설명이나 마크다운 없이 JSON 객체만 출력하세요.\n\n${schemaDescription}`;

  const userPrompt = `아래는 논문 한 편의 제목과 초록입니다. 초록 안에 담긴 배경/방법/결과/논의 내용을 근거로, 이 논문에서 사용한 핵심 기술, 언급된 유전자, 핵심 키워드, 이 논문이 제시하는(또는 시사하는) 향후 연구 방향을 분석해 JSON으로 응답하세요.\n\nPMID: ${article.pmid}\n제목: ${article.title}\n저널: ${article.journal} (${article.pubYear ?? "연도 미상"})\n초록: ${article.abstract || "(초록 없음)"}`;

  let content: string;
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    content = completion.choices[0]?.message?.content ?? "";
  } catch {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    content = completion.choices[0]?.message?.content ?? "";
  }

  try {
    const parsed = JSON.parse(content);
    return {
      key_technologies: toStringArray(parsed.key_technologies),
      frequent_genes: toStringArray(parsed.frequent_genes),
      keywords: toStringArray(parsed.keywords),
      future_directions:
        typeof parsed.future_directions === "string" ? parsed.future_directions : "",
    };
  } catch {
    return fallbackPaperAnalysis(content);
  }
}

// 저장된 논문 하나에 대한 AI 질의응답. 임베딩/벡터 검색 없이 초록 원문을
// 프롬프트에 직접 포함하는 단순한 방식이며, 응답은 DB에 저장하지 않습니다.
export async function askAboutPaper(
  paperContext: { title: string; abstract: string },
  question: string
): Promise<string> {
  const systemPrompt =
    "당신은 생명정보학 논문을 설명해주는 도우미입니다. 주어진 논문의 제목과 초록만을 근거로 질문에 답하세요. 초록에 없는 내용은 추측하지 말고 알 수 없다고 답하세요.";
  const userPrompt = `논문 제목: ${paperContext.title}\n초록: ${paperContext.abstract || "(초록 없음)"}\n\n질문: ${question}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return completion.choices[0]?.message?.content ?? "답변을 생성하지 못했습니다.";
}
