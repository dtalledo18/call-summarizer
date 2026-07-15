"use client";

import { useCallback, useRef, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (f && !f.type.startsWith("audio/")) {
      setError("Please upload an audio file.");
      return;
    }
    setError(null);
    setFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch("/api/summarize-call", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-xl font-bold text-[#1e3a5f] mb-1">
            Call Summarizer
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Upload a call recording. It will be transcribed, summarized into a
            lead report, and emailed to the team automatically.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Audio file
              </label>

              <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => inputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ${
                      isDragging
                          ? "border-[#1e3a5f] bg-blue-50"
                          : file
                              ? "border-[#1e3a5f]/40 bg-slate-50"
                              : "border-slate-300 bg-slate-50 hover:border-[#1e3a5f]/50 hover:bg-slate-100"
                  }`}
              >
                <input
                    ref={inputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                />

                <svg
                    className={`w-9 h-9 ${
                        isDragging ? "text-[#1e3a5f]" : "text-slate-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                >
                  <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                  />
                </svg>

                {file ? (
                    <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-slate-700 break-all max-w-[280px]">
                    {file.name}
                  </span>
                      <span className="text-xs text-slate-400">
                    {formatSize(file.size)} · click or drop to replace
                  </span>
                      <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickFile(null);
                            if (inputRef.current) inputRef.current.value = "";
                          }}
                          className="mt-2 text-xs text-red-500 hover:text-red-600 underline"
                      >
                        Remove file
                      </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-slate-600">
                    Drag & drop your audio file here
                  </span>
                      <span className="text-xs text-slate-400">
                    or click to browse · mp3, wav, m4a, etc.
                  </span>
                    </div>
                )}
              </div>
            </div>

            <button
                type="submit"
                disabled={!file || loading}
                className="w-full bg-[#1e3a5f] text-white font-medium py-2.5 rounded-lg hover:bg-[#16304d] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Processing..." : "Summarize & Send"}
            </button>
          </form>

          {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
          )}

          {summary && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">
                  Summary sent to the team ✅
                </h2>
                <pre className="whitespace-pre-wrap text-sm bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-700 font-mono">
              {summary}
            </pre>
              </div>
          )}
        </div>
      </main>
  );
}