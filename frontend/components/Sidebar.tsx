"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { clearAccessToken } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/", label: "대시보드" },
  { href: "/search", label: "논문 검색" },
  { href: "/library", label: "라이브러리" },
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
        <div className="px-6 py-8">
          <span className="text-2xl font-semibold tracking-tight text-navy-900">DoLS</span>
          <p className="mt-1 text-xs text-navy-400">
            PubMed 문헌 요약 &amp; 트렌드 분석
          </p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-navy-100 text-navy-900"
                    : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-6">
          <button
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Mobile: 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-navy-200 bg-white md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-3 text-center text-xs font-medium ${
                active ? "text-navy-900" : "text-navy-400"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 py-3 text-center text-xs font-medium text-navy-400"
        >
          로그아웃
        </button>
      </nav>
    </>
  );
}
