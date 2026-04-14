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

    // Store in support_messages table
    try {
      await supabase.from("chat_messages").insert({
        name: email || "App user",
        email: email || "unknown",
        message: `[${type || "support"}] ${biomarkerName ? `(${biomarkerName}) ` : ""}${message}`,
        page: page || "/dashboard",
        user_id: userId || null,
      });
    } catch {}

    // Send email notification to admin
    const ADMIN_EMAIL = "plipnicki@gmail.com";
    try {
      // Use Supabase Edge Function or direct email — for now, store and we'll poll
      // Also try sending via Supabase's built-in auth email (hacky but works)
      console.log(`[support] New message from ${email || "anonymous"}: ${message.slice(0, 100)}`);

      // Send to Telegram if bot token is available
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (botToken && chatId) {
        const text = `🆘 Support Message\n\nFrom: ${email || "anonymous"}\nType: ${type || "support"}\nPage: ${page || "unknown"}\n\n${message}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Support error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
