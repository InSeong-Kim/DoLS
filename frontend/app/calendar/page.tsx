"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { Views, type View, type SlotInfo } from "react-big-calendar";
import { CalendarPlus } from "lucide-react";
import CalendarView from "@/components/CalendarView";
import EventModal from "@/components/EventModal";
import { api, getAccessToken } from "@/lib/api";
import type { CalendarEvent } from "@/types";

function computeRange(date: Date, view: View): { from: string; to: string } {
  const m = moment(date);
  let start: moment.Moment;
  let end: moment.Moment;
  if (view === Views.WEEK) {
    start = m.clone().startOf("week");
    end = m.clone().endOf("week");
  } else if (view === Views.DAY) {
    start = m.clone().startOf("day");
    end = m.clone().endOf("day");
  } else {
    start = m.clone().startOf("month").startOf("week");
    end = m.clone().endOf("month").endOf("week");
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function CalendarPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialStart, setModalInitialStart] = useState<Date | null>(null);
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);

  // 캘린더는 로그인 전용 페이지입니다. 토큰이 없으면 보호된 API를 호출해
  // 401을 유발하고 전체 새로고침으로 튕기는 대신, 클라이언트 라우팅으로 조용히 이동합니다.
  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = computeRange(date, view);
      const data = await api.listCalendarEvents(from, to);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [date, view]);

  useEffect(() => {
    if (checkingAuth) return;
    loadEvents();
  }, [checkingAuth, loadEvents]);

  function openNewEventModal(start: Date) {
    setModalEvent(null);
    setModalInitialStart(start);
    setModalOpen(true);
  }

  function openEditEventModal(event: CalendarEvent) {
    setModalEvent(event);
    setModalInitialStart(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalEvent(null);
    setModalInitialStart(null);
  }

  async function handleSave(input: {
    title: string;
    description: string | null;
    start_datetime: string;
    end_datetime: string | null;
  }) {
    const is_all_day = !input.end_datetime;
    if (modalEvent) {
      const updated = await api.updateCalendarEvent(modalEvent.id, { ...input, is_all_day });
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } else {
      const created = await api.createCalendarEvent({ ...input, is_all_day });
      setEvents((prev) => [...prev, created]);
    }
    closeModal();
  }

  async function handleDelete() {
    if (!modalEvent) return;
    await api.deleteCalendarEvent(modalEvent.id);
    setEvents((prev) => prev.filter((e) => e.id !== modalEvent.id));
    closeModal();
  }

  if (checkingAuth) {
    return <p className="text-sm text-navy-400">불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">캘린더</h1>
          <p className="mt-1 text-sm text-navy-400">개인 일정을 자유롭게 등록하고 관리하세요.</p>
        </div>
        <button
          onClick={() => openNewEventModal(new Date())}
          className="flex items-center gap-1.5 rounded-md bg-navy-800 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-navy-700"
        >
          <CalendarPlus size={15} strokeWidth={2.25} />
          새 일정
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="h-[700px] animate-pulse rounded-lg border border-navy-200 bg-navy-50" />
      ) : (
        <CalendarView
          events={events}
          view={view}
          date={date}
          onViewChange={setView}
          onNavigate={setDate}
          onSelectSlot={(slotInfo: SlotInfo) => openNewEventModal(slotInfo.start)}
          onSelectEvent={openEditEventModal}
        />
      )}

      {modalOpen && (
        <EventModal
          initialStart={modalInitialStart}
          event={modalEvent}
          onClose={closeModal}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
