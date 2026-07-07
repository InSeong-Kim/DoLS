"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { setAccessToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError || !data.session) {
      setError(signInError?.message ?? "로그인에 실패했습니다.");
      return;
    }

    setAccessToken(data.session.access_token);
    router.push("/search");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-navy-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-navy-900">DoLS</h1>
        <p className="mt-1 mb-6 text-sm text-navy-400">로그인하고 문헌 검색을 시작하세요.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-navy-800 py-2 text-sm font-medium text-white hover:bg-navy-900 disabled:opacity-60"
          >
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-navy-400">
          계정이 없으신가요?{" "}
          <Link href="/register" className="font-medium text-navy-700 underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
