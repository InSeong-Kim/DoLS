"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import type { CalendarEvent } from "@/types";

interface EventModalProps {
  initialStart: Date | null;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string | null;
    start_datetime: string;
    end_datetime: string | null;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function EventModal({ initialStart, event, onClose, onSave, onDelete }: EventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setStart(toLocalInputValue(new Date(event.start_datetime)));
      setEnd(event.end_datetime ? toLocalInputValue(new Date(event.end_datetime)) : "");
    } else if (initialStart) {
      setTitle("");
      setDescription("");
      setStart(toLocalInputValue(initialStart));
      setEnd("");
    }
  }, [event, initialStart]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        start_datetime: new Date(start).toISOString(),
        end_datetime: end ? new Date(end).toISOString() : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{event ? "일정 수정" : "새 일정"}</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700">
            <X size={18} strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
              placeholder="일정 제목"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-navy-500">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
              placeholder="선택 사항"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">시작 일시</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-500">종료 일시</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
              />
              <p className="mt-1 text-xs text-navy-400">비워두면 하루 종일 일정으로 처리됩니다.</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {event ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-60"
              >
                <Trash2 size={14} strokeWidth={2.25} />
                삭제
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={saving || !title.trim() || !start}
              className="rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
