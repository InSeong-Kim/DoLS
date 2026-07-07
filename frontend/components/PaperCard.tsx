"use client";

import { useState } from "react";
import type { PaperRelevance, PubmedArticle } from "@/types";

interface PaperCardProps {
  article: PubmedArticle;
  isSaved?: boolean;
  onSave?: (article: PubmedArticle) => void;
  saving?: boolean;
  relevance?: PaperRelevance;
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "저자 정보 없음";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} 외 ${authors.length - 3}명`;
}

const RELEVANCE_LABEL: Record<PaperRelevance["score"], string> = {
  high: "관련성: 높음",
  medium: "관련성: 중간",
  low: "관련성: 낮음",
};

const RELEVANCE_STYLE: Record<PaperRelevance["score"], string> = {
  high: "bg-navy-700 text-white",
  medium: "bg-navy-200 text-navy-800",
  low: "bg-navy-50 text-navy-500",
};

export default function PaperCard({ article, isSaved, onSave, saving, relevance }: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-5 space-y-3">
      {relevance && (
        <div className="flex items-start gap-2">
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${RELEVANCE_STYLE[relevance.score]}`}>
            {RELEVANCE_LABEL[relevance.score]}
          </span>
          {relevance.comment && (
            <span className="text-xs text-navy-400 pt-0.5">{relevance.comment}</span>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold text-navy-900 leading-snug">{article.title}</h3>

      <div className="text-sm text-navy-500">
        {formatAuthors(article.authors)}
      </div>
      <div className="text-sm text-navy-400">
        {article.journal || "저널 정보 없음"}
        {article.pubYear ? ` · ${article.pubYear}` : ""}
      </div>

      {article.abstract && (
        <div>
          <p className={`text-sm text-navy-600 ${expanded ? "" : "line-clamp-3"}`}>
            {article.abstract}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-navy-500 hover:text-navy-800"
          >
            {expanded ? "접기" : "더 보기"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-navy-600 underline hover:text-navy-900"
        >
          PubMed에서 보기
        </a>

        {onSave && (
          <button
            onClick={() => onSave(article)}
            disabled={isSaved || saving}
            className={`ml-auto rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isSaved
                ? "cursor-default bg-navy-50 text-navy-400"
                : "bg-navy-800 text-white hover:bg-navy-900"
            }`}
          >
            {isSaved ? "저장됨" : saving ? "저장 중..." : "라이브러리에 저장"}
          </button>
        )}
      </div>
    </div>
  );
}
