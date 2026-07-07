"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import PaperCard from "@/components/PaperCard";
import type { SavedPaper, SubscriptionCheckResult, UploadedPaper } from "@/types";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [uploads, setUploads] = useState<UploadedPaper[]>([]);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [newPaperBadges, setNewPaperBadges] = useState<SubscriptionCheckResult[]>([]);

  const [researchInterest, setResearchInterest] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestSaved, setInterestSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [saved, uploaded, subs, checks, profile] = await Promise.all([
          api.listSavedPapers(),
          api.listUploads(),
          api.listSubscriptions(),
          api.checkSubscriptions(),
          api.getProfile(),
        ]);
        setSavedPapers(saved);
        setUploads(uploaded);
        setSubscriptionCount(subs.length);
        setNewPaperBadges(checks.filter((c) => c.newArticles.length > 0));
        setResearchInterest(profile.research_interest ?? "");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return; // 이미 /login으로 이동됨
        setError(err instanceof Error ? err.message : "대시보드 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveInterest() {
    setSavingInterest(true);
    setInterestSaved(false);
    try {
      await api.updateProfile(researchInterest.trim() || null);
      setInterestSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "연구 관심사 저장에 실패했습니다.");
    } finally {
      setSavingInterest(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-navy-400">불러오는 중...</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">대시보드</h1>
        <p className="mt-1 text-sm text-navy-400">DoLS 사용 현황을 한눈에 확인하세요.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="저장 논문 수" value={savedPapers.length} />
        <StatCard label="업로드 PDF 수" value={uploads.length} />
        <StatCard label="구독 중인 키워드 수" value={subscriptionCount} />
      </div>

      {newPaperBadges.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-navy-900">새 논문이 있는 구독 키워드</h2>
          <div className="flex flex-wrap gap-2">
            {newPaperBadges.map(({ subscription, newArticles }) => (
              <Link
                key={subscription.id}
                href={`/search?keyword=${encodeURIComponent(subscription.keyword)}`}
                className="rounded-full bg-navy-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-900"
              >
                {subscription.keyword} · 새 논문 {newArticles.length}편
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-navy-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold text-navy-900">내 연구 관심사</h2>
        <p className="mb-3 text-xs text-navy-400">
          예: "간암에서의 TP53 돌연변이와 약물 저항성". 등록하면 검색 결과에 개인화 관련성이 표시됩니다.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={researchInterest}
            onChange={(e) => setResearchInterest(e.target.value)}
            placeholder="한 줄로 연구 관심사를 입력하세요"
            className="flex-1 rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
          />
          <button
            onClick={handleSaveInterest}
            disabled={savingInterest}
            className="rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-900 disabled:opacity-60"
          >
            {savingInterest ? "저장 중..." : "저장"}
          </button>
        </div>
        {interestSaved && <p className="mt-2 text-xs text-navy-500">저장되었습니다.</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-900">최근 저장한 논문</h2>
        {savedPapers.length === 0 ? (
          <p className="text-sm text-navy-400">아직 저장한 논문이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {savedPapers.slice(0, 5).map((p) => (
              <PaperCard
                key={p.id}
                article={{
                  pmid: p.pmid,
                  title: p.title,
                  authors: p.authors,
                  journal: p.journal ?? "",
                  pubYear: p.pub_year,
                  abstract: p.abstract ?? "",
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-navy-900">최근 업로드한 PDF</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-navy-400">아직 업로드한 PDF가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 bg-white">
            {uploads.slice(0, 5).map((u) => (
              <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-navy-700">{u.filename}</span>
                <span className="text-navy-400">{new Date(u.upload_date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-navy-200 bg-white p-5">
      <p className="text-xs text-navy-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy-900">{value}</p>
    </div>
  );
}
