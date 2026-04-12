"use client";

import { AppNav } from "@/components/app-nav";
import { Suspense, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

interface Tier {
  id: "free" | "one" | "insight";
  name: string;
  tagline: string;
  price: string;
  priceDetail: string | null;
  features: string[];
  cta: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "insight",
    name: "Lipa Life",
    tagline: "Your health companion. Full analysis, ongoing tracking, unlimited chat.",
    price: "€89",
    priceDetail: "per year · first analysis included",
    featured: true,
    features: [
      "Every marker analyzed in plain English",
      "Full action plan (nutrition, supplements, sleep, movement)",
      "16+ risk calculations + biological age",
      "Cross-marker pattern detection",
      "Up to 12 test uploads per year",
      "Vault — your complete biological history",
      "Trend tracking with bio-age trajectory",
      "Ask Lipa — your personal health assistant, unlimited",
      "Wearable integration (Apple Health, Oura, Whoop)",
      "Personalized research alerts for your markers",
      "PDF export + doctor sharing",
    ],
    cta: "Get Lipa Life — €89/year",
  },
  {
    id: "one",
    name: "Lipa One",
    tagline: "Full analysis of one blood test. No subscription.",
    price: "€29",
    priceDetail: "one-time · credited toward Life if you upgrade",
    features: [
      "Every marker analyzed in plain English",
      "Full action plan across 6 life domains",
      "Risk calculations + biological age",
      "Cross-marker pattern detection",
      "PDF report for your doctor",
      "Ask Lipa chat for 7 days",
    ],
    cta: "Get Single Analysis — €29",
  },
  {
    id: "free",
    name: "Free Preview",
    tagline: "Upload a test and see what Lipa can do.",
    price: "Free",
    priceDetail: null,
    features: [
      "Upload 1 blood test",
      "5 markers analyzed",
      "Basic status overview",
    ],
    cta: "Try Free",
  },
];

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-[#999] text-sm">Loading...</div></div>}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    // Show cancel message if redirected from Stripe
    if (searchParams.get("subscription") === "cancel") {
      setMessage("Subscription canceled. No charges were made.");
    }
  }, [searchParams]);

  async function handleSubscribe(tierId: Tier["id"]) {
    if (tierId === "free") {
      if (!user) {
        router.push("/login?redirect=/dashboard");
      } else {
        router.push("/dashboard");
      }
      return;
    }

    if (!user) {
      router.push(`/login?redirect=/pricing?tier=${tierId}`);
      return;
    }

    setLoading(tierId);
    setMessage(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tierId,
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage(data.error || "Failed to start checkout");
      }
    } catch (err: any) {
      setMessage(err.message || "Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <AppNav />
      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-[11px] uppercase tracking-[2px] text-[#1B6B4A] font-semibold mb-4">
            Pricing
          </div>
          <h1 className="text-[44px] leading-tight font-semibold mb-6 tracking-tight">
            Understand your biology.<br/>Keep going.
          </h1>
          <p className="text-[16px] text-[#6B6B6B] max-w-xl mx-auto">
            Start with a single analysis or get ongoing insights with Lipa Life. No hidden fees. Cancel anytime.
          </p>
        </div>

        {message && (
          <div className="mb-8 bg-[#FEF3C7] border border-[#F59E0B]/30 text-[#92400E] rounded-xl p-4 text-[14px] text-center">
            {message}
          </div>
        )}

        {/* Pricing tiers */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-white rounded-3xl p-8 flex flex-col ${
                tier.featured
                  ? "border-2 border-[#1B6B4A] shadow-lg"
                  : "border border-[#E5E5E5]"
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1B6B4A] text-white text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-[22px] font-semibold mb-2">{tier.name}</h3>
                <p className="text-[12px] text-[#6B6B6B] leading-snug h-[32px]">{tier.tagline}</p>
              </div>

              <div className="mb-6">
                <div className="text-[38px] font-semibold leading-none" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 400 }}>
                  {tier.price}
                </div>
                {tier.priceDetail && (
                  <div className="text-[11px] text-[#999] mt-2">{tier.priceDetail}</div>
                )}
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#2A2A2A]">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1B6B4A"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="flex-shrink-0 mt-0.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(tier.id)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-full text-[13px] font-semibold transition-colors ${
                  tier.featured
                    ? "bg-[#1B6B4A] text-white hover:bg-[#155A3D]"
                    : "bg-[#F4F4F5] text-[#1A1A1A] hover:bg-[#E5E5E5]"
                } ${loading !== null && loading !== tier.id ? "opacity-50" : ""}`}
              >
                {loading === tier.id ? "Loading..." : tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Trust signals */}
        <div className="border-t border-[#E5E5E5] pt-12">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-2">
                EU Privacy
              </div>
              <div className="text-[12px] text-[#6B6B6B]">
                GDPR-native. Your data never leaves secure EU servers.
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-2">
                Cited research
              </div>
              <div className="text-[12px] text-[#6B6B6B]">
                Every insight grounded in peer-reviewed studies.
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-2">
                Fast analysis
              </div>
              <div className="text-[12px] text-[#6B6B6B]">
                Results in under 60 seconds, not weeks.
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-2">
                Cancel anytime
              </div>
              <div className="text-[12px] text-[#6B6B6B]">
                No lock-in, no penalties, one-click cancel.
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon note */}
        <div className="mt-12 text-center">
          <p className="text-[11px] text-[#999] max-w-2xl mx-auto leading-relaxed">
            Lipa One is a one-time purchase — no subscription required. If you upgrade to Lipa Life within 30 days, your €29 is credited toward the annual price. We don't sell blood tests — bring your own from any lab, any country. See our guide on where to test.
          </p>
        </div>

        {/* Medical disclaimer */}
        <div className="mt-8 text-center text-[10px] text-[#999] max-w-2xl mx-auto">
          Lipa is not a medical device. Content is for educational and research purposes only and not a substitute for medical advice, diagnosis, or treatment. Always consult your healthcare provider.
        </div>
      </main>
    </>
  );
}
