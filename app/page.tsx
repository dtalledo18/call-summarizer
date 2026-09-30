"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
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
      // 1. Upload the file directly to Vercel Blob from the browser, as a
      // PRIVATE blob — never publicly accessible by URL, only your server
      // (with BLOB_READ_WRITE_TOKEN) can read it back.
      // This also bypasses the ~4.5MB body-size limit on serverless function
      // requests, since the audio bytes never pass through our API route.
      setStatusText("Uploading audio...");
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/blob-upload",
      });

      // 2. Send only the blob's pathname (tiny JSON payload) to our API
      // route, which reads it back privately server-side and hands it to Gemini.
      setStatusText("Transcribing & summarizing...");
      const res = await fetch("/api/summarize-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioPath: blob.pathname,
          filename: file.name,
          contentType: file.type,
        }),
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
      setStatusText(null);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8">
          <h1 className="text-xl font-bold text-white mb-1">Call Summarizer</h1>
          <p className="text-sm text-gray-400 mb-6">
            Upload a call recording. It will be transcribed, summarized into a
            lead report, and emailed to the team automatically.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Audio file
              </label>

              <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => inputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ${
                      isDragging
                          ? "border-blue-500 bg-blue-500/10"
                          : file
                              ? "border-blue-500/40 bg-[#151515]"
                              : "border-[#2a2a2a] bg-[#151515] hover:border-blue-500/40 hover:bg-[#1a1a1a]"
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
                    className={`w-9 h-9 ${isDragging ? "text-blue-400" : "text-gray-500"}`}
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
                  <span className="text-sm font-medium text-gray-200 break-all max-w-[280px]">
                    {file.name}
                  </span>
                      <span className="text-xs text-gray-500">
                    {formatSize(file.size)} · click or drop to replace
                  </span>
                      <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pickFile(null);
                            if (inputRef.current) inputRef.current.value = "";
                          }}
                          className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                      >
                        Remove file
                      </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-gray-300">
                    Drag & drop your audio file here
                  </span>
                      <span className="text-xs text-gray-500">
                    or click to browse · mp3, wav, m4a, etc.
                  </span>
                    </div>
                )}
              </div>
            </div>

            <button
                type="submit"
                disabled={!file || loading}
                className="w-full bg-blue-500 text-white font-medium py-2.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? statusText ?? "Processing..." : "Summarize & Send"}
            </button>
          </form>

          {error && (
              <div className="mt-6 p-4 bg-red-950/40 border border-red-900 rounded-lg text-sm text-red-300">
                {error}
              </div>
          )}

          {summary && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-200 mb-2">
                  Summary sent to the team ✅
                </h2>
                <pre className="whitespace-pre-wrap text-sm bg-[#151515] border border-[#2a2a2a] rounded-lg p-4 text-gray-300 font-mono">
              {summary}
            </pre>
              </div>
          )}
        </div>
      </main>
  );
}