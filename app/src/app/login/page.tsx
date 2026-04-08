"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
            <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" />
            <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" stroke="#1B6B4A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
          </svg>
          <span className="text-[18px] font-semibold tracking-[2px] uppercase">Lipa</span>
        </div>

        {sent ? (
          <div className="text-center">
            <h1 className="text-[22px] font-semibold mb-3">Check your email</h1>
            <p className="text-[#6B6B6B] text-[15px]">
              We sent a magic link to <strong className="text-[#1A1A1A]">{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Sign in to Lipa Health</h1>
            <p className="text-[#6B6B6B] text-[14px] text-center mb-8">
              Enter your email and we&apos;ll send you a magic link.
            </p>
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-white border-[#e5e5e5] text-[15px]"
              />
              <Button
                type="submit"
                disabled={loading}
                className="h-12 bg-[#1B6B4A] hover:bg-[#155A3D] text-white font-semibold text-[14px] tracking-wide"
              >
                {loading ? "Sending..." : "Continue with Email"}
              </Button>
            </form>
            <p className="text-[12px] text-[#999] text-center mt-6">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
