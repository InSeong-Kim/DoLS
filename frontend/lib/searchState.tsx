"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { PubmedArticle, SummaryResult } from "@/types";

interface SearchStateValue {
  keyword: string;
  setKeyword: (v: string) => void;
  author: string;
  setAuthor: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  journal: string;
  setJournal: (v: string) => void;
  sort: "relevance" | "date";
  setSort: (v: "relevance" | "date") => void;
  retmax: number;
  setRetmax: (v: number) => void;
  searched: boolean;
  setSearched: (v: boolean) => void;
  articles: PubmedArticle[];
  setArticles: (v: PubmedArticle[]) => void;
  summary: SummaryResult | null;
  setSummary: (v: SummaryResult | null) => void;
}

const SearchStateContext = createContext<SearchStateValue | null>(null);

// /search 페이지의 검색 상태를 AppShell(레이아웃) 레벨에서 들고 있어서,
// /library 등 다른 페이지로 이동했다가 돌아와도 검색 결과가 유지됩니다.
export function SearchStateProvider({ children }: { children: React.ReactNode }) {
  const [keyword, setKeyword] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [sort, setSort] = useState<"relevance" | "date">("relevance");
  const [retmax, setRetmax] = useState(10);
  const [searched, setSearched] = useState(false);
  const [articles, setArticles] = useState<PubmedArticle[]>([]);
  const [summary, setSummary] = useState<SummaryResult | null>(null);

  const value = useMemo<SearchStateValue>(
    () => ({
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
    }),
    [keyword, author, year, journal, sort, retmax, searched, articles, summary]
  );

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>;
}

export function useSearchState(): SearchStateValue {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error("useSearchState must be used within SearchStateProvider");
  return ctx;
}
