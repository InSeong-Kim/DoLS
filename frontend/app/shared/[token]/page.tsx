"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface SharedFile {
  filename: string;
  upload_date: string;
  downloadUrl: string | null;
}

export default function SharedLibraryPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<"loading" | "ok" | "not_found">("loading");
  const [files, setFiles] = useState<SharedFile[]>([]);

  useEffect(() => {
    api
      .getSharedLibrary(params.token)
      .then((res) => {
        setFiles(res.files);
        setStatus("ok");
      })
      .catch(() => setStatus("not_found"));
  }, [params.token]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-navy-400">불러오는 중...</p>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-navy-900">링크를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm text-navy-400">
            공유가 종료되었거나 존재하지 않는 링크입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-navy-900">DoLS 공유 라이브러리</h1>
      <p className="mt-1 mb-8 text-sm text-navy-400">공개적으로 공유된 PDF 목록입니다.</p>

      {files.length === 0 ? (
        <p className="text-sm text-navy-400">공유된 파일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-lg border border-navy-200 bg-white">
          {files.map((f, idx) => (
            <li key={idx} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-800">{f.filename}</p>
                <p className="text-xs text-navy-400">{new Date(f.upload_date).toLocaleString()}</p>
              </div>
              {f.downloadUrl ? (
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-navy-600 underline"
                >
                  다운로드
                </a>
              ) : (
                <span className="shrink-0 text-xs text-navy-300">다운로드 불가</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
