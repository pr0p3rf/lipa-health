"use client";

import { Suspense, useState, useEffect } from "react";
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
  const defaultSignUp = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(defaultSignUp);

  // Magic-link is primary. Password mode is opt-in for users who set one.
  const [usePassword, setUsePassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Detect password recovery callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        setIsResettingPassword(true);
        setUsePassword(true);
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResettingPassword(true);
        setUsePassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Send a magic-link sign-in email. Works for both new and returning users
  // because shouldCreateUser=true: Supabase signs them in if the account
  // exists, creates one if not.
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${redirectTo}`,
        },
      });
      if (authError) {
        setError(authError.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    }
    setLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isSignUp) {
      if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
      if (!/[A-Z]/.test(password)) { setError("Password must include at least one uppercase letter."); setLoading(false); return; }
      if (!/[0-9]/.test(password)) { setError("Password must include at least one number."); setLoading(false); return; }
    }

    try {
      if (isSignUp) {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
          setError(authError.message);
        } else if (data.user) {
          await supabase.from("profiles").insert({ id: data.user.id, email: data.user.email });
          router.push(redirectTo);
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F8F5EF" }}>
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

        {isResettingPassword ? (
          /* ---- Password Reset Form ---- */
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center">Set new password</h1>
            <p className="text-[#6B6B6B] text-[14px] text-center mb-8">Enter your new password below.</p>

            {resetSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-700 text-[13px] p-4 rounded-lg text-center">
                <p className="font-semibold mb-1">Password updated!</p>
                <p>You can now sign in with your new password.</p>
                <button onClick={() => { setIsResettingPassword(false); setResetSuccess(false); }} className="mt-3 text-[13px] font-semibold text-[#1B6B4A] hover:underline">
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] p-3 rounded-lg mb-4">{error}</div>}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  setLoading(true);
                  if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
                  if (!/[A-Z]/.test(password)) { setError("Must include an uppercase letter."); setLoading(false); return; }
                  if (!/[0-9]/.test(password)) { setError("Must include a number."); setLoading(false); return; }
                  const { error: updateError } = await supabase.auth.updateUser({ password });
                  setLoading(false);
                  if (updateError) { setError(updateError.message); } else { setResetSuccess(true); }
                }} className="flex flex-col gap-3">
                  <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-12 bg-white border-[#e5e5e5] text-[15px]" />
                  <Button type="submit" disabled={loading} className="h-12 bg-[#1B6B4A] hover:bg-[#155A3D] text-white font-semibold text-[14px]">
                    {loading ? "Updating..." : "Update password"}
                  </Button>
                </form>
              </>
            )}
          </>
        ) : magicLinkSent ? (
          /* ---- Magic-link sent confirmation ---- */
          <>
            <h1 className="text-[22px] font-semibold mb-2 text-center" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>Check your inbox</h1>
            <p className="text-[#5A635D] text-[14px] text-center mb-8 leading-relaxed">
              We sent a sign-in link to <span className="font-medium text-[#0F1A15]">{email}</span>.
              <br />Click the link to continue.
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setEmail(""); }}
              className="text-[13px] text-[#1B6B4A] font-medium hover:underline mx-auto block"
            >
              Use a different email
            </button>
          </>
        ) : (
        /* ---- Magic-link primary login ---- */
        <>
          <h1 className="text-[24px] mb-2 text-center" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
            {isSignUp ? "Create your account" : "Sign in to Lipa"}
          </h1>
          <p className="text-[#5A635D] text-[14px] text-center mb-8 leading-relaxed">
            {isSignUp ? "We'll email you a sign-in link." : "Enter your email — we'll send you a sign-in link."}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {!usePassword ? (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-white border-[#e5e5e5] text-[15px]"
              />
              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="h-12 bg-[#1B6B4A] hover:bg-[#155A3D] text-white font-semibold text-[14px] tracking-wide"
              >
                {loading ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
          ) : (
            /* ---- Password fallback (opt-in) ---- */
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="your@email.com"
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
          )}

          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => { setUsePassword(!usePassword); setError(""); }}
              className="text-[12px] text-[#8A928C] hover:text-[#1B6B4A] transition-colors"
            >
              {usePassword ? "← Email me a sign-in link instead" : "Use a password instead"}
            </button>

            {usePassword && !isSignUp && (
              <button
                onClick={async () => {
                  if (!email) {
                    setError("Enter your email address first.");
                    return;
                  }
                  setError("");
                  setLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/login`,
                  });
                  setLoading(false);
                  if (error) {
                    setError(error.message);
                  } else {
                    setError("");
                    alert("Password reset email sent. Check your inbox.");
                  }
                }}
                className="text-[12px] text-[#8A928C] hover:text-[#1B6B4A] transition-colors"
              >
                Forgot your password?
              </button>
            )}

            {usePassword && (
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="text-[12px] text-[#8A928C] hover:text-[#1B6B4A] transition-colors"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
        </>
        )}
      </div>
    </div>
  );
}
