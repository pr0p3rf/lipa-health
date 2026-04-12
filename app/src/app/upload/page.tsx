"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UploadState = "idle" | "uploading" | "analyzing" | "done" | "error";

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
      await supabase.storage.from("lab-results").upload(filePath, file);
      await supabase.from("uploads").insert({
        user_id: user.id,
        file_path: filePath,
        file_name: file.name,
        status: "analyzing",
      });
    }

    setState("analyzing");

    // Send all files to analysis API
    const formData = new FormData();
    if (files.length === 1) {
      formData.append("file", files[0]);
    } else {
      files.forEach((f) => formData.append("files", f));
    }
    formData.append("userId", user.id);
    // testDate omitted — API extracts it from the PDF automatically

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisCount(data.count);
        setRiskCalcCount(data.risk_calculations_count || 0);
        setHasActionPlan(data.has_action_plan || false);
        setState("done");
      } else {
        setErrorMsg(data.error || "Analysis failed");
        setState("error");
      }
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
        ) : state === "uploading" || state === "analyzing" ? (
          /* ---- Progress state ---- */
          <AnalyzingProgress
            state={state}
            fileNames={fileNames}
          />
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

        <div className="mt-8 p-4 bg-[#F2F1EE] rounded-xl">
          <p className="text-[12px] text-[#6B6B6B] leading-relaxed">
            <strong className="text-[#1A1A1A]">Privacy:</strong> Your health data is encrypted and stored in the EU. We never share your data with third parties. You can delete everything at any time from your account settings.
          </p>
        </div>
      </main>
    </>
  );
}

// Rich analyzing progress with timed steps that build trust
function AnalyzingProgress({ state, fileNames }: { state: UploadState; fileNames: string[] }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Timed progression through steps to simulate real pipeline activity
  useEffect(() => {
    if (state !== "analyzing") return;
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (state !== "analyzing") return;
    // Step progression: each step advances after a delay
    const timings = [0, 8, 20, 45, 70, 95, 120, 150, 175, 200, 225];
    const step = timings.filter((t) => elapsedSec >= t).length - 1;
    setCurrentStep(Math.min(step, ANALYSIS_STEPS.length - 1));
  }, [elapsedSec, state]);

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

  const progressPct = Math.min(95, Math.round((currentStep / (ANALYSIS_STEPS.length - 1)) * 100));

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
            Sit tight — we're analyzing each marker against your biology, published research, and clinical guidelines.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-1">
          {ANALYSIS_STEPS.map((step, i) => {
            const isDone = i < currentStep;
            const isActive = i === currentStep;
            const isFuture = i > currentStep;

            return (
              <div
                key={i}
                className={`flex items-start gap-3 py-2.5 px-3 rounded-xl transition-all duration-500 ${
                  isActive ? "bg-[#E8F5EE]/50" : ""
                }`}
              >
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {isDone ? (
                    <div className="w-5 h-5 bg-[#1B6B4A] rounded-full flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  ) : isActive ? (
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
                    isDone ? "text-[#1B6B4A] font-medium" :
                    isActive ? "text-[#0F1A15] font-medium" :
                    "text-[#B5B5B5]"
                  }`}>
                    {step.label}
                  </div>
                  {(isDone || isActive) && step.detail && (
                    <div className={`text-[11px] mt-1 leading-relaxed ${
                      isDone ? "text-[#8A928C]" : "text-[#6B6B6B]"
                    }`}>
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
          <p className="text-[10px] text-[#B5B5B5] leading-relaxed">
            Your data is encrypted and processed in the EU. Nothing is shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}

const ANALYSIS_STEPS = [
  {
    label: "Reading your lab report",
    detail: "Extracting every biomarker, value, unit, and reference range — in any language, from any lab.",
  },
  {
    label: "Normalizing across standards",
    detail: "Converting lab-specific names and units to standardized medical identifiers.",
  },
  {
    label: "Matching to peer-reviewed research",
    detail: "Searching published studies relevant to each of your specific marker values.",
  },
  {
    label: "Scoring evidence quality and independence",
    detail: "Weighting each study by evidence grade, sample size, funding source, and publication date.",
  },
  {
    label: "Analyzing each marker in context",
    detail: "Combining your value, reference ranges, research findings, and clinical guidelines into a personalized analysis.",
  },
  {
    label: "Detecting cross-marker patterns",
    detail: "Looking for clinical patterns across your full panel that individual markers can't reveal.",
  },
  {
    label: "Running clinical health calculations",
    detail: "Computing cardiovascular risk, insulin resistance, biological age, and 10+ more peer-reviewed algorithms.",
  },
  {
    label: "Benchmarking against your demographic",
    detail: "Comparing your results to optimal ranges adjusted for your age and sex.",
  },
  {
    label: "Building your personalized protocol",
    detail: "Creating an action plan across nutrition, supplementation, sleep, movement, and lifestyle — specific to your results.",
  },
  {
    label: "Finalizing your report",
    detail: "Assembling your complete analysis with full citations and actionable next steps.",
  },
];
