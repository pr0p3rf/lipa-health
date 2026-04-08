"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setLoading(false);
    });
  }, [router]);

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
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Empty state */}
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-[#1B6B4A]/[0.08] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
              <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" stroke="#1B6B4A" strokeWidth="1.2" />
              <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-3">Welcome to Lipa</h1>
          <p className="text-[#6B6B6B] text-[16px] max-w-md mx-auto mb-8">
            Upload your blood test results to get started. We&apos;ll analyze your biomarkers, generate a personalized protocol, and track your progress over time.
          </p>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Blood Test
          </a>
        </div>
      </main>
    </>
  );
}
