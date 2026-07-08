"use client";

import {
  Calendar,
  momentLocalizer,
  Navigate,
  Views,
  type View,
  type SlotInfo,
  type ToolbarProps,
} from "react-big-calendar";
import moment from "moment";
import "moment/locale/ko";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types";

moment.locale("ko");
const localizer = momentLocalizer(moment);

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  raw: CalendarEvent;
}

function toRbcEvent(e: CalendarEvent): RbcEvent {
  const start = new Date(e.start_datetime);
  const end = e.end_datetime ? new Date(e.end_datetime) : start;
  return { id: e.id, title: e.title, start, end, allDay: e.is_all_day, raw: e };
}

const VIEW_LABELS: Partial<Record<View, string>> = { month: "월", week: "주", day: "일" };

function CalendarToolbar({ label, view, views, onNavigate, onView }: ToolbarProps<RbcEvent>) {
  const viewList = (Array.isArray(views) ? views : Object.keys(views)) as View[];

  return (
    <div className="mb-4 grid grid-cols-3 items-center gap-3">
      <div className="flex items-center gap-1 justify-self-start">
        <button
          type="button"
          onClick={() => onNavigate(Navigate.TODAY)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-navy-600 ring-1 ring-inset ring-navy-200 hover:bg-navy-50"
        >
          오늘
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          aria-label="이전"
          className="flex h-8 w-8 items-center justify-center rounded-md text-navy-500 hover:bg-navy-50 hover:text-navy-800"
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        <span className="whitespace-nowrap text-center text-base font-semibold text-navy-900">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onNavigate(Navigate.NEXT)}
          aria-label="다음"
          className="flex h-8 w-8 items-center justify-center rounded-md text-navy-500 hover:bg-navy-50 hover:text-navy-800"
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex justify-self-end gap-1 rounded-md bg-navy-50 p-1 text-sm">
        {viewList.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              view === v ? "bg-white text-navy-900 shadow-sm" : "text-navy-400 hover:text-navy-700"
            }`}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  );
}

const CALENDAR_FORMATS = {
  monthHeaderFormat: (date: Date) => moment(date).format("YYYY년 M월"),
  dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format("YYYY년 M월 D일")} - ${moment(end).format("M월 D일")}`,
  dayHeaderFormat: (date: Date) => moment(date).format("YYYY년 M월 D일 (dd)"),
  timeGutterFormat: (date: Date) => moment(date).format("HH:mm"),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format("HH:mm")} - ${moment(end).format("HH:mm")}`,
  agendaTimeFormat: (date: Date) => moment(date).format("HH:mm"),
  agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
    `${moment(start).format("HH:mm")} - ${moment(end).format("HH:mm")}`,
};

interface CalendarViewProps {
  events: CalendarEvent[];
  view: View;
  date: Date;
  onViewChange: (view: View) => void;
  onNavigate: (date: Date) => void;
  onSelectSlot: (slotInfo: SlotInfo) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export default function CalendarView({
  events,
  view,
  date,
  onViewChange,
  onNavigate,
  onSelectSlot,
  onSelectEvent,
}: CalendarViewProps) {
  const rbcEvents = events.map(toRbcEvent);

  return (
    <div className="dols-calendar rounded-lg border border-navy-200 bg-white p-4 shadow-sm">
      <Calendar
        localizer={localizer}
        events={rbcEvents}
        startAccessor="start"
        endAccessor="end"
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        view={view}
        date={date}
        onView={onViewChange}
        onNavigate={onNavigate}
        selectable
        onSelectSlot={onSelectSlot}
        onSelectEvent={(e) => onSelectEvent((e as unknown as RbcEvent).raw)}
        style={{ height: 700 }}
        formats={CALENDAR_FORMATS}
        components={{ toolbar: CalendarToolbar }}
        messages={{
          agenda: "일정",
          date: "날짜",
          time: "시간",
          event: "일정",
          noEventsInRange: "이 기간에 일정이 없습니다.",
          showMore: (count: number) => `+${count}개 더보기`,
        }}
      />
    </div>
  );
}
