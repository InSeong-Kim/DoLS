"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Share2,
  Copy,
  Check,
  FileText,
  Download,
  Trash2,
  BookMarked,
  ExternalLink,
  MessageCircle,
  MessageCircleOff,
  CheckCircle2,
  Circle,
  Send,
  Search,
} from "lucide-react";
import UploadDropzone from "@/components/UploadDropzone";
import { api, getAccessToken } from "@/lib/api";
import type { SavedPaper, UploadedPaper } from "@/types";

type ReadFilter = "all" | "read" | "unread";

export default function LibraryPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [uploads, setUploads] = useState<UploadedPaper[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [savedFilter, setSavedFilter] = useState<ReadFilter>("all");
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedSearchQuery, setSavedSearchQuery] = useState("");

  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const [qaMessages, setQaMessages] = useState<Record<string, { question: string; answer: string }[]>>({});

  // 라이브러리는 로그인 전용 페이지입니다. 토큰이 없으면 보호된 API를 호출해
  // 401을 유발하고 전체 새로고침으로 튕기는 대신, 바로 클라이언트 라우팅으로
  // 조용히 로그인 화면으로 보냅니다.
  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    api.listUploads().then(setUploads).catch(() => {});
  }, [checkingAuth]);

  useEffect(() => {
    if (checkingAuth) return;
    setSavedLoading(true);
    api
      .listSavedPapers(savedFilter)
      .then(setSavedPapers)
      .catch(() => {})
      .finally(() => setSavedLoading(false));
  }, [checkingAuth, savedFilter]);

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

  const filteredSavedPapers = useMemo(() => {
    const q = savedSearchQuery.trim().toLowerCase();
    if (!q) return savedPapers;
    return savedPapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.memo ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [savedPapers, savedSearchQuery]);

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

  if (checkingAuth) {
    return <p className="text-sm text-navy-400">불러오는 중...</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">라이브러리</h1>
        <p className="mt-1 text-sm text-navy-400">업로드한 PDF와 저장한 논문을 관리하세요.</p>
      </div>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <Upload size={16} strokeWidth={2.25} className="text-navy-500" />
          PDF 업로드
        </h2>
        <UploadDropzone onFileSelected={handleFileSelected} uploading={uploading} />
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

        <div className="rounded-lg border border-navy-200 bg-white p-4 shadow-sm">
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
            <div className="mb-3 flex items-center gap-2 rounded-md bg-navy-50 px-3 py-2 text-xs ring-1 ring-inset ring-navy-100">
              <span className="truncate text-navy-600">{shareUrl}</span>
              <button
                onClick={handleCopyShareUrl}
                className="flex shrink-0 items-center gap-1 font-medium text-navy-700 hover:text-navy-900"
              >
                {copyDone ? <Check size={13} strokeWidth={2.25} /> : <Copy size={13} strokeWidth={2.25} />}
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
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={15} strokeWidth={2} className="shrink-0 text-navy-300" />
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
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      onClick={() => handleDownload(u.id)}
                      className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-900"
                    >
                      <Download size={13} strokeWidth={2.25} />
                      다운로드
                    </button>
                    <button
                      onClick={() => handleDeleteUpload(u.id)}
                      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      <Trash2 size={13} strokeWidth={2.25} />
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
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <BookMarked size={16} strokeWidth={2.25} className="text-navy-500" />
            저장한 PubMed 논문
          </h2>
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

        <div className="relative">
          <Search
            size={14}
            strokeWidth={2.25}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
          />
          <input
            value={savedSearchQuery}
            onChange={(e) => setSavedSearchQuery(e.target.value)}
            placeholder="제목, 메모, 태그로 검색"
            className="w-full rounded-md border border-navy-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-500"
          />
        </div>

        {savedLoading ? (
          <p className="text-sm text-navy-400">불러오는 중...</p>
        ) : savedPapers.length === 0 ? (
          <p className="text-sm text-navy-400">저장한 논문이 없습니다.</p>
        ) : filteredSavedPapers.length === 0 ? (
          <p className="text-sm text-navy-400">검색 결과가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {filteredSavedPapers.map((paper) => (
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
      <Share2 size={13} strokeWidth={2.25} className="text-navy-400" />
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
    <div className="rounded-lg border border-navy-200 bg-white p-5 space-y-3 shadow-sm">
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
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-navy-500 hover:text-navy-800"
        >
          <ExternalLink size={12} strokeWidth={2.25} />
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
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium shadow-sm ${
            paper.is_read ? "bg-navy-700 text-white" : "bg-navy-50 text-navy-500 shadow-none"
          }`}
        >
          {paper.is_read ? <CheckCircle2 size={13} strokeWidth={2.25} /> : <Circle size={13} strokeWidth={2.25} />}
          {paper.is_read ? "읽음" : "안읽음"}
        </button>
        <button
          onClick={() => setQaOpen((v) => !v)}
          className="flex items-center gap-1 font-medium text-navy-600 hover:text-navy-900"
        >
          {qaOpen ? <MessageCircleOff size={13} strokeWidth={2.25} /> : <MessageCircle size={13} strokeWidth={2.25} />}
          {qaOpen ? "AI 질의응답 닫기" : "AI에게 질문하기"}
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 font-medium text-red-500 hover:text-red-600">
          <Trash2 size={13} strokeWidth={2.25} />
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
              className="flex items-center gap-1 rounded-md bg-navy-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
            >
              <Send size={13} strokeWidth={2.25} />
              전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
