import type { SummaryResult } from "@/types";

interface SummaryPanelProps {
  summary: SummaryResult;
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-navy-400">해당 없음</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function SummaryPanel({ summary }: SummaryPanelProps) {
  if (summary.raw) {
    return (
      <div className="rounded-lg border border-navy-200 bg-white p-6">
        <p className="mb-3 text-xs font-medium text-navy-400">
          AI 응답을 정해진 JSON 형식으로 해석하지 못해 원문을 그대로 표시합니다.
        </p>
        <p className="whitespace-pre-wrap text-sm text-navy-700">{summary.raw}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-6 space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">연구 동향</h3>
        <p className="text-sm leading-relaxed text-navy-700">{summary.trend_summary || "요약 없음"}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">핵심 기술</h3>
        <ChipList items={summary.key_technologies} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">자주 언급된 유전자</h3>
        <ChipList items={summary.frequent_genes} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">핵심 키워드</h3>
        <ChipList items={summary.keywords} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">향후 연구 방향</h3>
        <p className="text-sm leading-relaxed text-navy-700">{summary.future_directions || "정보 없음"}</p>
      </div>
    </div>
  );
}
