"use client";

import { Calendar, momentLocalizer, Views, type View, type SlotInfo } from "react-big-calendar";
import moment from "moment";
import "moment/locale/ko";
import "react-big-calendar/lib/css/react-big-calendar.css";
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
        messages={{
          today: "오늘",
          previous: "이전",
          next: "다음",
          month: "월",
          week: "주",
          day: "일",
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
