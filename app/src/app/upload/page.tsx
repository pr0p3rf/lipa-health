"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "uploading" | "extracting" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        // No session — create anonymous session so user can upload without signup
        const { data: anonData, error } = await supabase.auth.signInAnonymously();
        if (error || !anonData.user) {
          // Fallback: send to login if anonymous auth fails (not enabled in Supabase dashboard)
          router.push("/login?mode=signup&redirect=/upload");
          return;
        }
      }
      setLoading(false);
    });
  }, [router]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    setState("uploading");
    setFileNames(files.map((f) => f.name));
    setErrorMsg("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upload all files to Supabase Storage
    for (const file of files) {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      try { await supabase.storage.from("lab-results").upload(filePath, file); } catch {}
      try { await supabase.from("uploads").insert({ user_id: user.id, file_path: filePath, file_name: file.name, status: "analyzing" }); } catch {}
    }

    setState("extracting");
    // Fire Meta Pixel Lead event
    if (typeof (window as any).fbq === "function") {
      (window as any).fbq("track", "Lead");
    }

    // Send all files to extraction API — this now triggers Inngest in the background
    const formData = new FormData();
    if (files.length === 1) {
      formData.append("file", files[0]);
    } else {
      files.forEach((f) => formData.append("files", f));
    }
    formData.append("userId", user.id);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("[upload] Non-JSON response from /api/analyze:", text.slice(0, 200));
        setErrorMsg("Analysis service error. Please try again.");
        setState("error");
        return;
      }
      if (!data.success) {
        setErrorMsg(data.error || data.details || "Extraction failed");
        setState("error");
        return;
      }

      // Extraction succeeded, background analysis is running via Inngest.
      // Redirect to dashboard which will show progress.
      setState("done");
      router.push("/dashboard?analyzing=true");
    } catch (err: any) {
      setErrorMsg(err.message || "Network error");
      setState("error");
    }
  }, [router]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <AppNav />
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1
          className="text-[28px] tracking-tight mb-2"
          style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}
        >
          Upload Blood Test
        </h1>
        <p className="text-[#6B6B6B] text-[15px] mb-8">
          Upload your lab results as PDF or photo. We support results from any laboratory worldwide — any language, any format.
        </p>

        {state === "error" ? (
          /* ---- Error state ---- */
          <div className="bg-white border border-[#EF4444]/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-[#FEE2E2] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold mb-2">Something went wrong</h2>
            <p className="text-[14px] text-[#6B6B6B] mb-4">{errorMsg}</p>
            <button
              onClick={() => { setState("idle"); setErrorMsg(""); }}
              className="text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-2.5 rounded-full transition-colors"
            >
              Try again
            </button>
          </div>
        ) : state === "uploading" || state === "extracting" ? (
          /* ---- Extracting state ---- */
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
            <div className="h-1 bg-[#F4F4F5]">
              <div
                className="h-1 bg-[#1B6B4A] animate-pulse"
                style={{ width: state === "uploading" ? "20%" : "60%" }}
              />
            </div>
            <div className="p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-2 border-[#E5E5E5]" />
                <div className="absolute inset-0 rounded-full border-2 border-[#1B6B4A] border-t-transparent animate-spin" />
              </div>
              <h2
                className="text-[22px] tracking-tight mb-2"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}
              >
                {state === "uploading" ? "Uploading..." : "Reading your lab report"}
              </h2>
              <p className="text-[13px] text-[#6B6B6B] mb-4">
                {state === "uploading"
                  ? `Uploading ${fileNames.length} file${fileNames.length > 1 ? "s" : ""} — encrypted and private`
                  : "Extracting every biomarker, value, unit, and reference range. This usually takes 15-30 seconds."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {fileNames.map((name) => (
                  <span key={name} className="text-[11px] text-[#6B6B6B] bg-[#F4F4F5] px-3 py-1 rounded-full">
                    {name}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-[10px] text-[#8A928C] leading-relaxed">
                  Your data is encrypted and never shared with third parties.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ---- Upload zone ---- */
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-[#1B6B4A] bg-[#1B6B4A]/[0.03] scale-[1.01]"
                  : "border-[#e5e5e5] hover:border-[#ccc] bg-white"
              }`}
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <input
                id="fileInput"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="w-12 h-12 bg-[#E8F5EE] rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-[16px] font-medium mb-1">
                Drop your lab results here
              </p>
              <p className="text-[13px] text-[#999] mb-3">
                PDF or photo — PNG, JPG accepted. Max 10MB per file.
              </p>
              <p className="text-[12px] text-[#1B6B4A] font-medium">
                You can upload multiple files at once
              </p>
            </div>
          </>
        )}

      </main>
    </>
  );
}
