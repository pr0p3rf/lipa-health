import { NextResponse } from "next/server";

export async function GET() {
  const keys = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const result: Record<string, any> = {};
  for (const key of keys) {
    const val = process.env[key] || "";
    result[key] = {
      set: val.length > 0,
      length: val.length,
      prefix: val.slice(0, 8),
      hasNewline: val.includes("\n"),
      endsWithNewline: val.endsWith("\n"),
      lastChar: val.charCodeAt(val.length - 1),
    };
  }
  return NextResponse.json(result);
}
