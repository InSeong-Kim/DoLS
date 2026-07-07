"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { setAccessToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      setAccessToken(data.session.access_token);
      router.push("/search");
      return;
    }

    // 이메일 확인이 필요한 Supabase 프로젝트 설정인 경우 세션이 즉시 생성되지 않습니다.
    setInfo("확인 이메일을 보냈습니다. 이메일 인증 후 로그인해주세요.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-navy-200 bg-white p-8">
        <h1 className="text-2xl font-semibold text-navy-900">DoLS</h1>
        <p className="mt-1 mb-6 text-sm text-navy-400">회원가입하고 나만의 문헌 라이브러리를 만드세요.</p>

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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-navy-600">비밀번호 확인</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-navy-200 px-3 py-2 text-sm outline-none focus:border-navy-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-navy-600">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-navy-800 py-2 text-sm font-medium text-white hover:bg-navy-900 disabled:opacity-60"
          >
            {submitting ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-navy-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-medium text-navy-700 underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
