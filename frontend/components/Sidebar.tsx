"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Search, Library, LogOut, BookMarked } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { clearAccessToken } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/search", label: "논문 검색", icon: Search },
  { href: "/library", label: "라이브러리", icon: Library },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    clearAccessToken();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop / tablet: 좌측 고정 사이드바 */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-navy-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-8">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 text-white shadow-sm">
            <BookMarked size={17} strokeWidth={2.25} />
          </span>
          <div>
            <span className="block text-xl font-semibold tracking-tight text-navy-900">DoLS</span>
            <p className="text-xs text-navy-400">PubMed 문헌 요약 &amp; 트렌드 분석</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-navy-100 text-navy-900"
                    : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-navy-700" />
                )}
                <Icon size={17} strokeWidth={2} className={active ? "text-navy-700" : "text-navy-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-6">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <LogOut size={16} strokeWidth={2} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Mobile: 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-navy-200 bg-white shadow-[0_-2px_8px_rgba(20,31,54,0.06)] md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                active ? "text-navy-900" : "text-navy-400"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 2} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-navy-400"
        >
          <LogOut size={18} strokeWidth={2} />
          로그아웃
        </button>
      </nav>
    </>
  );
}
