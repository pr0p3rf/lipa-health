"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Upload", href: "/upload" },
  { label: "Account", href: "/account" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#FAFAF8]/85 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
            <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" />
            <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" stroke="#1B6B4A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
          </svg>
          <span className="text-[15px] font-semibold tracking-[1.5px] uppercase">Lipa</span>
        </Link>

        {/* Nav tabs */}
        <div className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-[13px] rounded-md transition-colors ${
                pathname === item.href
                  ? "text-[#1B6B4A] font-semibold bg-[#1B6B4A]/[0.06]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link
            href="/upload"
            className="text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-4 py-2 rounded-full transition-colors"
          >
            Upload Results
          </Link>
          {user && (
            <button
              onClick={handleSignOut}
              className="text-[12px] text-[#999] hover:text-[#1A1A1A] transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
