"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError, getAccessToken } from "@/lib/api";
import PaperCard from "@/components/PaperCard";
import SummaryPanel from "@/components/SummaryPanel";
import type {
  KeywordSubscription,
  PubmedArticle,
  SubscriptionCheckResult,
  SummaryResult,
} from "@/types";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-navy-200 bg-white p-5 space-y-3">
      <div className="h-4 w-3/4 rounded bg-navy-100" />
      <div className="h-3 w-1/2 rounded bg-navy-100" />
      <div className="h-3 w-full rounded bg-navy-100" />
      <div className="h-3 w-5/6 rounded bg-navy-100" />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-navy-400">불러오는 중...</p>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [retmax, setRetmax] = useState(10);

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<PubmedArticle[]>([]);

  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [savedPmids, setSavedPmids] = useState<Set<string>>(new Set());
  const [savingPmid, setSavingPmid] = useState<string | null>(null);

  const [subscriptions, setSubscriptions] = useState<KeywordSubscription[]>([]);
  const [checks, setChecks] = useState<SubscriptionCheckResult[]>([]);
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getAccessToken()));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    api
      .listSavedPapers()
      .then((list) => setSavedPmids(new Set(list.map((p) => p.pmid))))
      .catch(() => {});
    refreshSubscriptions();
  }, [isLoggedIn]);

  useEffect(() => {
    const prefill = searchParams?.get("keyword");
    if (prefill) {
      setKeyword(prefill);
      runSearch(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSubscriptions() {
    try {
      const [subs, checkResults] = await Promise.all([
        api.listSubscriptions(),
        api.checkSubscriptions(),
      ]);
      setSubscriptions(subs);
      setChecks(checkResults);
    } catch {
      // 구독 목록 로딩 실패는 검색 기능에 영향을 주지 않습니다.
    }
  }

  async function runSearch(searchKeyword: string, forceRefresh = false) {
    if (!searchKeyword.trim()) return;

    setSearched(true);
    setLoading(true);
    setError(null);
    setSummary(null);
    setSummaryError(null);

    try {
      const { articles: results } = await api.search({
        keyword: searchKeyword.trim(),
        retmax,
        sort,
        author: author.trim() || undefined,
        year: year.trim() || undefined,
        journal: journal.trim() || undefined,
        forceRefresh,
      });
      setArticles(results);

      if (results.length > 0) {
        setSummaryLoading(true);
        try {
          const { summary: result } = await api.summarize({
            keyword: searchKeyword.trim(),
            articles: results,
            forceRefresh,
          });
          setSummary(result);
        } catch (err) {
          setSummaryError(err instanceof Error ? err.message : "AI 요약에 실패했습니다.");
        } finally {
          setSummaryLoading(false);
        }
      }
    } catch (err) {
      setArticles([]);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("검색 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(keyword);
  }

  function handleForceRefresh() {
    runSearch(keyword, true);
  }

  async function handleSave(article: PubmedArticle) {
    setSavingPmid(article.pmid);
    try {
      await api.savePaper(article);
      setSavedPmids((prev) => new Set(prev).add(article.pmid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSavingPmid(null);
    }
  }

  async function handleSubscribeKeyword() {
    if (!keyword.trim()) return;
    setSubscribing(true);
    try {
      await api.subscribe(keyword.trim());
      await refreshSubscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독에 실패했습니다.");
    } finally {
      setSubscribing(false);
    }
  }

  async function handleUnsubscribe(id: string) {
    try {
      await api.unsubscribe(id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      setChecks((prev) => prev.filter((c) => c.subscription.id !== id));
      if (expandedSubId === id) setExpandedSubId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 해제에 실패했습니다.");
    }
  }

  async function handleAck(id: string) {
    try {
      await api.ackSubscription(id);
      setChecks((prev) => prev.filter((c) => c.subscription.id !== id));
      setExpandedSubId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "확인 처리에 실패했습니다.");
    }
  }

  const alreadySubscribed = subscriptions.some(
    (s) => s.keyword.toLowerCase() === keyword.trim().toLowerCase()
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">논문 검색</h1>
        <p className="mt-1 text-sm text-navy-400">PubMed 문헌을 검색하고 AI 요약을 확인하세요.</p>
      </div>

      {isLoggedIn && subscriptions.length > 0 && (
        <section className="rounded-lg border border-navy-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
            구독한 키워드
          </h2>
          <div className="flex flex-wrap gap-2">
            {subscriptions.map((sub) => {
              const check = checks.find((c) => c.subscription.id === sub.id);
              const newCount = check?.newArticles.length ?? 0;
              return (
                <div key={sub.id} className="flex items-center gap-1">
                  <button
                    onClick={() => newCount > 0 && setExpandedSubId(expandedSubId === sub.id ? null : sub.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      newCount > 0 ? "bg-navy-800 text-white" : "bg-navy-50 text-navy-500"
                    }`}
                  >
                    {sub.keyword}
                    {newCount > 0 ? ` · 새 논문 ${newCount}편` : ""}
                  </button>
                  <button
                    onClick={() => handleUnsubscribe(sub.id)}
                    className="text-xs text-navy-300 hover:text-red-500"
                    title="구독 해제"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {expandedSubId && (
            <div className="mt-4 space-y-3 border-t border-navy-100 pt-4">
              {(() => {
                const check = checks.find((c) => c.subscription.id === expandedSubId);
                if (!check) return null;
                return (
                  <>
                    {check.newArticles.map((a) => (
                      <PaperCard key={a.pmid} article={a} />
                    ))}
                    <button
                      onClick={() => handleAck(expandedSubId)}
                      className="text-xs font-medium text-navy-600 underline"
                    >
                      확인 완료로 표시
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-navy-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색 키워드 (예: TP53 hepatocellular carcinoma)"
            className="flex-1 rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-navy-800 px-5 py-2 text-sm font-medium text-white hover:bg-navy-900 disabled:opacity-60"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
          {searched && (
            <button
              type="button"
              onClick={handleForceRefresh}
              disabled={loading || !keyword.trim()}
              title="캐시를 무시하고 PubMed에서 최신 결과를 다시 가져옵니다"
              className="rounded-md border border-navy-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              새로고침
            </button>
          )}
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleSubscribeKeyword}
              disabled={!keyword.trim() || alreadySubscribed || subscribing}
              className="rounded-md border border-navy-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              {alreadySubscribed ? "구독 중" : "이 키워드 구독"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="저자"
            className="rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="출판 연도"
            className="rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
          />
          <input
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            placeholder="저널"
            className="rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-navy-500">정렬</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "relevance" | "date")}
              className="rounded-md border border-navy-200 px-2 py-1.5 text-sm outline-none focus:border-navy-500"
            >
              <option value="relevance">관련도순</option>
              <option value="date">최신순</option>
            </select>
          </div>

          <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
            <label className="text-xs font-medium text-navy-500 shrink-0">
              논문 개수: {retmax}
            </label>
            <input
              type="range"
              min={5}
              max={30}
              value={retmax}
              onChange={(e) => setRetmax(Number(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !searched && (
        <p className="rounded-lg border border-dashed border-navy-200 px-4 py-10 text-center text-sm text-navy-400">
          검색어를 입력해 PubMed 논문을 찾아보세요.
        </p>
      )}

      {!loading && searched && articles.length === 0 && !error && (
        <p className="rounded-lg border border-dashed border-navy-200 px-4 py-10 text-center text-sm text-navy-400">
          검색 결과가 없습니다.
        </p>
      )}

      {!loading && articles.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {articles.map((a) => {
              const relevance = summary?.paper_relevance?.find((r) => r.pmid === a.pmid);
              return (
                <PaperCard
                  key={a.pmid}
                  article={a}
                  isSaved={savedPmids.has(a.pmid)}
                  saving={savingPmid === a.pmid}
                  onSave={handleSave}
                  relevance={relevance}
                />
              );
            })}
          </div>

          <div>
            {summaryLoading && (
              <div className="animate-pulse rounded-lg border border-navy-200 bg-white p-6 space-y-3">
                <div className="h-4 w-1/3 rounded bg-navy-100" />
                <div className="h-3 w-full rounded bg-navy-100" />
                <div className="h-3 w-5/6 rounded bg-navy-100" />
              </div>
            )}
            {summaryError && (
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{summaryError}</p>
            )}
            {!summaryLoading && summary && <SummaryPanel summary={summary} />}
          </div>
        </div>
      )}
    </div>
  );
}
