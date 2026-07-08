"use client";

import { CalendarDays, Paperclip } from "lucide-react";
import moment from "moment";
import type { CalendarEvent } from "@/types";

interface TodayPanelProps {
  events: CalendarEvent[];
  loading: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
  onOpenFile: (uploadedPaperId: string) => void;
}

export default function TodayPanel({ events, loading, onSelectEvent, onOpenFile }: TodayPanelProps) {
  const sorted = [...events].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-4 shadow-sm lg:sticky lg:top-8">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-navy-900">
        <CalendarDays size={15} strokeWidth={2.25} className="text-navy-500" />
        오늘 일정 · {moment().format("M월 D일 (dd)")}
      </h2>

      {loading ? (
        <p className="text-sm text-navy-400">불러오는 중...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-navy-400">오늘 등록된 일정이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((event) => (
            <li
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className="cursor-pointer rounded-md border border-navy-100 p-3 hover:border-navy-300 hover:bg-navy-50"
            >
              <p className="text-xs font-medium text-navy-400">
                {event.is_all_day
                  ? "종일"
                  : `${moment(event.start_datetime).format("HH:mm")}${
                      event.end_datetime ? ` - ${moment(event.end_datetime).format("HH:mm")}` : ""
                    }`}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-navy-900">{event.title}</p>
              {event.description && (
                <p className="mt-1 line-clamp-2 text-xs text-navy-500">{event.description}</p>
              )}
              {event.uploaded_papers && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFile(event.uploaded_paper_id!);
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-900"
                >
                  <Paperclip size={12} strokeWidth={2.25} />
                  <span className="truncate">{event.uploaded_papers.filename}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
