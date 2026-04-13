"use client";

import { AppNav } from "@/components/app-nav";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  GOAL DATA                                                          */
/* ------------------------------------------------------------------ */

type GoalKey =
  | "general"
  | "longevity"
  | "trt"
  | "glp1"
  | "perimenopause"
  | "thyroid"
  | "metabolic"
  | "comprehensive";

interface Goal {
  key: GoalKey;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const GOALS: Goal[] = [
  {
    key: "general",
    title: "General Health",
    subtitle: "First blood test or annual check-up",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    key: "longevity",
    title: "Longevity",
    subtitle: "Optimize aging, bio-age, cardiovascular risk",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: "trt",
    title: "TRT / Hormone Therapy",
    subtitle: "Monitor testosterone, estradiol, hematocrit, PSA",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    key: "glp1",
    title: "GLP-1 / Weight Loss",
    subtitle: "Track semaglutide or tirzepatide effects",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3H8l-2 5h12l-2-5z" />
        <path d="M6 8v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    key: "perimenopause",
    title: "Perimenopause / Menopause",
    subtitle: "FSH, estradiol, progesterone, thyroid",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" />
        <path d="M12 2c2 3 3 6.5 3 10" />
        <circle cx="18" cy="6" r="3" fill="#E8F5EE" stroke="#1B6B4A" />
        <circle cx="18" cy="6" r="1" fill="#1B6B4A" stroke="none" />
      </svg>
    ),
  },
  {
    key: "thyroid",
    title: "Thyroid",
    subtitle: "Full thyroid panel: TSH, fT3, fT4, antibodies",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: "metabolic",
    title: "Metabolic / Prediabetes",
    subtitle: "Glucose, insulin, HbA1c, lipids",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    key: "comprehensive",
    title: "Comprehensive",
    subtitle: "Everything \u2014 80+ markers",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  MARKERS PER GOAL                                                   */
/* ------------------------------------------------------------------ */

const MARKERS: Record<GoalKey, string[]> = {
  general: [
    "CBC",
    "CMP (Comprehensive Metabolic Panel)",
    "Lipid Panel",
    "TSH",
    "Vitamin D",
    "B12",
    "Iron / Ferritin",
    "hs-CRP",
    "HbA1c",
  ],
  longevity: [
    "CBC",
    "CMP",
    "Lipid Panel",
    "TSH",
    "Vitamin D",
    "B12",
    "Iron / Ferritin",
    "hs-CRP",
    "HbA1c",
    "ApoB",
    "Lp(a)",
    "Fasting Insulin",
    "HOMA-IR",
    "Homocysteine",
    "IGF-1",
    "DHEA-S",
    "Free T3",
    "Free T4",
    "Omega-3 Index",
    "Cystatin C",
  ],
  trt: [
    "Total Testosterone",
    "Free Testosterone",
    "Estradiol (sensitive)",
    "SHBG",
    "Hematocrit",
    "Hemoglobin",
    "PSA",
    "Lipid Panel",
    "Liver Enzymes (ALT / AST)",
    "Prolactin",
    "LH",
    "FSH",
  ],
  glp1: [
    "HbA1c",
    "Fasting Glucose",
    "Fasting Insulin",
    "Lipid Panel",
    "Liver Enzymes (ALT / AST)",
    "B12",
    "TSH",
    "Kidney Function (eGFR / Creatinine)",
    "Lipase",
    "CBC",
  ],
  perimenopause: [
    "FSH",
    "LH",
    "Estradiol",
    "Progesterone",
    "AMH",
    "Testosterone",
    "SHBG",
    "TSH",
    "Free T4",
    "Vitamin D",
    "Ferritin",
    "CBC",
  ],
  thyroid: [
    "TSH",
    "Free T3",
    "Free T4",
    "Reverse T3",
    "TPO Antibodies",
    "Thyroglobulin Antibodies",
    "Selenium",
    "Iron / Ferritin",
    "Vitamin D",
    "B12",
  ],
  metabolic: [
    "Fasting Glucose",
    "Fasting Insulin",
    "HbA1c",
    "Lipid Panel + ApoB",
    "Liver Enzymes (ALT / AST)",
    "Uric Acid",
    "hs-CRP",
    "CBC",
    "Kidney Function (eGFR / Creatinine)",
  ],
  comprehensive: [], // computed below
};

// Build comprehensive as deduplicated union of all others
const allMarkers = Object.entries(MARKERS)
  .filter(([k]) => k !== "comprehensive")
  .flatMap(([, v]) => v);
const seen = new Set<string>();
MARKERS.comprehensive = allMarkers.filter((m) => {
  const norm = m.toLowerCase().replace(/\s*\/\s*/g, "/").replace(/[()]/g, "");
  if (seen.has(norm)) return false;
  seen.add(norm);
  return true;
});

/* ------------------------------------------------------------------ */
/*  PANEL NAMES (for "What to tell the lab")                           */
/* ------------------------------------------------------------------ */

const PANEL_NAMES: Record<GoalKey, string> = {
  general: "a General Health Panel",
  longevity: "a Longevity / Advanced Health Panel",
  trt: "a Hormone / TRT Monitoring Panel",
  glp1: "a GLP-1 / Weight Loss Monitoring Panel",
  perimenopause: "a Female Hormone / Perimenopause Panel",
  thyroid: "a Full Thyroid Panel",
  metabolic: "a Metabolic / Prediabetes Panel",
  comprehensive: "a Comprehensive Panel (80+ markers)",
};

/* ------------------------------------------------------------------ */
/*  COUNTRY DATA                                                       */
/* ------------------------------------------------------------------ */

interface Lab {
  name: string;
  ease: "Easy" | "Very Easy" | "Moderate" | "Prescription needed";
  cost: string;
  tip: string;
}

interface CountryInfo {
  labs: Lab[];
}

const COUNTRIES: Record<string, CountryInfo> = {
  "United States": {
    labs: [
      { name: "Quest Diagnostics (QuestDirect)", ease: "Easy", cost: "$150\u2013$400", tip: "Largest US network, 2,200+ locations, online self-order." },
      { name: "Labcorp (OnDemand)", ease: "Easy", cost: "$150\u2013$400", tip: "Second largest chain, 2,000+ locations." },
      { name: "Ulta Lab Tests", ease: "Easy", cost: "$100\u2013$300", tip: "Broker for Quest/Labcorp at discounted cash prices. Some states (NY, NJ, RI, MD) restrict self-ordering." },
    ],
  },
  "United Kingdom": {
    labs: [
      { name: "Medichecks", ease: "Easy", cost: "\u00a3100\u2013\u00a3400", tip: "Market leader \u2014 finger-prick home kits or walk-in clinics. Often runs sales." },
      { name: "Thriva", ease: "Easy", cost: "\u00a3100\u2013\u00a3300", tip: "Subscription-based, strong app experience." },
      { name: "London Medical Laboratory / Randox Health", ease: "Easy", cost: "\u00a3150\u2013\u00a3400", tip: "Walk-in venous draw for the most accurate results." },
    ],
  },
  Canada: {
    labs: [
      { name: "LifeLabs", ease: "Moderate", cost: "CAD 200\u2013500", tip: "Largest network (ON, BC, SK). Requires doctor requisition or telehealth referral." },
      { name: "Dynacare", ease: "Moderate", cost: "CAD 200\u2013500", tip: "Major chain (ON, MB, QC)." },
      { name: "Maple / Telus Health MyCare", ease: "Moderate", cost: "CAD 50\u201380 consult, then free at public lab", tip: "Virtual doctor visit for a free requisition \u2014 cheapest path in most provinces." },
    ],
  },
  Germany: {
    labs: [
      { name: "Cerascreen", ease: "Easy", cost: "\u20ac150\u2013\u20ac500", tip: "DTC leader with home test kits shipped to your door." },
      { name: "Lykon", ease: "Easy", cost: "\u20ac100\u2013\u20ac400", tip: "Home kits with a strong app." },
      { name: "Any Privatpraxis", ease: "Moderate", cost: "\u20ac150\u2013\u20ac500", tip: "Walk in and pay out of pocket. PKV patients have easier access; GKK patients may pay extra." },
    ],
  },
  Netherlands: {
    labs: [
      { name: "Bloedwaardentest.nl", ease: "Easy", cost: "\u20ac100\u2013\u20ac350", tip: "Leading DTC platform \u2014 no GP referral needed, walk-in at partner labs." },
      { name: "Star-SHL / Diagnostiek voor U", ease: "Moderate", cost: "\u20ac100\u2013\u20ac300", tip: "Regional labs accepting self-referrals." },
      { name: "Easly", ease: "Easy", cost: "\u20ac50\u2013\u20ac200", tip: "Home finger-prick kits \u2014 convenient but limited marker range." },
    ],
  },
  Poland: {
    labs: [
      { name: "Diagnostyka", ease: "Very Easy", cost: "PLN 250\u2013700 (\u20ac55\u2013\u20ac155)", tip: "Largest chain, 700+ walk-in locations, no referral needed." },
      { name: "ALAB Laboratoria", ease: "Very Easy", cost: "PLN 200\u2013600", tip: "Second largest, same walk-in self-order model." },
      { name: "uPatient.pl / Medicover", ease: "Very Easy", cost: "PLN 200\u2013700", tip: "Online ordering. Poland is one of Europe's cheapest markets for blood work." },
    ],
  },
  France: {
    labs: [
      { name: "Cerba Healthcare / Biogroup", ease: "Prescription needed", cost: "\u20ac50\u2013\u20ac150", tip: "Two largest lab networks. Most costs partially reimbursed by S\u00e9curit\u00e9 Sociale." },
      { name: "Qare / Doctolib teleconsultation", ease: "Prescription needed", cost: "\u20ac25 teleconsult + lab fees", tip: "Quick teleconsultation for ordonnance, then any lab. Fast pipeline." },
    ],
  },
  Spain: {
    labs: [
      { name: "Melio.es", ease: "Easy", cost: "\u20ac80\u2013\u20ac300", tip: "DTC platform, online ordering + clinic visit. No referral needed." },
      { name: "Quironsalud / Vithas", ease: "Easy", cost: "\u20ac100\u2013\u20ac300", tip: "Private hospital groups with walk-in labs." },
      { name: "Synlab Spain", ease: "Easy", cost: "\u20ac80\u2013\u20ac250", tip: "European network with competitive pricing." },
    ],
  },
  Australia: {
    labs: [
      { name: "iMedical", ease: "Moderate", cost: "AUD 150\u2013500", tip: "DTC blood testing with telehealth doctor consultation included." },
      { name: "Healthscope / Australian Clinical Labs", ease: "Moderate", cost: "Free with Medicare referral", tip: "Major pathology providers. Telehealth referral + Medicare = free or near-free." },
      { name: "Instant Consult / Eucalyptus", ease: "Moderate", cost: "AUD 30\u201350 consult, then bulk-billed", tip: "Telehealth for pathology referral, then free at public lab." },
    ],
  },
  UAE: {
    labs: [
      { name: "Aster Labs / Aster DM Healthcare", ease: "Very Easy", cost: "AED 400\u20131,500 ($110\u2013$410)", tip: "Walk-in + home collection available." },
      { name: "Al Borg Diagnostics (Unilabs)", ease: "Very Easy", cost: "AED 400\u20131,200", tip: "Largest Middle East lab network." },
      { name: "Valeo Health / WhiteCoats", ease: "Very Easy", cost: "AED 500\u20131,500", tip: "App-based home collection. Most labs offer WhatsApp delivery of results." },
    ],
  },
  Singapore: {
    labs: [
      { name: "Raffles Medical / Raffles Health Screening", ease: "Moderate", cost: "SGD 200\u2013800", tip: "Walk-in health screening packages." },
      { name: "Parkway Shenton / Health365", ease: "Moderate", cost: "SGD 200\u2013600", tip: "Part of IHH Healthcare, wide network." },
      { name: "WhiteCoat / DA Clinic", ease: "Moderate", cost: "SGD 150\u2013500", tip: "Telehealth + lab. Start with a basic panel to avoid overpaying." },
    ],
  },
  Thailand: {
    labs: [
      { name: "Bumrungrad Hospital", ease: "Very Easy", cost: "THB 3,000\u201310,000 ($85\u2013$280)", tip: "World-famous medical tourism hospital." },
      { name: "Bangkok Hospital / BDMS", ease: "Very Easy", cost: "THB 2,000\u20138,000", tip: "Largest private hospital group." },
      { name: "N Health", ease: "Very Easy", cost: "THB 1,500\u20135,000 ($40\u2013$140)", tip: "Standalone lab chain \u2014 cheapest for blood-only testing. No referral needed." },
    ],
  },
  India: {
    labs: [
      { name: "Thyrocare", ease: "Very Easy", cost: "INR 1,000\u20136,000 ($12\u2013$72)", tip: "Pan-India, aggressive DTC pricing, home collection is the norm." },
      { name: "SRL Diagnostics / Dr Lal PathLabs", ease: "Very Easy", cost: "INR 1,000\u20135,000", tip: "Two largest chains with wide coverage." },
      { name: "PharmEasy / 1mg (Tata Health)", ease: "Very Easy", cost: "INR 800\u20134,000", tip: "App-based with home collection. India is the world's cheapest market for comprehensive blood work." },
    ],
  },
  Sweden: {
    labs: [
      { name: "Werlabs", ease: "Easy", cost: "SEK 1,000\u20134,000 (\u20ac90\u2013\u20ac360)", tip: "Swedish DTC leader \u2014 online ordering, walk-in at Unilabs clinics. Comprehensive panel covers everything." },
      { name: "Dynamic Code", ease: "Moderate", cost: "SEK 800\u20133,000", tip: "Home kits and clinic visits." },
      { name: "Doktor.se / Kry", ease: "Moderate", cost: "SEK 250 consult + lab", tip: "Telehealth for lab referrals." },
    ],
  },
  Italy: {
    labs: [
      { name: "Synlab Italy", ease: "Easy", cost: "\u20ac80\u2013\u20ac300", tip: "Largest private lab network in Italy." },
      { name: "Centro Diagnostico Italiano (CDI)", ease: "Easy", cost: "\u20ac80\u2013\u20ac250", tip: "Milan-based, strong reputation." },
      { name: "Lifebrain", ease: "Easy", cost: "\u20ac80\u2013\u20ac300", tip: "Central/southern Italy. Walk into any 'laboratorio analisi privato' \u2014 no referral needed." },
    ],
  },
  Belgium: {
    labs: [
      { name: "Labo Riatol / CMA", ease: "Prescription needed", cost: "\u20ac50\u2013\u20ac350", tip: "Major lab networks. Most costs reimbursed through mutualiteit/mutuelle." },
      { name: "Quin / Doktr", ease: "Prescription needed", cost: "\u20ac25\u201335 teleconsult + lab fees", tip: "Telehealth for quick prescription, then any lab." },
      { name: "Bloedonderzoek.be", ease: "Prescription needed", cost: "\u20ac50\u2013\u20ac300", tip: "Emerging DTC platform \u2014 still requires prescription but streamlines the process." },
    ],
  },
  Ireland: {
    labs: [
      { name: "Randox Health", ease: "Easy", cost: "\u20ac100\u2013\u20ac400", tip: "Walk-in clinics in Dublin and Belfast." },
      { name: "Let's Get Checked", ease: "Easy", cost: "\u20ac100\u2013\u20ac350", tip: "Irish-founded DTC with a strong app experience." },
      { name: "Beacon Hospital / Hermitage Clinic", ease: "Easy", cost: "\u20ac150\u2013\u20ac400", tip: "Private hospitals for venous draw." },
    ],
  },
  Japan: {
    labs: [
      { name: "Ningen Dock Net", ease: "Moderate", cost: "\u00a55,000\u2013\u00a5100,000 ($35\u2013$700)", tip: "Booking platform for comprehensive health check-ups (ningen dock)." },
      { name: "Demecal / Kenko.com", ease: "Moderate", cost: "\u00a53,000\u2013\u00a520,000", tip: "Home test kits \u2014 limited panel range." },
      { name: "SRL / BML", ease: "Moderate", cost: "\u00a510,000\u2013\u00a550,000", tip: "Major reference labs \u2014 generally require clinic referral. Japan's ningen dock culture means annual checks are normal." },
    ],
  },
  "South Korea": {
    labs: [
      { name: "Samsung Medical Center / SNUH", ease: "Moderate", cost: "KRW 100,000\u20131,000,000 ($75\u2013$750)", tip: "Hospital health check-up centers with comprehensive panels." },
      { name: "Chaum (CHA University)", ease: "Moderate", cost: "KRW 200,000\u20131,000,000", tip: "Premium preventive health facility." },
      { name: "GC Labs / Medifriend", ease: "Moderate", cost: "KRW 100,000\u2013500,000", tip: "More affordable options. Health check-up culture is strong in Korea." },
    ],
  },
  Brazil: {
    labs: [
      { name: "Dasa (Diagnosticos da America)", ease: "Easy", cost: "BRL 200\u20131,000 ($40\u2013$200)", tip: "Largest lab in Latin America. Excellent digital portal." },
      { name: "Fleury Medicina e Saude", ease: "Easy", cost: "BRL 300\u20131,000", tip: "Premium private chain." },
      { name: "Hermes Pardini / a+ (amais)", ease: "Easy", cost: "BRL 200\u2013800", tip: "Large networks. Home collection is common in major cities." },
    ],
  },
};

const COUNTRY_LIST = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Netherlands",
  "Poland",
  "France",
  "Spain",
  "Australia",
  "UAE",
  "Singapore",
  "Thailand",
  "India",
  "Sweden",
  "Italy",
  "Belgium",
  "Ireland",
  "Japan",
  "South Korea",
  "Brazil",
];

/* ------------------------------------------------------------------ */
/*  EASE BADGE COLORS                                                  */
/* ------------------------------------------------------------------ */

function easeBadge(ease: string) {
  switch (ease) {
    case "Very Easy":
      return "bg-[#E8F5EE] text-[#1B6B4A]";
    case "Easy":
      return "bg-[#E8F5EE] text-[#1B6B4A]";
    case "Moderate":
      return "bg-[#FFF8E1] text-[#9A6700]";
    case "Prescription needed":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    default:
      return "bg-[#F4F4F5] text-[#6B6B6B]";
  }
}

/* ------------------------------------------------------------------ */
/*  PAGE COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export default function TestFinderPage() {
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Restore goals from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lipa_test_finder_goals");
      if (saved) setSelectedGoals(JSON.parse(saved));
    } catch {}
  }, []);

  // Save goals to localStorage
  useEffect(() => {
    if (selectedGoals.length > 0) {
      try { localStorage.setItem("lipa_test_finder_goals", JSON.stringify(selectedGoals)); } catch {}
    }
  }, [selectedGoals]);

  function toggleGoal(key: GoalKey) {
    setSelectedGoals((prev) =>
      prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
    );
  }

  // Merge + deduplicate markers from all selected goals
  const markers = useMemo(() => {
    if (selectedGoals.length === 0) return [];
    const all = selectedGoals.flatMap((g) => MARKERS[g] || []);
    return Array.from(new Set(all));
  }, [selectedGoals]);

  const countryInfo = selectedCountry ? COUNTRIES[selectedCountry] : null;
  // Gate results behind email capture
  const showResult = selectedGoals.length > 0 && selectedCountry && emailSubmitted;

  const markerListText = useMemo(() => markers.join(", "), [markers]);

  function handleCopy() {
    navigator.clipboard.writeText(markers.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // Save to Supabase newsletter_subscribers with source + goals
    try {
      await fetch("https://ovprbhjtwtthuldcdlgq.supabase.co/rest/v1/newsletter_subscribers", {
        method: "POST",
        headers: {
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cHJiaGp0d3R0aHVsZGNkbGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEzMTgsImV4cCI6MjA5MTA2NzMxOH0.n3clDryaCjEfGebFzk2ZiEacKd5xpVAXNUUGWPjklOA",
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          email: email.trim(),
          source: `test-finder:${selectedGoals.join(",")}:${selectedCountry}`,
        }),
      });
    } catch {}
    setEmailSubmitted(true);
  }

  return (
    <div suppressHydrationWarning>
      <AppNav />
      <main
        className="min-h-screen pb-28 sm:pb-12"
        style={{ background: "#F8F5EF" }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          {/* Header */}
          <h1
            className="text-[28px] sm:text-[36px] tracking-tight mb-2"
            style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}
          >
            Test Finder
          </h1>
          <p className="text-[#6B6B6B] text-[15px] mb-10 max-w-xl">
            Tell us your goal and location. We'll tell you exactly what to test
            and where to go.
          </p>

          {/* ---- STEP 1: Goal selection ---- */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1B6B4A] text-white text-[13px] font-semibold">
                1
              </span>
              <h2
                className="text-[20px] tracking-tight"
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontWeight: 500,
                }}
              >
                What's your goal?
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {GOALS.map((g) => {
                const isSelected = selectedGoals.includes(g.key);
                return (
                  <button
                    key={g.key}
                    onClick={() => toggleGoal(g.key)}
                    className={`text-left bg-white rounded-[20px] p-4 sm:p-5 transition-all duration-200 ${
                      isSelected
                        ? "ring-2 ring-[#1B6B4A] shadow-md"
                        : "shadow-sm hover:shadow-md border border-transparent hover:border-[#e5e5e5]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                        isSelected ? "bg-[#E8F5EE]" : "bg-[#F4F4F5]"
                      }`}
                    >
                      {g.icon}
                    </div>
                    <div
                      className="text-[14px] sm:text-[15px] font-semibold mb-0.5 text-[#0F1A15]"
                    >
                      {g.title}
                    </div>
                    <div className="text-[12px] sm:text-[13px] text-[#6B6B6B] leading-snug">
                      {g.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---- STEP 2: Country selection ---- */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1B6B4A] text-white text-[13px] font-semibold">
                2
              </span>
              <h2
                className="text-[20px] tracking-tight"
                style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontWeight: 500,
                }}
              >
                Where are you?
              </h2>
            </div>

            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full sm:w-80 bg-white rounded-xl px-4 py-3 text-[15px] text-[#0F1A15] border border-[#e5e5e5] focus:outline-none focus:ring-2 focus:ring-[#1B6B4A] focus:border-transparent appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%236B6B6B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
              }}
            >
              <option value="">Select your country</option>
              {COUNTRY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* ---- EMAIL GATE ---- */}
          {selectedGoals.length > 0 && selectedCountry && !emailSubmitted && (
            <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-sm text-center">
              <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-2">Your custom panel</div>
              <h3 className="text-[22px] font-semibold tracking-tight mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
                {markers.length} markers selected
              </h3>
              <p className="text-[13px] text-[#5A635D] mb-5 max-w-md mx-auto leading-relaxed">
                Enter your email to see your full marker list, lab directions, and how to prepare. We'll also send a reminder when it's time to upload your results.
              </p>
              <form onSubmit={handleEmailSubmit} className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 text-[14px] border border-[#E5E5E5] rounded-full px-4 py-3 focus:outline-none focus:border-[#1B6B4A]"
                />
                <button
                  type="submit"
                  className="text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-colors flex-shrink-0"
                >
                  Show my panel
                </button>
              </form>
              <p className="text-[10px] text-[#B5B5B5] mt-3">No spam. Your test guide + preparation tips + upload reminder.</p>
            </div>
          )}

          {/* ---- EMPOWERMENT NOTE ---- */}
          {selectedGoals.length > 0 && selectedCountry && (
            <div className="bg-[#E8F5EE] rounded-[20px] p-5 flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <div>
                <p className="text-[13px] text-[#0F1A15] font-medium mb-1">You don't need anyone to book a blood test for you.</p>
                <p className="text-[12px] text-[#5A635D] leading-relaxed">Walk into any lab on the list, ask for these markers, and you're done. Other platforms charge €300-500 and book the same tests at the same labs. Save your money — we'll analyze the results.</p>
              </div>
            </div>
          )}

          {/* ---- RESULT PANEL ---- */}
          {showResult && (
            <div className="space-y-6 animate-in fade-in">
              {/* Recommended panel */}
              <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-sm">
                <h3
                  className="text-[20px] tracking-tight mb-1"
                  style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontWeight: 500,
                  }}
                >
                  Your recommended panel
                </h3>
                <p className="text-[13px] text-[#6B6B6B] mb-5">
                  {markers.length} markers for{" "}
                  {selectedGoals.map(g => GOALS.find(x => x.key === g)?.title).join(' + ')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mb-6">
                  {markers.map((m) => (
                    <div key={m} className="flex items-center gap-2.5 py-1">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1B6B4A"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="flex-shrink-0"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span className="text-[14px] text-[#0F1A15]">{m}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] bg-[#E8F5EE] hover:bg-[#D5EDDF] px-5 py-2.5 rounded-full transition-colors"
                >
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy list
                    </>
                  )}
                </button>
              </div>

              {/* Where to test */}
              {countryInfo && (
                <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-sm">
                  <h3
                    className="text-[20px] tracking-tight mb-5"
                    style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontWeight: 500,
                    }}
                  >
                    Where to test in {selectedCountry}
                  </h3>

                  <div className="space-y-4">
                    {countryInfo.labs.map((lab) => (
                      <div
                        key={lab.name}
                        className="border border-[#F0F0F0] rounded-xl p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[15px] font-semibold text-[#0F1A15]">
                            {lab.name}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${easeBadge(
                              lab.ease
                            )}`}
                          >
                            {lab.ease}
                          </span>
                        </div>
                        <div className="text-[13px] text-[#6B6B6B] mb-1.5">
                          <span className="font-medium text-[#0F1A15]">Cost:</span>{" "}
                          {lab.cost}
                        </div>
                        <div className="text-[13px] text-[#6B6B6B] leading-relaxed">
                          {lab.tip}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What to tell the lab */}
              <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-sm">
                <h3
                  className="text-[20px] tracking-tight mb-4"
                  style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontWeight: 500,
                  }}
                >
                  What to tell the lab
                </h3>
                <p className="text-[14px] text-[#3A3A3A] leading-relaxed">
                  Ask for{" "}
                  <strong>{selectedGoals.map(g => PANEL_NAMES[g]).join(" + ")}</strong>. If they
                  don't have a bundle, request these individual tests:{" "}
                  <span className="text-[#1B6B4A] font-medium">
                    {markerListText}
                  </span>
                  . Make sure to get your results as a PDF — you'll upload
                  it to Lipa for research-grade analysis.
                </p>
              </div>

              {/* CTA */}
              <div className="text-center pt-2">
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-2 text-[15px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-8 py-3.5 rounded-full transition-colors shadow-sm"
                >
                  Upload your results when ready
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <p className="text-[13px] text-[#8A928C] mt-3">
                  Don't have results yet? Come back when you do — your first
                  analysis is free.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
