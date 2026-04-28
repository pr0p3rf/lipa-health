"use client";

import { useState } from "react";

interface SupportButtonProps {
  userId?: string;
  email?: string;
  context?: string; // e.g. biomarker name, page name
}

export function SupportButton({ userId, email, context }: SupportButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [type, setType] = useState("issue");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Use the prop when present (logged-in user), otherwise the field they fill in.
  const effectiveEmail = email || contactEmail.trim() || undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: effectiveEmail,
          type,
          message: message.trim(),
          page: typeof window !== "undefined" ? window.location.pathname : "",
          biomarkerName: context,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data?.error || data?.logError || "Could not save your message. Please email support@lipa.health directly.");
        setSending(false);
        return;
      }
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setMessage(""); setContactEmail(""); }, 2000);
    } catch {
      setErrorMsg("Network error. Please email support@lipa.health directly.");
    }
    setSending(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 text-[11px] font-medium text-[#8A928C] hover:text-[#1B6B4A] bg-white border border-[rgba(15,26,21,0.08)] rounded-full px-3 py-1.5 transition-colors flex items-center gap-1.5"
        style={{ boxShadow: "0 2px 8px rgba(15,26,21,0.06)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Help &amp; Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
            style={{ boxShadow: "0 24px 80px rgba(15,26,21,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-[#E8F5EE] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="text-[14px] font-medium text-[#0F1A15]">Message sent</p>
                <p className="text-[12px] text-[#8A928C] mt-1">We'll get back to you shortly.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-semibold text-[#0F1A15]">Help &amp; Feedback</h3>
                  <button onClick={() => setOpen(false)} className="text-[#8A928C] hover:text-[#0F1A15]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="flex gap-2 mb-3">
                    {["issue", "feedback", "question"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors ${
                          type === t
                            ? "bg-[#1B6B4A] text-white"
                            : "bg-[#F4F4F5] text-[#5A635D] hover:bg-[#E5E5E5]"
                        }`}
                      >
                        {t === "issue" ? "Report issue" : t === "feedback" ? "Feedback" : "Question"}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === "issue" ? "Describe what went wrong..." :
                      type === "feedback" ? "Tell us what you think..." :
                      "What would you like to know?"
                    }
                    className="w-full text-[13px] border border-[#E5E5E5] rounded-xl px-4 py-3 h-28 resize-none focus:outline-none focus:border-[#1B6B4A] placeholder:text-[#B5B5B5]"
                    autoFocus
                  />

                  {/* Email input shown when we don't already have one for this user */}
                  {!email && (
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Your email (so we can reply)"
                      className="w-full text-[13px] border border-[#E5E5E5] rounded-xl px-4 py-2.5 mt-2 focus:outline-none focus:border-[#1B6B4A] placeholder:text-[#B5B5B5]"
                    />
                  )}

                  {errorMsg && (
                    <p className="text-[12px] text-[#B91C1C] mt-2">{errorMsg}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[10px] text-[#B5B5B5]">
                      Or email <a href="mailto:support@lipa.health" className="text-[#1B6B4A] hover:underline">support@lipa.health</a>
                    </p>
                    <button
                      type="submit"
                      disabled={!message.trim() || sending}
                      className="text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2 rounded-full transition-colors disabled:opacity-40"
                    >
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
