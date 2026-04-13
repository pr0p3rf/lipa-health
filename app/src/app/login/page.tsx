"use client";

import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-[#999] text-sm">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Password validation for signup
    if (isSignUp) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must include at least one uppercase letter.");
        setLoading(false);
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must include at least one number.");
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
        } else if (data.user) {
          // Create profile
          await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email,
          });
          router.push(redirectTo);
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
        } else {
          router.push(redirectTo);
        }
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    }

    setLoading(false);
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

        <h1 className="text-[22px] font-semibold mb-2 text-center">
          {isSignUp ? "Create your account" : "Sign in to Lipa"}
        </h1>
        <p className="text-[#6B6B6B] text-[14px] text-center mb-8">
          {isSignUp ? "Understand your biology. Keep going." : "Welcome back."}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 bg-white border-[#e5e5e5] text-[15px]"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-12 bg-white border-[#e5e5e5] text-[15px]"
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-12 bg-[#1B6B4A] hover:bg-[#155A3D] text-white font-semibold text-[14px] tracking-wide"
          >
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <p className="text-[13px] text-[#6B6B6B] text-center mt-6">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-[#1B6B4A] font-medium hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
