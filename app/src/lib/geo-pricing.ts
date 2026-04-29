// Display-only geo pricing. Stripe Adaptive Pricing handles the actual
// checkout conversion using live FX; this module renders human-readable
// price strings on the product surface so users see their local
// currency BEFORE clicking "checkout."
//
// Conversion rates here are approximate and stable, not live FX.
// Drift of ±5% vs spot is acceptable — the goal is "display feels
// native," not "perfectly priced." Stripe charges the converted amount
// at the real rate; users see the small mismatch as "exchange rate"
// in checkout.
//
// Update the table periodically (quarterly is fine).

interface CurrencyConfig {
  code: string;
  symbol: string;
  rate: number;            // EUR → local
  symbolBefore: boolean;
  round: number;           // round to nearest N (e.g. 5 = round 42 → 40 or 45)
}

const COUNTRY_TO_CURRENCY: Record<string, CurrencyConfig> = {
  US: { code: "USD", symbol: "$", rate: 1.08, symbolBefore: true, round: 1 },
  CA: { code: "CAD", symbol: "$", rate: 1.46, symbolBefore: true, round: 1 },
  GB: { code: "GBP", symbol: "£", rate: 0.85, symbolBefore: true, round: 1 },
  AU: { code: "AUD", symbol: "$", rate: 1.65, symbolBefore: true, round: 1 },
  NZ: { code: "NZD", symbol: "$", rate: 1.78, symbolBefore: true, round: 1 },
  PL: { code: "PLN", symbol: "zł", rate: 4.30, symbolBefore: false, round: 5 },
  CH: { code: "CHF", symbol: "CHF", rate: 0.96, symbolBefore: false, round: 1 },
  SE: { code: "SEK", symbol: "kr", rate: 11.40, symbolBefore: false, round: 5 },
  NO: { code: "NOK", symbol: "kr", rate: 11.50, symbolBefore: false, round: 5 },
  DK: { code: "DKK", symbol: "kr", rate: 7.45, symbolBefore: false, round: 5 },
  CZ: { code: "CZK", symbol: "Kč", rate: 25.20, symbolBefore: false, round: 10 },
  HU: { code: "HUF", symbol: "Ft", rate: 405, symbolBefore: false, round: 100 },
  RO: { code: "RON", symbol: "lei", rate: 4.97, symbolBefore: false, round: 5 },
  BR: { code: "BRL", symbol: "R$", rate: 5.40, symbolBefore: true, round: 5 },
  MX: { code: "MXN", symbol: "$", rate: 18.30, symbolBefore: true, round: 5 },
  IN: { code: "INR", symbol: "₹", rate: 90, symbolBefore: true, round: 50 },
  JP: { code: "JPY", symbol: "¥", rate: 162, symbolBefore: true, round: 50 },
  SG: { code: "SGD", symbol: "$", rate: 1.45, symbolBefore: true, round: 1 },
  AE: { code: "AED", symbol: "AED", rate: 3.97, symbolBefore: false, round: 5 },
  ZA: { code: "ZAR", symbol: "R", rate: 19.80, symbolBefore: true, round: 10 },
  // EU members default to EUR (no entry needed). Same for any country
  // we don't recognize — falls through to the EUR base.
};

export function formatPrice(country: string | null | undefined, eurAmount: number, suffix?: string): string {
  const cfg = country ? COUNTRY_TO_CURRENCY[country.toUpperCase()] : null;
  if (!cfg) {
    const base = `€${eurAmount}`;
    return suffix ? `${base}${suffix}` : base;
  }
  const raw = eurAmount * cfg.rate;
  const rounded = Math.round(raw / cfg.round) * cfg.round;
  const formatted = cfg.symbolBefore ? `${cfg.symbol}${rounded}` : `${rounded} ${cfg.symbol}`;
  return suffix ? `${formatted}${suffix}` : formatted;
}

export function getCurrencyCode(country: string | null | undefined): string {
  const cfg = country ? COUNTRY_TO_CURRENCY[country.toUpperCase()] : null;
  return cfg?.code ?? "EUR";
}
