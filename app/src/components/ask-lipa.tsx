"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const FRAUNCES = "'Fraunces', Georgia, serif";

// Simple markdown to HTML for chat messages
function formatMarkdown(text: string): string {
  let html = text;
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // List items
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>');
  // Double newlines = paragraph breaks
  html = html.replace(/\n\n/g, '<div style="height:8px"></div>');
  // Single newlines = line breaks
  html = html.replace(/\n/g, "<br>");
  return html;
}

const SUGGESTED_QUESTIONS = [
  "What should I focus on first?",
  "Why is my iron low?",
  "What foods can help my results?",
  "Is anything urgent here?",
  "Explain my vitamin D level",
];

export function AskLipa({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history from DB on first open
  useEffect(() => {
    if (!open || historyLoaded) return;
    fetch(`/api/chat?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: any) => ({ role: m.role, content: m.content })));
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [open, userId, historyLoaded]);

  // Show invite bubble after 3 seconds
  useEffect(() => {
    if (open || dismissed) return;
    const timer = setTimeout(() => setShowInvite(true), 3000);
    return () => clearTimeout(timer);
  }, [open, dismissed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || streaming) return;

    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          userId,
          history: messages.slice(-10),
        }),
      });

      if (!res.ok) throw new Error("Chat failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullText };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    }

    setStreaming(false);
  }

  return (
    <>
      {/* Invite bubble */}
      {showInvite && !open && (
        <div
          className="fixed bottom-24 right-6 z-50 max-w-[280px] animate-in slide-in-from-bottom-4 fade-in duration-500"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(16px)",
            borderRadius: "16px 16px 4px 16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            padding: "14px 18px",
          }}
        >
          <button
            onClick={() => { setDismissed(true); setShowInvite(false); }}
            className="absolute top-2 right-2 text-[#8A928C] hover:text-[#0F1A15] p-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <p className="text-[13px] text-[#0F1A15] leading-snug pr-4">
            Have questions about your results? <strong className="text-[#1B6B4A]">Ask Lipa</strong> — I have your full panel loaded.
          </p>
          <button
            onClick={() => { setOpen(true); setShowInvite(false); setDismissed(true); }}
            className="mt-2 text-[12px] font-semibold text-[#1B6B4A] hover:underline"
          >
            Ask a question →
          </button>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { setOpen(!open); setShowInvite(false); setDismissed(true); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105"
        style={{
          background: "#1B6B4A",
          boxShadow: "0 4px 24px rgba(27,107,74,0.35)",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden"
          style={{
            width: "420px",
            maxWidth: "calc(100vw - 48px)",
            height: "600px",
            maxHeight: "calc(100vh - 140px)",
            background: "rgba(248,245,239,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "24px",
            boxShadow: "0 24px 80px rgba(15,26,21,0.15), 0 8px 32px rgba(15,26,21,0.08)",
          }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-black/5 flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1B6B4A] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
                <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="white" opacity="0.3" stroke="white" strokeWidth="1" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#0F1A15]">Ask Lipa</div>
              <div className="text-[11px] text-[#8A928C]">Your Personal Health Assistant</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 ? (
              /* Empty state with suggestions */
              <div>
                <p className="text-[13px] text-[#5A635D] mb-4 leading-relaxed">
                  Ask Lipa knows your actual blood test results and searches 100,000+ peer-reviewed studies to answer your questions. Ask about any marker, supplement, or health concern — every answer is specific to your values and backed by real research.
                </p>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-[13px] text-[#0F1A15] px-4 py-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.4)",
                        boxShadow: "0 2px 8px rgba(15,26,21,0.04)",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#1B6B4A] text-white"
                        : ""
                    }`}
                    style={
                      msg.role === "assistant"
                        ? {
                            background: "rgba(255,255,255,0.7)",
                            border: "1px solid rgba(255,255,255,0.4)",
                            boxShadow: "0 2px 8px rgba(15,26,21,0.04)",
                            color: "#0F1A15",
                          }
                        : undefined
                    }
                  >
                    {msg.content ? (
                      <div
                        className="prose-chat"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-[#8A928C]">
                        <div className="w-2 h-2 bg-[#1B6B4A] rounded-full animate-pulse" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-black/5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your results..."
                disabled={streaming}
                className="flex-1 text-[13px] bg-white/70 border border-white/40 rounded-full px-4 py-2.5 focus:outline-none focus:border-[#1B6B4A]/40 placeholder:text-[#B5B5B5] disabled:opacity-50"
                style={{
                  backdropFilter: "blur(8px)",
                }}
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="w-10 h-10 rounded-full bg-[#1B6B4A] flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:bg-[#155A3D] disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
            <p className="text-[9px] text-[#B5B5B5] text-center mt-2">
              Your conversations are private, encrypted, and never shared. You can delete them anytime in settings. Not medical advice.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
