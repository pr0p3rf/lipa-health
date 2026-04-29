"use client";
import { useEffect, useState } from "react";

// Client-side hook that fetches the visitor's country code from /api/geo.
// Returns null until the fetch completes. Components should fall back
// to EUR-style display when null.
//
// Cached in sessionStorage so subsequent renders within the session
// don't re-fetch.

const CACHE_KEY = "lipa.country";

export function useCountry(): string | null {
  const [country, setCountry] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(CACHE_KEY);
  });

  useEffect(() => {
    if (country) return;
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d: { country: string | null }) => {
        if (cancelled || !d?.country) return;
        try {
          window.sessionStorage.setItem(CACHE_KEY, d.country);
        } catch {}
        setCountry(d.country);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [country]);

  return country;
}
