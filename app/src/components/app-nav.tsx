"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Vault", href: "/vault" },
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
    <>
      {/* Desktop nav */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF8]/85 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
              <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" />
              <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" stroke="#1B6B4A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
            </svg>
            <span className="text-[15px] font-semibold tracking-[1.5px] uppercase hidden sm:inline">Lipa</span>
          </Link>

          {/* Desktop tabs — hidden on mobile */}
          <div className="hidden sm:flex gap-1">
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
          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="text-[12px] sm:text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-3 sm:px-4 py-2 rounded-full transition-colors"
            >
              Upload
            </Link>
            {user && (
              <button
                onClick={handleSignOut}
                className="text-[12px] text-[#999] hover:text-[#1A1A1A] transition-colors hidden sm:block"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-black/[0.06] px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? "text-[#1B6B4A]" : "text-[#8A928C]"
                }`}
              >
                <NavIcon name={item.label} active={isActive} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#1B6B4A" : "#8A928C";
  const w = 20;

  switch (name) {
    case "Overview":
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      );
    case "Vault":
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "Upload":
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case "Account":
      return (
        <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}
