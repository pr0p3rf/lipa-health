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

    // Store in chat_messages table (reuse existing table)
    await supabase.from("chat_messages").insert({
      name: email || "App user",
      email: email || "unknown",
      message: `[${type || "support"}] ${biomarkerName ? `(${biomarkerName}) ` : ""}${message}`,
      page: page || "/dashboard",
      user_id: userId || null,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Support error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
