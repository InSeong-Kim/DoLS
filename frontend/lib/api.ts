import { supabase } from "./supabaseClient";
import type {
  KeywordSubscription,
  PaperAnalysisResult,
  Profile,
  PubmedArticle,
  SavedPaper,
  SubscriptionCheckResult,
  SummaryResult,
  UploadedPaper,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
export const ACCESS_TOKEN_KEY = "dols_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function tryRefreshSession(): Promise<boolean> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return false;
  setAccessToken(data.session.access_token);
  return true;
}

// 백엔드로 보내는 모든 요청에 Authorization 헤더를 자동으로 붙이는 fetch 래퍼.
// Supabase access token은 약 1시간 후 만료되므로, 401을 받으면 세션을 한 번
// 갱신해 재시도하고, 그래도 실패하면 로그인 페이지로 보냅니다.
async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && !retried) {
    const refreshed = await tryRefreshSession();
    if (refreshed) return request<T>(path, options, true);
    clearAccessToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  if (!response.ok) {
    let message = `요청이 실패했습니다. (status ${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // 응답 본문이 JSON이 아닌 경우 기본 메시지를 사용합니다.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  me: () => request<{ id: string; email: string | null }>("/api/auth/me"),
  getProfile: () => request<Profile>("/api/auth/profile"),
  updateProfile: (research_interest: string | null) =>
    request<Profile>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ research_interest }),
    }),

  search: (body: {
    keyword: string;
    retmax?: number;
    sort?: "relevance" | "date";
    author?: string;
    year?: string;
    journal?: string;
    forceRefresh?: boolean;
  }) =>
    request<{ articles: PubmedArticle[]; fromCache: boolean }>("/api/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  summarize: (body: { keyword: string; articles: PubmedArticle[]; forceRefresh?: boolean }) =>
    request<{ summary: SummaryResult; fromCache: boolean }>("/api/summarize", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  analyzePaper: (article: PubmedArticle) =>
    request<{ analysis: PaperAnalysisResult }>("/api/summary/paper", {
      method: "POST",
      body: JSON.stringify(article),
    }),

  explainTerm: (term: string) =>
    request<{ explanation: string }>("/api/summary/explain", {
      method: "POST",
      body: JSON.stringify({ term }),
    }),

  askAboutPaper: (body: { pmid?: string; title?: string; abstract?: string; question: string }) =>
    request<{ answer: string }>("/api/summary/ask", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listSubscriptions: () => request<KeywordSubscription[]>("/api/subscriptions"),
  subscribe: (keyword: string) =>
    request<KeywordSubscription>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    }),
  checkSubscriptions: () => request<SubscriptionCheckResult[]>("/api/subscriptions/check"),
  ackSubscription: (id: string) =>
    request<KeywordSubscription>(`/api/subscriptions/${id}/ack`, { method: "POST" }),
  unsubscribe: (id: string) => request<void>(`/api/subscriptions/${id}`, { method: "DELETE" }),

  uploadFile: (formData: FormData) =>
    request<UploadedPaper>("/api/library/upload", { method: "POST", body: formData }),
  listUploads: () => request<UploadedPaper[]>("/api/library/uploads"),
  getUploadDownloadUrl: (id: string) =>
    request<{ url: string }>(`/api/library/uploads/${id}/download`),
  deleteUpload: (id: string) => request<void>(`/api/library/uploads/${id}`, { method: "DELETE" }),

  savePaper: (paper: PubmedArticle) =>
    request<SavedPaper>("/api/library/saved-papers", {
      method: "POST",
      body: JSON.stringify({
        pmid: paper.pmid,
        title: paper.title,
        authors: paper.authors,
        journal: paper.journal,
        pub_year: paper.pubYear,
        abstract: paper.abstract,
      }),
    }),
  listSavedPapers: (filter: "all" | "read" | "unread" = "all") =>
    request<SavedPaper[]>(`/api/library/saved-papers?filter=${filter}`),
  updateSavedPaper: (
    id: string,
    patch: Partial<Pick<SavedPaper, "memo" | "tags" | "is_read">>
  ) =>
    request<SavedPaper>(`/api/library/saved-papers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteSavedPaper: (id: string) =>
    request<void>(`/api/library/saved-papers/${id}`, { method: "DELETE" }),

  createShare: () => request<{ token: string; shareUrl: string }>("/api/library/share", { method: "POST" }),
  revokeShare: () => request<void>("/api/library/share", { method: "DELETE" }),
  getSharedLibrary: (token: string) =>
    request<{ files: { filename: string; upload_date: string; downloadUrl: string | null }[] }>(
      `/api/library/shared/${token}`
    ),
};
