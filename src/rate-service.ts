import type { Currency } from "./currency";

type Rate = { rate: number; date: string; fetchedAt: number };
const TTL_MS = 12 * 60 * 60 * 1000;
const pending = new Map<string, Promise<Rate>>();

function hasUsableRate(cached: Rate | undefined): cached is Rate {
  return cached !== undefined && Number.isFinite(cached.rate) && cached.rate > 0;
}

function parseRateResponse(data: unknown): Pick<Rate, "rate" | "date"> {
  if (!data || typeof data !== "object" || !("rate" in data) || !("date" in data)) {
    throw new Error("Invalid exchange rate response");
  }

  const { rate, date } = data;
  if (
    typeof rate !== "number" ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error("Invalid exchange rate");
  }
  return { rate, date };
}

async function fetchRate(from: Currency, to: Currency): Promise<Rate> {
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`,
  );
  if (!response.ok) {
    throw new Error(`Exchange rate service returned HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  return { ...parseRateResponse(data), fetchedAt: Date.now() };
}

export async function getRate(from: Currency, to: Currency): Promise<Rate> {
  if (from === to) {
    return { rate: 1, date: new Date().toISOString().slice(0, 10), fetchedAt: Date.now() };
  }

  const key = `rate:${from}:${to}`;
  const stored = await chrome.storage.local.get(key);
  const cached = stored[key] as Rate | undefined;
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
