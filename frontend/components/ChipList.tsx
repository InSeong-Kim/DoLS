interface ChipListProps {
  items: string[];
  onChipClick?: (term: string) => void;
}

export default function ChipList({ items, onChipClick }: ChipListProps) {
  if (items.length === 0) return <p className="text-sm text-navy-400">해당 없음</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) =>
        onChipClick ? (
          <button
            key={`${item}-${idx}`}
            type="button"
            onClick={() => onChipClick(item)}
            title={`"${item}" 검색하기`}
            className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700 ring-1 ring-inset ring-navy-100 hover:bg-navy-100 hover:ring-navy-300"
          >
            {item}
          </button>
        ) : (
          <span
            key={`${item}-${idx}`}
            className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700 ring-1 ring-inset ring-navy-100"
          >
            {item}
          </span>
        )
      )}
    </div>
  );
}
