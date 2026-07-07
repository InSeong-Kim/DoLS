"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { SearchStateProvider } from "@/lib/searchState";

const NO_SIDEBAR_PREFIXES = ["/login", "/register", "/shared"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hideSidebar) {
    return <main className="min-h-screen bg-navy-50">{children}</main>;
  }

  // SearchStateProvider를 이 레벨(레이아웃)에 둬서, /search와 다른 페이지 사이를
  // 오가도 이 컴포넌트 자체는 언마운트되지 않아 검색 상태가 유지됩니다.
  return (
    <SearchStateProvider>
      <div className="flex min-h-screen bg-navy-50">
        <Sidebar />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</div>
        </main>
      </div>
    </SearchStateProvider>
  );
}
