"use client";

import { useState } from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

interface ChipListProps {
  items: string[];
}

// 같은 용어를 여러 번 눌러도 다시 호출하지 않도록 페이지 세션 동안 결과를 재사용합니다.
const explanationCache = new Map<string, string>();

export default function ChipList({ items }: ChipListProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  async function handleClick(term: string) {
    if (selected === term) {
      setSelected(null);
      return;
    }

    setSelected(term);
    setError(null);
    setExplanation(null);

    const cached = explanationCache.get(term);
    if (cached) {
      setExplanation(cached);
      return;
    }

    setLoading(true);
    try {
      const { explanation: text } = await api.explainTerm(term);
      explanationCache.set(term, text);
      setExplanation(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설명을 가져오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) return <p className="text-sm text-navy-400">해당 없음</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <button
            key={`${item}-${idx}`}
            type="button"
            onClick={() => handleClick(item)}
            title={`"${item}"이(가) 무엇인지 AI에게 물어보기`}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
              selected === item
                ? "bg-navy-700 text-white ring-navy-700"
                : "bg-navy-50 text-navy-700 ring-navy-100 hover:bg-navy-100 hover:ring-navy-300"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-2 rounded-md bg-navy-50 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-navy-800">{selected}</span>
            <button
              onClick={() => setSelected(null)}
              className="shrink-0 text-navy-400 hover:text-navy-700"
              title="닫기"
            >
              <X size={13} strokeWidth={2.25} />
            </button>
          </div>

          {loading && (
            <p className="flex items-center gap-1.5 text-xs text-navy-400">
              <Loader2 size={12} strokeWidth={2.25} className="animate-spin" />
              AI가 설명을 준비하는 중...
            </p>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle size={12} strokeWidth={2.25} className="shrink-0" />
              {error}
            </p>
          )}

          {!loading && !error && explanation && (
            <p className="text-xs leading-relaxed text-navy-600">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
