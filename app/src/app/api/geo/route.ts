import { NextRequest, NextResponse } from "next/server";

// Returns the visitor's ISO-3166 alpha-2 country from Vercel's edge
// geolocation header. Used by client components for display-only
// localization (formatPrice). Stripe Adaptive Pricing handles the
// actual checkout conversion server-side, so this is purely cosmetic
// and safe to fail open.
export async function GET(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  return NextResponse.json({ country });
}
