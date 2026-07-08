"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon, RefreshCw, BellPlus, BellOff, Bell, X, AlertCircle, Inbox } from "lucide-react";
import { api, ApiError, getAccessToken } from "@/lib/api";
import PaperCard from "@/components/PaperCard";
import SummaryPanel from "@/components/SummaryPanel";
import { useSearchState } from "@/lib/searchState";
import type { KeywordSubscription, PubmedArticle, SubscriptionCheckResult } from "@/types";

const QUICK_SEARCH_SUGGESTIONS = ["TP53", "CRISPR", "Alzheimer biomarker", "single-cell RNA-seq"];

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

  const {
    keyword,
    setKeyword,
    author,
    setAuthor,
    year,
    setYear,
    journal,
    setJournal,
    sort,
    setSort,
    retmax,
    setRetmax,
    searched,
    setSearched,
    articles,
    setArticles,
    summary,
    setSummary,
  } = useSearchState();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [savedPmids, setSavedPmids] = useState<Set<string>>(new Set());
  const [savingPmid, setSavingPmid] = useState<string | null>(null);

  const [subscriptions, setSubscriptions] = useState<KeywordSubscription[]>([]);
  const [checks, setChecks] = useState<SubscriptionCheckResult[]>([]);
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

  const keywordParam = searchParams?.get("keyword") ?? null;

  // keywordParam(URL의 ?keyword=)이 바뀔 때마다 재검색합니다. 마운트 시 1회만 실행하면
  // 이미 /search에 있는 상태에서 다른 keyword로 다시 들어왔을 때(예: 대시보드의 구독
  // 키워드 클릭) 쿼리 파라미터만 바뀌고 컴포넌트는 리마운트되지 않아 검색이 전혀
  // 실행되지 않는 문제가 있었습니다.
  useEffect(() => {
    if (keywordParam) {
      setKeyword(keywordParam);
      runSearch(keywordParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordParam]);

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

  // 추천 검색어 칩, AI 요약의 유전자/키워드 칩 클릭 시 그 단어로 바로 재검색합니다.
  function handleQuickSearch(term: string) {
    setKeyword(term);
    setAuthor("");
    setYear("");
    setJournal("");
    runSearch(term);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "구독 해제에 실패했습니다.");
    }
  }

  async function handleAck(id: string) {
    try {
      await api.ackSubscription(id);
      setChecks((prev) => prev.filter((c) => c.subscription.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "확인 처리에 실패했습니다.");
    }
  }

  const alreadySubscribed = subscriptions.some(
    (s) => s.keyword.toLowerCase() === keyword.trim().toLowerCase()
  );
  const hasActiveFilters = Boolean(author.trim() || year.trim() || journal.trim());

  // 정렬 드롭다운을 바꾸면 재검색 없이 즉시 화면에 반영합니다.
  // "최신순"은 이미 가진 결과를 pubYear 기준으로 바로 재정렬하고,
  // "관련도순"은 마지막으로 받아온 원래 순서를 그대로 보여줍니다
  // (PubMed는 관련도 점수 자체를 내려주지 않아 그 순서를 그대로 신뢰합니다).
  const displayedArticles = useMemo(() => {
    if (sort === "date") {
      return [...articles].sort((a, b) => (b.pubYear ?? -Infinity) - (a.pubYear ?? -Infinity));
    }
    return articles;
  }, [articles, sort]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">논문 검색</h1>
        <p className="mt-1 text-sm text-navy-400">PubMed 문헌을 검색하고 AI 요약을 확인하세요.</p>
      </div>

      {isLoggedIn && subscriptions.length > 0 && (
        <section className="rounded-lg border border-navy-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-navy-400">
            <Bell size={13} strokeWidth={2.25} />
            구독한 키워드
          </h2>
          <div className="flex flex-wrap gap-2">
            {subscriptions.map((sub) => {
              const check = checks.find((c) => c.subscription.id === sub.id);
              const newCount = check?.newArticles.length ?? 0;
              return (
                <div key={sub.id} className="flex items-center gap-1">
                  <button
                    onClick={() => handleQuickSearch(sub.keyword)}
                    title={`"${sub.keyword}" 바로 검색`}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      newCount > 0 ? "bg-navy-800 text-white shadow-sm" : "bg-navy-50 text-navy-500"
                    }`}
                  >
                    {sub.keyword}
                    {newCount > 0 ? ` · 새 논문 ${newCount}편` : ""}
                  </button>
                  {newCount > 0 && (
                    <button
                      onClick={() => handleAck(sub.id)}
                      className="text-navy-300 hover:text-navy-600"
                      title="확인 완료로 표시"
                    >
                      <BellOff size={14} strokeWidth={2.25} />
                    </button>
                  )}
                  <button
                    onClick={() => handleUnsubscribe(sub.id)}
                    className="text-navy-300 hover:text-red-500"
                    title="구독 해제"
                  >
                    <X size={14} strokeWidth={2.25} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-navy-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300"
            />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="검색 키워드 (예: TP53 hepatocellular carcinoma)"
              className="w-full rounded-md border border-navy-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-md bg-navy-800 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-navy-900 disabled:opacity-60"
          >
            <SearchIcon size={15} strokeWidth={2.25} />
            {loading ? "검색 중..." : "검색"}
          </button>
          {searched && (
            <button
              type="button"
              onClick={handleForceRefresh}
              disabled={loading || !keyword.trim()}
              title="캐시를 무시하고 PubMed에서 최신 결과를 다시 가져옵니다"
              className="flex items-center gap-1.5 rounded-md border border-navy-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={2.25} />
              새로고침
            </button>
          )}
          {isLoggedIn && (
            <button
              type="button"
              onClick={handleSubscribeKeyword}
              disabled={!keyword.trim() || alreadySubscribed || subscribing}
              className="flex items-center gap-1.5 rounded-md border border-navy-300 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
            >
              {alreadySubscribed ? <Bell size={14} strokeWidth={2.25} /> : <BellPlus size={14} strokeWidth={2.25} />}
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
        <p className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} strokeWidth={2.25} className="shrink-0" />
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !searched && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-navy-200 px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">
            <SearchIcon size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm text-navy-400">검색어를 입력해 PubMed 논문을 찾아보세요.</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {QUICK_SEARCH_SUGGESTIONS.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleQuickSearch(term)}
                className="rounded-full border border-navy-200 bg-white px-3 py-1 text-xs font-medium text-navy-600 hover:border-navy-400 hover:text-navy-900"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && searched && articles.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-navy-200 px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-400">
            <Inbox size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm text-navy-400">검색 결과가 없습니다.</p>
          <p className="text-xs text-navy-300">
            {hasActiveFilters
              ? "저자·연도·저널 필터를 없애거나 다른 키워드로 다시 검색해보세요."
              : "철자를 확인하거나 더 넓은 키워드로 다시 검색해보세요."}
          </p>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {displayedArticles.map((a) => {
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
              <p className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={15} strokeWidth={2.25} className="shrink-0" />
                {summaryError}
              </p>
            )}
            {!summaryLoading && summary && <SummaryPanel summary={summary} />}
          </div>
        </div>
      )}
    </div>
  );
}
