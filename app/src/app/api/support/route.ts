import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, email, type, message, page, biomarkerName } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const submittedEmail = email && typeof email === "string" && email.includes("@")
      ? email.trim().toLowerCase()
      : null;

    // Store in chat_messages — note the table has no user_id column, so we
    // encode it into source for traceability instead.
    let logged = false;
    let logError: string | null = null;
    {
      const source = `support:${type || "general"}${userId ? `:user=${userId}` : ":anon"}`;
      const { error } = await supabase.from("chat_messages").insert({
        name: submittedEmail ? submittedEmail.split("@")[0] : "App user",
        email: submittedEmail || "unknown",
        message: `[${type || "support"}] ${biomarkerName ? `(${biomarkerName}) ` : ""}${message}`,
        page: page || "/dashboard",
        source,
      });
      if (error) {
        logError = error.message;
        console.error("[support] insert failed:", error.message);
      } else {
        logged = true;
      }
    }

    // Notification fan-out — independent paths, both best-effort.
    let telegramSent = false;
    let emailSent = false;
    let emailError: string | null = null;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      try {
        const text = `🆘 Support Message\n\nFrom: ${submittedEmail || "anonymous"}\nType: ${type || "support"}\nPage: ${page || "unknown"}\nUser: ${userId || "anon"}\n\n${message}`;
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        telegramSent = tgRes.ok;
      } catch {}
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Lipa Support <support@lipa.health>",
            to: "plipnicki@gmail.com",
            reply_to: submittedEmail || undefined,
            subject: `[Lipa Support] ${type || "message"} from ${submittedEmail || "anonymous"}`,
            text: `From: ${submittedEmail || "anonymous"}\nUser ID: ${userId || "anon"}\nType: ${type || "support"}\nPage: ${page || "unknown"}\n\n${message}`,
          }),
        });
        if (res.ok) {
          emailSent = true;
        } else {
          emailError = `Resend ${res.status}`;
        }
      } catch (e: any) {
        emailError = e?.message || "fetch failed";
      }
    } else {
      emailError = "RESEND_API_KEY not set";
    }

    console.log(
      `[support] from=${submittedEmail || "anon"} logged=${logged} telegram=${telegramSent} email=${emailSent} emailErr=${emailError || "-"} logErr=${logError || "-"}`
    );

    return NextResponse.json({
      success: logged,
      logged,
      telegramSent,
      emailSent,
      logError,
      emailError,
    });
  } catch (error: any) {
    console.error("Support error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
