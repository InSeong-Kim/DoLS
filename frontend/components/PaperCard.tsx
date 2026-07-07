"use client";

import { useState } from "react";
import {
  ExternalLink,
  BookmarkPlus,
  BookmarkCheck,
  Users,
  Calendar,
  Sparkles,
  Microscope,
  ChevronUp,
  Loader2,
  Cpu,
  Dna,
  Tags,
  Compass,
  AlertTriangle,
} from "lucide-react";
import ChipList from "./ChipList";
import { api } from "@/lib/api";
import type { PaperAnalysisResult, PaperRelevance, PubmedArticle } from "@/types";

interface PaperCardProps {
  article: PubmedArticle;
  isSaved?: boolean;
  onSave?: (article: PubmedArticle) => void;
  saving?: boolean;
  relevance?: PaperRelevance;
  onChipClick?: (term: string) => void;
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

export default function PaperCard({
  article,
  isSaved,
  onSave,
  saving,
  relevance,
  onChipClick,
}: PaperCardProps) {
  const [expanded, setExpanded] = useState(false);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PaperAnalysisResult | null>(null);

  async function handleToggleAnalysis() {
    if (analysisOpen) {
      setAnalysisOpen(false);
      return;
    }
    setAnalysisOpen(true);
    if (analysis || analysisLoading) return;

    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const { analysis: result } = await api.analyzePaper(article);
      setAnalysis(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "AI 분석에 실패했습니다.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-5 space-y-3 shadow-sm transition-shadow hover:shadow-md">
      {relevance && (
        <div className="flex items-start gap-2">
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${RELEVANCE_STYLE[relevance.score]}`}
          >
            <Sparkles size={11} strokeWidth={2.25} />
            {RELEVANCE_LABEL[relevance.score]}
          </span>
          {relevance.comment && (
            <span className="text-xs text-navy-400 pt-0.5">{relevance.comment}</span>
          )}
        </div>
      )}

      <h3 className="text-[17px] font-semibold tracking-tight text-navy-900 leading-snug">
        {article.title}
      </h3>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-400">
        <span className="flex items-center gap-1.5">
          <Users size={13} strokeWidth={2} className="text-navy-300" />
          {formatAuthors(article.authors)}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar size={13} strokeWidth={2} className="text-navy-300" />
          {article.journal || "저널 정보 없음"}
          {article.pubYear ? ` · ${article.pubYear}` : ""}
        </span>
      </div>

      {article.abstract && (
        <div>
          <p className={`text-sm leading-relaxed text-navy-600 ${expanded ? "" : "line-clamp-3"}`}>
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

      <div className="flex items-center gap-4 pt-1">
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-900"
        >
          <ExternalLink size={14} strokeWidth={2.25} />
          PubMed에서 보기
        </a>

        {article.abstract && (
          <button
            onClick={handleToggleAnalysis}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-900"
          >
            {analysisOpen ? (
              <ChevronUp size={14} strokeWidth={2.25} />
            ) : (
              <Microscope size={14} strokeWidth={2.25} />
            )}
            {analysisOpen ? "AI 분석 닫기" : "AI 분석 보기"}
          </button>
        )}

        {onSave && (
          <button
            onClick={() => onSave(article)}
            disabled={isSaved || saving}
            className={`ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
              isSaved
                ? "cursor-default bg-navy-50 text-navy-400 shadow-none"
                : "bg-navy-800 text-white hover:bg-navy-900"
            }`}
          >
            {isSaved ? (
              <BookmarkCheck size={15} strokeWidth={2.25} />
            ) : (
              <BookmarkPlus size={15} strokeWidth={2.25} />
            )}
            {isSaved ? "저장됨" : saving ? "저장 중..." : "라이브러리에 저장"}
          </button>
        )}
      </div>

      {analysisOpen && (
        <div className="space-y-4 rounded-md bg-navy-50/60 p-4">
          {analysisLoading && (
            <p className="flex items-center gap-2 text-xs text-navy-400">
              <Loader2 size={13} strokeWidth={2.25} className="animate-spin" />
              이 논문의 초록을 분석하는 중...
            </p>
          )}

          {analysisError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={13} strokeWidth={2.25} className="shrink-0" />
              {analysisError}
            </p>
          )}

          {!analysisLoading && analysis && (
            <>
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
                  <Cpu size={12} strokeWidth={2.25} />
                  핵심 기술
                </h4>
                <ChipList items={analysis.key_technologies} onChipClick={onChipClick} />
              </div>
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
                  <Dna size={12} strokeWidth={2.25} />
                  언급된 유전자
                </h4>
                <ChipList items={analysis.frequent_genes} onChipClick={onChipClick} />
              </div>
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
                  <Tags size={12} strokeWidth={2.25} />
                  핵심 키워드
                </h4>
                <ChipList items={analysis.keywords} onChipClick={onChipClick} />
              </div>
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
                  <Compass size={12} strokeWidth={2.25} />
                  향후 연구 방향
                </h4>
                <p className="text-xs leading-relaxed text-navy-600">
                  {analysis.future_directions || "정보 없음"}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
