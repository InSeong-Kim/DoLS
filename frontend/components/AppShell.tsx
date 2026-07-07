"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const NO_SIDEBAR_PREFIXES = ["/login", "/register", "/shared"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hideSidebar) {
    return <main className="min-h-screen bg-navy-50">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-navy-50">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
