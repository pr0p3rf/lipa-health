"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "uploading" | "extracting" | "analyzing" | "done" | "error";

interface AnalysisProgress {
  currentStep: "extracting" | "batch" | "summary" | "done";
  batchIndex: number;
  totalBatches: number;
  markersAnalyzed: number;
  totalMarkers: number;
}

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UploadState>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [riskCalcCount, setRiskCalcCount] = useState(0);
  const [hasActionPlan, setHasActionPlan] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState<AnalysisProgress>({
    currentStep: "extracting",
    batchIndex: 0,
    totalBatches: 0,
    markersAnalyzed: 0,
    totalMarkers: 0,
  });
  // Test date is now auto-extracted from the PDF by the analysis API

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setLoading(false);
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
      // Track upload (table may not exist yet — non-fatal)
      try { await supabase.from("uploads").insert({ user_id: user.id, file_path: filePath, file_name: file.name, status: "analyzing" }); } catch {}
    }

    setState("extracting");
    setProgress({
      currentStep: "extracting",
      batchIndex: 0,
      totalBatches: 0,
      markersAnalyzed: 0,
      totalMarkers: 0,
    });

    // Send all files to extraction API
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

      const totalMarkers = data.count || 0;
      const testDate = data.testDate || new Date().toISOString().split("T")[0];
      setAnalysisCount(totalMarkers);

      // Now orchestrate analysis in sequential steps
      setState("analyzing");

      const BATCH_SIZE = 25;
      const numBatches = Math.ceil(totalMarkers / BATCH_SIZE);

      setProgress({
        currentStep: "batch",
        batchIndex: 0,
        totalBatches: numBatches,
        markersAnalyzed: 0,
        totalMarkers: totalMarkers,
      });

      // Step 1-N: Batch analysis (25 markers each)
      for (let i = 0; i < numBatches; i++) {
        setProgress((prev) => ({
          ...prev,
          currentStep: "batch",
          batchIndex: i,
        }));

        const batchRes = await fetch("/api/analyze-step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            testDate,
            step: "batch",
            batchIndex: i,
          }),
        });

        const batchData = await batchRes.json();
        if (!batchRes.ok) {
          throw new Error(batchData.error || `Batch ${i} failed`);
        }

        setRiskCalcCount(batchData.totalSoFar || 0);
        setProgress((prev) => ({
          ...prev,
          markersAnalyzed: batchData.totalSoFar || (i + 1) * BATCH_SIZE,
        }));
      }

      // Final step: Summary + action plan + risk calculations
      setProgress((prev) => ({
        ...prev,
        currentStep: "summary",
      }));

      const summaryRes = await fetch("/api/analyze-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          testDate,
          step: "summary",
        }),
      });

      const summaryData = await summaryRes.json();
      if (!summaryRes.ok) {
        throw new Error(summaryData.error || "Summary generation failed");
      }

      setRiskCalcCount(summaryData.riskCalcs || 0);
      setHasActionPlan(true);
      setProgress((prev) => ({
        ...prev,
        currentStep: "done",
        markersAnalyzed: totalMarkers,
      }));

      setState("done");
    } catch (err: any) {
      setErrorMsg(err.message || "Network error");
      setState("error");
    }
  }, []);

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

        {state === "done" ? (
          /* ---- Success state ---- */
          <div className="bg-white border border-[#1B6B4A]/20 rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-[#E8F5EE] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2
                className="text-[22px] tracking-tight mb-1"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}
              >
                Analysis complete
              </h2>
              <p className="text-[14px] text-[#6B6B6B]">
                {fileNames.length > 1 ? `${fileNames.length} files processed` : fileNames[0]}
              </p>
            </div>

            {/* Results summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#FAFAF8] rounded-xl p-4 text-center">
                <div
                  className="text-[28px] text-[#1B6B4A] tracking-tight"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                >
                  {analysisCount}
                </div>
                <div className="text-[11px] text-[#6B6B6B] font-medium">Biomarkers</div>
              </div>
              <div className="bg-[#FAFAF8] rounded-xl p-4 text-center">
                <div
                  className="text-[28px] text-[#1B6B4A] tracking-tight"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                >
                  {riskCalcCount}
                </div>
                <div className="text-[11px] text-[#6B6B6B] font-medium">Risk calcs</div>
              </div>
              <div className="bg-[#FAFAF8] rounded-xl p-4 text-center">
                <div
                  className="text-[28px] text-[#1B6B4A] tracking-tight"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                >
                  {hasActionPlan ? "Ready" : "—"}
                </div>
                <div className="text-[11px] text-[#6B6B6B] font-medium">Action plan</div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-8 py-3 rounded-full transition-colors"
              >
                View Your Analysis
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <button
                onClick={() => { setState("idle"); setFileNames([]); setAnalysisCount(0); }}
                className="text-[13px] text-[#1B6B4A] font-medium hover:underline"
              >
                Upload another test
              </button>
            </div>
          </div>
        ) : state === "error" ? (
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
        ) : state === "uploading" || state === "extracting" || state === "analyzing" ? (
          /* ---- Progress state ---- */
          <>
            <AnalyzingProgress
              state={state}
              fileNames={fileNames}
              progress={progress}
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => { setState("idle"); setFileNames([]); }}
                className="text-[12px] text-[#8A928C] hover:text-[#5A635D] transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
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

// Real progress display driven by actual API step completion
function AnalyzingProgress({
  state,
  fileNames,
  progress,
}: {
  state: UploadState;
  fileNames: string[];
  progress: AnalysisProgress;
}) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (state !== "extracting" && state !== "analyzing") return;
    setElapsedSec(0);
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  if (state === "uploading") {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-2 border-[#E5E5E5]" />
          <div className="absolute inset-0 rounded-full border-2 border-[#1B6B4A] border-t-transparent animate-spin" />
        </div>
        <h2 className="text-[20px] tracking-tight mb-1" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
          Uploading...
        </h2>
        <p className="text-[13px] text-[#6B6B6B]">
          Sending {fileNames.length} file{fileNames.length > 1 ? "s" : ""} securely
        </p>
      </div>
    );
  }

  // Map real progress to the 10 granular methodology steps users see
  const { totalBatches, totalMarkers, batchIndex, currentStep } = progress;

  // Calculate an overall progress number (0-10) from the actual batch progress
  let overallStep = 0;
  if (currentStep === "extracting") overallStep = 0;
  else if (currentStep === "batch") {
    // Map batches 0-N to steps 1-7 (the analysis/research steps)
    const batchProgress = totalBatches > 0 ? (batchIndex + 0.5) / totalBatches : 0;
    overallStep = 1 + Math.floor(batchProgress * 7); // steps 1-7
  } else if (currentStep === "summary") overallStep = 8;
  else if (currentStep === "done") overallStep = 10;

  const STEPS = [
    { label: "Reading your lab report", detail: "Extracting every biomarker, value, unit, and reference range — in any language, from any lab." },
    { label: "Normalizing across standards", detail: "Converting lab-specific names and units to standardized medical identifiers." },
    { label: "Matching to peer-reviewed research", detail: "Searching published studies relevant to each of your specific marker values." },
    { label: "Scoring evidence quality and independence", detail: "Weighting each study by evidence grade, sample size, funding source, and publication date." },
    { label: "Analyzing each marker in context", detail: "Combining your value, reference ranges, research findings, and clinical guidelines into a personalized analysis." },
    { label: "Detecting cross-marker patterns", detail: "Looking for clinical patterns across your full panel that individual markers can't reveal." },
    { label: "Running clinical health calculations", detail: "Computing cardiovascular risk, insulin resistance, biological age, and 10+ more peer-reviewed algorithms." },
    { label: "Benchmarking against your demographic", detail: "Comparing your results to optimal ranges adjusted for your age and sex." },
    { label: "Building your personalized protocol", detail: "Creating an action plan across nutrition, supplementation, sleep, movement, and lifestyle — specific to your results." },
    { label: "Finalizing your report", detail: "Assembling your complete analysis with full citations and actionable next steps." },
  ];

  type StepItem = { label: string; detail: string; isDone: boolean; isActive: boolean };
  const steps: StepItem[] = STEPS.map((s, i) => ({
    ...s,
    isDone: i < overallStep,
    isActive: i === overallStep,
  }));

  // Calculate progress percentage
  const totalSteps = steps.length;
  const doneCount = steps.filter((s) => s.isDone).length;
  const progressPct = Math.min(
    95,
    Math.round(((doneCount + (steps.some((s) => s.isActive) ? 0.5 : 0)) / totalSteps) * 100)
  );

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-[#F4F4F5]">
        <div
          className="h-1 bg-[#1B6B4A] transition-all duration-1000 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2
            className="text-[22px] tracking-tight mb-1"
            style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}
          >
            Analyzing your biology
          </h2>
          <p className="text-[13px] text-[#6B6B6B]">
            {totalMarkers > 0
              ? `${totalMarkers} biomarkers found — analyzing each against published research and clinical guidelines.`
              : "Reading your lab results and preparing analysis..."}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all duration-500 ${
                step.isActive ? "bg-[#E8F5EE]/50" : ""
              }`}
            >
              {/* Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {step.isDone ? (
                  <div className="w-5 h-5 bg-[#1B6B4A] rounded-full flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                ) : step.isActive ? (
                  <div className="w-5 h-5 rounded-full border-2 border-[#1B6B4A] flex items-center justify-center">
                    <div className="w-2 h-2 bg-[#1B6B4A] rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#E5E5E5]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] leading-snug ${
                  step.isDone ? "text-[#1B6B4A] font-medium" :
                  step.isActive ? "text-[#0F1A15] font-medium" :
                  "text-[#B5B5B5]"
                }`}>
                  {step.label}
                </div>
                {(step.isDone || step.isActive) && step.detail && (
                  <div className={`text-[11px] mt-1 leading-relaxed ${
                    step.isDone ? "text-[#8A928C]" : "text-[#6B6B6B]"
                  }`}>
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* File chips + timer */}
        <div className="mt-6 pt-4 border-t border-[#F4F4F5] flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {fileNames.map((name) => (
              <span key={name} className="text-[11px] text-[#6B6B6B] bg-[#F4F4F5] px-3 py-1 rounded-full">
                {name}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-[#B5B5B5] font-mono tabular-nums flex-shrink-0 ml-4">
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
          </div>
        </div>

        {/* Trust footer */}
        <div className="mt-4 text-center">
          <p className="text-[10px] text-[#8A928C] leading-relaxed">
            Your data is encrypted and never shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
