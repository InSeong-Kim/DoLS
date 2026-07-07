import type { LucideIcon } from "lucide-react";
import { TrendingUp, Cpu, Dna, Tags, Compass, Sparkles, AlertTriangle } from "lucide-react";
import ChipList from "./ChipList";
import type { SummaryResult } from "@/types";

interface SummaryPanelProps {
  summary: SummaryResult;
  onChipClick?: (term: string) => void;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-navy-100 pl-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-navy-700">
          <Icon size={13} strokeWidth={2.25} />
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function SummaryPanel({ summary, onChipClick }: SummaryPanelProps) {
  if (summary.raw) {
    return (
      <div className="rounded-lg border border-navy-200 bg-white p-6 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <AlertTriangle size={13} strokeWidth={2.25} />
          AI 응답을 정해진 JSON 형식으로 해석하지 못해 원문을 그대로 표시합니다.
        </p>
        <p className="whitespace-pre-wrap text-sm text-navy-700">{summary.raw}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
        <Sparkles size={14} strokeWidth={2.25} className="text-navy-500" />
        AI 요약
      </div>

      <Section icon={TrendingUp} title="연구 동향">
        <p className="text-sm leading-relaxed text-navy-700">{summary.trend_summary || "요약 없음"}</p>
      </Section>

      <Section icon={Cpu} title="핵심 기술">
        <ChipList items={summary.key_technologies} onChipClick={onChipClick} />
      </Section>

      <Section icon={Dna} title="자주 언급된 유전자">
        <ChipList items={summary.frequent_genes} onChipClick={onChipClick} />
      </Section>

      <Section icon={Tags} title="핵심 키워드">
        <ChipList items={summary.keywords} onChipClick={onChipClick} />
      </Section>

      <Section icon={Compass} title="향후 연구 방향">
        <p className="text-sm leading-relaxed text-navy-700">{summary.future_directions || "정보 없음"}</p>
      </Section>
    </div>
  );
}
