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
export type Price = { amount: number; currency: Currency };
export type PriceMatch = { start: number; end: number; text: string; price: Price };

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
const amountPattern = "[0-9][0-9\\s\\u00a0\\u202f.,]*";
const embeddedPricePattern = new RegExp(
  `(?<![\\p{L}\\p{N}$€£])(?:${token}\\s*${amountPattern}(?:\\s*${token})?|${amountPattern}\\s*${token})(?![\\p{L}\\p{N}.,])`,
  "giu",
);

const currencyCodes = new Set<string>([
  ...TARGET_CURRENCIES,
  ...(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : []),
  "USDT",
  "USDC",
]);

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && TARGET_CURRENCIES.includes(value as Currency);
}

function resolveCurrency(token: string | undefined): Currency | undefined {
  return token ? (symbols[token] ?? symbols[token.toUpperCase()]) : undefined;
}

function parseAmount(text: string): number | null {
  const raw = text.replace(/[\s\u00a0\u202f]/g, "");
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const hasCents = separator >= 0 && raw.length - separator - 1 === 2;
  const integer = hasCents ? raw.slice(0, separator) : raw;
  const cents = hasCents ? raw.slice(separator + 1) : "";
  if (!/^\d[\d.,]*$/.test(integer) || (cents && !/^\d{2}$/.test(cents))) {
    return null;
  }
  const amount = Number(integer.replace(/[.,]/g, "") + (cents ? `.${cents}` : ""));
  return Number.isFinite(amount) ? amount : null;
}

export function parsePrice(text: string): Price | null {
  const match = text.match(pricePattern);
  if (!match) {
    return null;
  }
  const prefix = resolveCurrency(match[1]);
  const suffix = resolveCurrency(match[3]);
  const currency = prefix ?? suffix;
  if (!currency || (prefix && suffix && prefix !== suffix)) {
    return null;
  }
  const amount = parseAmount(match[2]);
  if (amount === null) {
    return null;
  }
  return { amount, currency };
}

export function findPrices(text: string): PriceMatch[] {
  const matches: PriceMatch[] = [];
  for (const match of text.matchAll(embeddedPricePattern)) {
    const price = parsePrice(match[0]);
    if (!price) {
      continue;
    }
    const prefix = text
      .slice(0, match.index)
      .match(/\b([a-z]{3,4})\s*$/i)?.[1]
      ?.toUpperCase();
    const suffix = text
      .slice(match.index + match[0].length)
      .trimStart()
      .match(/^([a-z]{3,4})\b/i)?.[1]
      ?.toUpperCase();
    const conflictingCode = [prefix, suffix].some(
      (code) => code !== undefined && currencyCodes.has(code) && code !== price.currency,
    );
    if (conflictingCode) {
      continue;
    }
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      price,
    });
  }
  return matches;
}
