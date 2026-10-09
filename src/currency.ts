export const DEFAULT_CURRENCY = "CZK";
export const TARGET_CURRENCIES = [
  "CZK",
  "EUR",
  "USD",
  "GBP",
  "PLN",
  "CHF",
  "HUF",
  "SEK",
  "NOK",
  "DKK",
  "CAD",
  "AUD",
] as const;
export type Currency = (typeof TARGET_CURRENCIES)[number];

const symbols: Record<string, Currency> = {
  "€": "EUR",
  "£": "GBP",
  $: "USD",
  Kč: "CZK",
  zł: "PLN",
  EUR: "EUR",
  GBP: "GBP",
  USD: "USD",
  CZK: "CZK",
  PLN: "PLN",
  CHF: "CHF",
};
const token = "(?:€|£|\\$|Kč|zł|EUR|GBP|USD|CZK|PLN|CHF)";
const pricePattern = new RegExp(
  `^\\s*(${token})?\\s*([0-9][0-9\\s\\u00a0\\u202f.,]*)\\s*(${token})?\\s*$`,
  "i",
);
const embeddedPricePattern = new RegExp(
  `${token}\\s*[0-9][0-9\\s\\u00a0\\u202f.,]*|[0-9][0-9\\s\\u00a0\\u202f.,]*\\s*${token}`,
  "gi",
);

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && TARGET_CURRENCIES.includes(value as Currency);
}

export function parsePrice(text: string): { amount: number; currency: Currency } | null {
  const match = text.match(pricePattern);
  if (!match) return null;
  const prefix = match[1] ? (symbols[match[1]] ?? symbols[match[1].toUpperCase()]) : undefined;
  const suffix = match[3] ? (symbols[match[3]] ?? symbols[match[3].toUpperCase()]) : undefined;
  if (!prefix && !suffix) return null;
  if (prefix && suffix && prefix !== suffix) return null;
  const raw = match[2].replace(/[\s\u00a0\u202f]/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const hasCents = separator >= 0 && raw.length - separator - 1 === 2;
  const integer = hasCents ? raw.slice(0, separator) : raw;
  const cents = hasCents ? raw.slice(separator + 1) : "";
  if (!/^\d[\d.,]*$/.test(integer) || (cents && !/^\d{2}$/.test(cents))) return null;
  const amount = Number(integer.replace(/[.,]/g, "") + (cents ? `.${cents}` : ""));
  if (!Number.isFinite(amount)) return null;
  const currency = prefix || suffix;
  if (!currency) return null;
  return { amount, currency };
}

export function findPrices(text: string): Array<{ start: number; end: number; text: string }> {
  return Array.from(text.matchAll(embeddedPricePattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  })).filter((match) => parsePrice(match.text) !== null);
}
