/**
 * Supabase Edge Function: Forward Chat Messages to Telegram
 *
 * Triggered by a Database Webhook on INSERT to `chat_messages`.
 * Sends the message to Patrick's Telegram chat.
 *
 * Setup:
 * 1. Deploy: supabase functions deploy forward-chat-to-telegram
 * 2. Set secrets:
 *    supabase secrets set TELEGRAM_BOT_TOKEN=<your-bot-token>
 *    supabase secrets set TELEGRAM_CHAT_ID=<your-chat-id>
 * 3. Create a Database Webhook in Supabase Dashboard:
 *    - Table: chat_messages
 *    - Event: INSERT
 *    - Type: Edge Function
 *    - Function: forward-chat-to-telegram
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") || "";

serve(async (req) => {
  try {
    const payload = await req.json();

    // The webhook payload contains the new row
    const record = payload.record || payload;

    const name = record.name || "Anonymous";
    const email = record.email || "no email";
    const message = record.message || "(empty)";
    const page = record.page || "unknown page";
    const time = new Date(record.created_at || Date.now()).toLocaleString("en-GB", {
      timeZone: "Europe/Amsterdam",
    });

    const text = `💬 New Lipa chat message\n\nFrom: ${name}\nEmail: ${email}\nPage: ${page}\nTime: ${time}\n\nMessage:\n${message}`;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "HTML",
          }),
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Error forwarding to Telegram:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
