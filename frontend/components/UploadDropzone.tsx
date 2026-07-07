"use client";

import { useRef, useState } from "react";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  uploading?: boolean;
}

export default function UploadDropzone({ onFileSelected, uploading }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateAndEmit(file: File | undefined | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("파일 크기는 20MB를 초과할 수 없습니다.");
      return;
    }
    setError(null);
    onFileSelected(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          validateAndEmit(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? "border-navy-500 bg-navy-50" : "border-navy-200 bg-white"
        }`}
      >
        <p className="text-sm font-medium text-navy-700">
          {uploading ? "업로드 중..." : "PDF를 드래그하거나 클릭해서 선택하세요"}
        </p>
        <p className="mt-1 text-xs text-navy-400">PDF 전용 · 최대 20MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => validateAndEmit(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
