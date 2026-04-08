"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [analysisCount, setAnalysisCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setLoading(false);
    });
  }, [router]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    setFileName(file.name);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("lab-results")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      setUploading(false);
      return;
    }

    // Record in uploads table
    await supabase.from("uploads").insert({
      user_id: user.id,
      file_path: filePath,
      file_name: file.name,
      status: "analyzing",
    });

    // Send to Claude for analysis
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user.id);
    formData.append("testDate", new Date().toISOString().split("T")[0]);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisCount(data.count);
      }
    } catch (err) {
      console.error("Analysis error:", err);
    }

    setUploading(false);
    setUploaded(true);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
        <h1 className="text-2xl font-semibold mb-2">Upload Blood Test</h1>
        <p className="text-[#6B6B6B] text-[15px] mb-8">
          Upload your lab results as a PDF or photo. We support results from any laboratory — Diagnostyka, ALAB, Synevo, and more.
        </p>

        {uploaded ? (
          <div className="bg-white border border-[#1B6B4A]/20 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-[#1B6B4A]/[0.08] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {analysisCount > 0 ? `${analysisCount} biomarkers extracted` : "Results uploaded"}
            </h2>
            <p className="text-[#6B6B6B] text-[15px] mb-1">{fileName}</p>
            <p className="text-[#999] text-[13px] mb-6">
              {analysisCount > 0
                ? "Your biomarkers have been analyzed. View your dashboard to see your results and personalized protocol."
                : "We're analyzing your biomarkers now. Your personalized insights will be ready shortly."}
            </p>
            {analysisCount > 0 && (
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2.5 rounded-full transition-colors mb-3"
              >
                View Dashboard
              </a>
            )}
            <button
              onClick={() => { setUploaded(false); setFileName(""); }}
              className="text-[13px] text-[#1B6B4A] font-medium hover:underline"
            >
              Upload another test
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-[#1B6B4A] bg-[#1B6B4A]/[0.03]"
                : "border-[#e5e5e5] hover:border-[#ccc] bg-white"
            }`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileInput}
              className="hidden"
            />

            {uploading ? (
              <div className="text-[#6B6B6B]">
                <div className="text-[15px] font-medium mb-1">Uploading {fileName}...</div>
                <div className="text-[13px] text-[#999]">Please wait</div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-[#FAFAF8] rounded-xl flex items-center justify-center mx-auto mb-4 border border-[#e5e5e5]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-[15px] font-medium mb-1">
                  Drop your lab results here
                </p>
                <p className="text-[13px] text-[#999]">
                  PDF or photo — PNG, JPG accepted. Max 10MB.
                </p>
              </>
            )}
          </div>
        )}

        <div className="mt-8 p-4 bg-[#F2F1EE] rounded-xl">
          <p className="text-[12px] text-[#6B6B6B] leading-relaxed">
            <strong className="text-[#1A1A1A]">Privacy:</strong> Your health data is encrypted and stored in the EU. We never share your data with third parties. You can delete everything at any time.
          </p>
        </div>
      </main>
    </>
  );
}
