import type { Currency } from "./currency";

type Rate = { rate: number; date: string; fetchedAt: number };
const TTL_MS = 12 * 60 * 60 * 1000;
const pending = new Map<string, Promise<Rate>>();

function validRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function validTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Date.now();
}

function hasUsableRate(value: unknown): value is Rate {
  return (
    value !== null &&
    typeof value === "object" &&
    "rate" in value &&
    validRate(value.rate) &&
    "date" in value &&
    validDate(value.date) &&
    "fetchedAt" in value &&
    validTimestamp(value.fetchedAt)
  );
}

function parseRateResponse(data: unknown): Pick<Rate, "rate" | "date"> {
  if (!data || typeof data !== "object" || !("rate" in data) || !("date" in data)) {
    throw new Error("Invalid exchange rate response");
  }

  const { rate, date } = data;
  if (!validRate(rate) || !validDate(date)) {
    throw new Error("Invalid exchange rate");
  }
  return { rate, date };
}

async function fetchRate(from: Currency, to: Currency): Promise<Rate> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("Exchange rate request timed out"));
  }, 10_000);
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(`Exchange rate service returned HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return { ...parseRateResponse(data), fetchedAt: Date.now() };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRate(from: Currency, to: Currency): Promise<Rate> {
  if (from === to) {
    return { rate: 1, date: new Date().toISOString().slice(0, 10), fetchedAt: Date.now() };
  }

  const key = `rate:${from}:${to}`;
  const stored = await chrome.storage.local.get(key);
  const cached: unknown = stored[key];
  if (hasUsableRate(cached) && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }

  const inFlight = pending.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    try {
      const rate = await fetchRate(from, to);
      await chrome.storage.local.set({ [key]: rate });
      return rate;
    } catch (error) {
      if (hasUsableRate(cached)) {
        return cached;
      }
      throw error;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, request);
  return request;
}
