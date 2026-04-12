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
  free: { name: "Lipa Starter", price: "Free", color: "#6B7280" },
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
            Data & Privacy
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[13px] font-medium text-[#2A2A2A] mb-1">EU data residency</div>
              <div className="text-[12px] text-[#6B6B6B]">
                Your health data is stored on EU servers and never leaves Europe.
              </div>
            </div>
            <div>
              <div className="text-[13px] font-medium text-[#2A2A2A] mb-1">GDPR rights</div>
              <div className="text-[12px] text-[#6B6B6B]">
                You can export or delete all your data at any time. Contact{" "}
                <a href="mailto:privacy@lipa.health" className="text-[#1B6B4A] hover:underline">
                  privacy@lipa.health
                </a>
                {" "}to request.
              </div>
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
