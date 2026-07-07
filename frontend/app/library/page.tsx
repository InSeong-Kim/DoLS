"use client";

import { useEffect, useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import { api } from "@/lib/api";
import type { SavedPaper, UploadedPaper } from "@/types";

type ReadFilter = "all" | "read" | "unread";

export default function LibraryPage() {
  const [uploads, setUploads] = useState<UploadedPaper[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [savedFilter, setSavedFilter] = useState<ReadFilter>("all");
  const [savedLoading, setSavedLoading] = useState(true);

  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const [qaMessages, setQaMessages] = useState<Record<string, { question: string; answer: string }[]>>({});

  useEffect(() => {
    api.listUploads().then(setUploads).catch(() => {});
  }, []);

  useEffect(() => {
    setSavedLoading(true);
    api
      .listSavedPapers(savedFilter)
      .then(setSavedPapers)
      .catch(() => {})
      .finally(() => setSavedLoading(false));
  }, [savedFilter]);

  async function handleFileSelected(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const newUpload = await api.uploadFile(formData);
      setUploads((prev) => [newUpload, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(id: string) {
    try {
      const { url } = await api.getUploadDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "다운로드 링크 생성에 실패했습니다.");
    }
  }

  async function handleDeleteUpload(id: string) {
    if (!confirm("이 PDF를 삭제하시겠습니까?")) return;
    try {
      await api.deleteUpload(id);
      setUploads((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  async function handleShareToggle(next: boolean) {
    setShareLoading(true);
    setShareError(null);
    try {
      if (next) {
        const { shareUrl: url } = await api.createShare();
        setShareUrl(url);
        setShareEnabled(true);
      } else {
        await api.revokeShare();
        setShareEnabled(false);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "공유 설정 변경에 실패했습니다.");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  function updateSavedPaperLocal(id: string, patch: Partial<SavedPaper>) {
    setSavedPapers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleToggleRead(paper: SavedPaper) {
    try {
      await api.updateSavedPaper(paper.id, { is_read: !paper.is_read });
      updateSavedPaperLocal(paper.id, { is_read: !paper.is_read });
    } catch {
      // 무시: 읽음 상태 갱신 실패는 조용히 넘어갑니다.
    }
  }

  async function handleMemoBlur(paper: SavedPaper, memo: string) {
    if (memo === (paper.memo ?? "")) return;
    try {
      await api.updateSavedPaper(paper.id, { memo });
      updateSavedPaperLocal(paper.id, { memo });
    } catch {
      // 무시
    }
  }

  async function handleTagsBlur(paper: SavedPaper, tagsText: string) {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await api.updateSavedPaper(paper.id, { tags });
      updateSavedPaperLocal(paper.id, { tags });
    } catch {
      // 무시
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm("저장을 취소하시겠습니까?")) return;
    try {
      await api.deleteSavedPaper(id);
      setSavedPapers((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // 무시
    }
  }

  async function handleAsk(paper: SavedPaper, question: string) {
    try {
      const { answer } = await api.askAboutPaper({
        pmid: paper.pmid,
        title: paper.title,
        abstract: paper.abstract ?? undefined,
        question,
      });
      setQaMessages((prev) => ({
        ...prev,
        [paper.id]: [...(prev[paper.id] ?? []), { question, answer }],
      }));
    } catch (err) {
      setQaMessages((prev) => ({
        ...prev,
        [paper.id]: [
          ...(prev[paper.id] ?? []),
          { question, answer: err instanceof Error ? `오류: ${err.message}` : "답변을 가져오지 못했습니다." },
        ],
      }));
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">라이브러리</h1>
        <p className="mt-1 text-sm text-navy-400">업로드한 PDF와 저장한 논문을 관리하세요.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-navy-900">PDF 업로드</h2>
        <UploadDropzone onFileSelected={handleFileSelected} uploading={uploading} />
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

        <div className="rounded-lg border border-navy-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-navy-400">
              업로드된 파일 ({uploads.length})
            </span>
            <ShareToggle
              enabled={shareEnabled}
              loading={shareLoading}
              onToggle={handleShareToggle}
            />
          </div>

          {shareError && <p className="mb-2 text-xs text-red-600">{shareError}</p>}
          {shareEnabled && shareUrl && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-navy-50 px-3 py-2 text-xs">
              <span className="truncate text-navy-600">{shareUrl}</span>
              <button
                onClick={handleCopyShareUrl}
                className="shrink-0 font-medium text-navy-700 underline"
              >
                {copyDone ? "복사됨" : "복사"}
              </button>
            </div>
          )}

          {uploads.length === 0 ? (
            <p className="text-sm text-navy-400">아직 업로드한 파일이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {uploads.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <button
                      onClick={() => handleDownload(u.id)}
                      className="truncate text-left font-medium text-navy-800 hover:text-navy-600 hover:underline"
                      title="클릭하면 새 탭에서 열립니다"
                    >
                      {u.filename}
                    </button>
                    <p className="text-xs text-navy-400">
                      {new Date(u.upload_date).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => handleDownload(u.id)}
                      className="text-xs font-medium text-navy-600 underline"
                    >
                      다운로드
                    </button>
                    <button
                      onClick={() => handleDeleteUpload(u.id)}
                      className="text-xs font-medium text-red-500 underline"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">저장한 PubMed 논문</h2>
          <div className="flex gap-1 rounded-md bg-navy-50 p-1 text-xs">
            {(["all", "unread", "read"] as ReadFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setSavedFilter(f)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  savedFilter === f ? "bg-white text-navy-900 shadow-sm" : "text-navy-400"
                }`}
              >
                {f === "all" ? "전체" : f === "read" ? "읽음" : "안읽음"}
              </button>
            ))}
          </div>
        </div>

        {savedLoading ? (
          <p className="text-sm text-navy-400">불러오는 중...</p>
        ) : savedPapers.length === 0 ? (
          <p className="text-sm text-navy-400">저장한 논문이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {savedPapers.map((paper) => (
              <SavedPaperRow
                key={paper.id}
                paper={paper}
                messages={qaMessages[paper.id] ?? []}
                onToggleRead={() => handleToggleRead(paper)}
                onMemoBlur={(memo) => handleMemoBlur(paper, memo)}
                onTagsBlur={(tags) => handleTagsBlur(paper, tags)}
                onDelete={() => handleDeleteSaved(paper.id)}
                onAsk={(question) => handleAsk(paper, question)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ShareToggle({
  enabled,
  loading,
  onToggle,
}: {
  enabled: boolean;
  loading: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-navy-500">
      공유 링크 생성
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        disabled={loading}
        className={`h-5 w-9 rounded-full transition-colors ${enabled ? "bg-navy-700" : "bg-navy-200"}`}
      >
        <span
          className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function SavedPaperRow({
  paper,
  messages,
  onToggleRead,
  onMemoBlur,
  onTagsBlur,
  onDelete,
  onAsk,
}: {
  paper: SavedPaper;
  messages: { question: string; answer: string }[];
  onToggleRead: () => void;
  onMemoBlur: (memo: string) => void;
  onTagsBlur: (tags: string) => void;
  onDelete: () => void;
  onAsk: (question: string) => Promise<void>;
}) {
  const [memo, setMemo] = useState(paper.memo ?? "");
  const [tagsText, setTagsText] = useState(paper.tags.join(", "));
  const [qaOpen, setQaOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  async function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    const q = question.trim();
    setQuestion("");
    await onAsk(q);
    setAsking(false);
  }

  return (
    <div className="rounded-lg border border-navy-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-navy-900">{paper.title}</h3>
          <p className="text-sm text-navy-400">
            {paper.journal ?? "저널 정보 없음"}
            {paper.pub_year ? ` · ${paper.pub_year}` : ""}
          </p>
        </div>
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-navy-500 underline"
        >
          PubMed
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-500">개인 메모</label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={() => onMemoBlur(memo)}
            placeholder="메모를 입력하세요"
            className="w-full rounded-md border border-navy-200 px-2.5 py-1.5 text-sm outline-none focus:border-navy-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-navy-500">태그 (쉼표로 구분)</label>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            onBlur={() => onTagsBlur(tagsText)}
            placeholder="예: 유전자조절, 약물저항성"
            className="w-full rounded-md border border-navy-200 px-2.5 py-1.5 text-sm outline-none focus:border-navy-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={onToggleRead}
          className={`rounded-full px-2.5 py-1 font-medium ${
            paper.is_read ? "bg-navy-700 text-white" : "bg-navy-50 text-navy-500"
          }`}
        >
          {paper.is_read ? "읽음" : "안읽음"}
        </button>
        <button onClick={() => setQaOpen((v) => !v)} className="font-medium text-navy-600 underline">
          {qaOpen ? "AI 질의응답 닫기" : "AI에게 질문하기"}
        </button>
        <button onClick={onDelete} className="font-medium text-red-500 underline">
          저장 취소
        </button>
      </div>

      {qaOpen && (
        <div className="space-y-3 rounded-md bg-navy-50 p-3">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-navy-400">이 논문의 초록을 바탕으로 질문해보세요.</p>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-xs font-medium text-navy-700">Q. {m.question}</p>
                <p className="whitespace-pre-wrap text-xs text-navy-600">A. {m.answer}</p>
              </div>
            ))}
            {asking && <p className="text-xs text-navy-400">답변 생성 중...</p>}
          </div>
          <form onSubmit={handleAskSubmit} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="질문을 입력하세요"
              className="flex-1 rounded-md border border-navy-200 px-2.5 py-1.5 text-xs outline-none focus:border-navy-500"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="rounded-md bg-navy-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
