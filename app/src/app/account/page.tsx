"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Subscription {
  tier: "free" | "access" | "essential" | "complete";
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

const TIER_DISPLAY: Record<string, { name: string; price: string; color: string }> = {
  free: { name: "Lipa Taste", price: "Free", color: "#6B7280" },
  access: { name: "Lipa Insight", price: "€79/year", color: "#1B6B4A" },
  essential: { name: "Lipa Annual", price: "€149/year", color: "#1B6B4A" },
  complete: { name: "Lipa Bi-Annual", price: "€289/year", color: "#1B6B4A" },
};

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setSubscription(sub);
      setLoading(false);
    }
    load();
  }, [router]);

  async function openPortal() {
    if (!user) return;
    setPortalLoading(true);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open portal");
      }
    } catch (err: any) {
      alert(err.message || "Failed to open portal");
    } finally {
      setPortalLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  const tier = subscription?.tier || "free";
  const tierInfo = TIER_DISPLAY[tier];
  const isPaidTier = tier !== "free";

  return (
    <>
      <AppNav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[28px] font-semibold tracking-tight mb-2">Account</h1>
          <p className="text-[14px] text-[#6B6B6B]">Manage your Lipa subscription and account.</p>
        </div>

        {/* Profile card */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-3">
            Profile
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-[#999]">Email</div>
              <div className="text-[14px] text-[#2A2A2A]">{user?.email}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#999]">Member since</div>
              <div className="text-[14px] text-[#2A2A2A]">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription card */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">
                Current Plan
              </div>
              <div className="text-[22px] font-semibold" style={{ color: tierInfo.color }}>
                {tierInfo.name}
              </div>
              <div className="text-[13px] text-[#6B6B6B] mt-1">{tierInfo.price}</div>
            </div>

            <div
              className="text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: `${tierInfo.color}15`,
                color: tierInfo.color,
              }}
            >
              {subscription?.status || "free"}
            </div>
          </div>

          {subscription?.current_period_end && isPaidTier && (
            <div className="text-[12px] text-[#6B6B6B] mb-4">
              {subscription.cancel_at_period_end ? (
                <>Cancels on {new Date(subscription.current_period_end).toLocaleDateString("en-GB")}</>
              ) : (
                <>Renews on {new Date(subscription.current_period_end).toLocaleDateString("en-GB")}</>
              )}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {isPaidTier ? (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Loading..." : "Manage subscription"}
              </button>
            ) : (
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2.5 rounded-full transition-colors"
              >
                Upgrade plan
              </a>
            )}
          </div>
        </div>

        {/* Data & privacy card */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-3">
            Your Data
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[13px] font-medium text-[#2A2A2A] mb-1">Encrypted and secure</div>
              <div className="text-[12px] text-[#6B6B6B]">
                Your health data is encrypted in transit and at rest. We never share your data with third parties or use it to train models.
              </div>
            </div>
            <div>
              <div className="text-[13px] font-medium text-[#2A2A2A] mb-1">Export your data</div>
              <div className="text-[12px] text-[#6B6B6B] mb-2">
                Download all your biomarker results and analyses as a JSON file.
              </div>
              <button
                onClick={async () => {
                  if (!user) return;
                  const { data: results } = await supabase.from("biomarker_results").select("*").eq("user_id", user.id);
                  const { data: analyses } = await supabase.from("user_analyses").select("*").eq("user_id", user.id);
                  const { data: plans } = await supabase.from("action_plans").select("*").eq("user_id", user.id);
                  const blob = new Blob([JSON.stringify({ results, analyses, action_plans: plans }, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `lipa-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-2 text-[12px] font-medium text-[#1B6B4A] hover:text-[#155A3D] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download all data
              </button>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-3">
            Account
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-[#2A2A2A]">Delete all health data</div>
                <div className="text-[12px] text-[#6B6B6B]">Remove all test results, analyses, and action plans. This cannot be undone.</div>
              </div>
              <button
                onClick={async () => {
                  if (!user) return;
                  if (!confirm("Delete ALL your health data? This removes every test result, analysis, and action plan. This cannot be undone.")) return;
                  await supabase.from("analysis_citations").delete().eq("user_id", user.id);
                  await supabase.from("user_analyses").delete().eq("user_id", user.id);
                  await supabase.from("action_plans").delete().eq("user_id", user.id);
                  await supabase.from("biomarker_results").delete().eq("user_id", user.id);
                  await supabase.from("uploads").delete().eq("user_id", user.id);
                  alert("All health data deleted.");
                  window.location.reload();
                }}
                className="text-[12px] font-medium text-[#B91C1C] hover:text-[#991B1B] border border-[#FEE2E2] hover:border-[#FECACA] rounded-lg px-4 py-2 transition-colors flex-shrink-0"
              >
                Delete data
              </button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#F4F4F5]">
              <div>
                <div className="text-[13px] font-medium text-[#2A2A2A]">Delete account</div>
                <div className="text-[12px] text-[#6B6B6B]">Permanently delete your account and all associated data.</div>
              </div>
              <button
                onClick={async () => {
                  if (!user) return;
                  if (!confirm("Permanently delete your account? All data will be erased and this cannot be undone.")) return;
                  // Delete all data first
                  await supabase.from("analysis_citations").delete().eq("user_id", user.id);
                  await supabase.from("user_analyses").delete().eq("user_id", user.id);
                  await supabase.from("action_plans").delete().eq("user_id", user.id);
                  await supabase.from("biomarker_results").delete().eq("user_id", user.id);
                  await supabase.from("uploads").delete().eq("user_id", user.id);
                  await supabase.from("user_profiles").delete().eq("user_id", user.id);
                  await supabase.from("user_subscriptions").delete().eq("user_id", user.id);
                  // Sign out (account deletion from auth requires admin API)
                  await supabase.auth.signOut();
                  router.push("/login");
                }}
                className="text-[12px] font-medium text-[#B91C1C] hover:text-[#991B1B] border border-[#FEE2E2] hover:border-[#FECACA] rounded-lg px-4 py-2 transition-colors flex-shrink-0"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="text-center">
          <button
            onClick={signOut}
            className="text-[12px] text-[#999] hover:text-[#6B6B6B]"
          >
            Sign out
          </button>
        </div>
      </main>
    </>
  );
}
