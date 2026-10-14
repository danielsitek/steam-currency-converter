import { beforeAll, beforeEach, expect, spyOn, test } from "bun:test";

type Reply = { rate: number; date: string } | { error: string };
type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (reply: Reply) => void,
) => boolean | void;

const storedRates = new Map<string, unknown>();
let listener: MessageListener;
let fetchRate: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    storage: {
      local: {
        async get(key: string) {
          return { [key]: storedRates.get(key) };
        },
        async set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storedRates.set(key, value);
          }
        },
      },
    },
    runtime: {
      onMessage: {
        addListener(callback: MessageListener) {
          listener = callback;
        },
      },
    },
  },
});

Object.defineProperty(globalThis, "fetch", {
  configurable: true,
  value: (...args: Parameters<typeof fetch>) => fetchRate(...args),
});

beforeAll(async () => {
  await import("./background");
});

beforeEach(() => {
  storedRates.clear();
  fetchRate = async () => new Response(JSON.stringify({ rate: 25, date: "2026-10-10" }));
});

function requestRate(from = "EUR", to = "CZK"): Promise<Reply> {
  return new Promise((resolve) => {
    expect(listener({ type: "getRate", from, to }, {}, resolve)).toBe(true);
  });
}

test("rejects invalid messages without sending a response", () => {
  expect(listener({ type: "getRate", from: "INVALID", to: "CZK" }, {}, () => {})).toBe(false);
});

test("returns a fresh cached rate without fetching", async () => {
  storedRates.set("rate:EUR:CZK", {
    rate: 24,
    date: "2026-10-09",
    fetchedAt: Date.now(),
  });
  fetchRate = async () => {
    throw new Error("A fresh rate must not be fetched");
  };

  expect(await requestRate()).toEqual({ rate: 24, date: "2026-10-09" });
});

test("ignores a null value in storage and fetches a new rate", async () => {
  storedRates.set("rate:EUR:CZK", null);

  expect(await requestRate()).toEqual({ rate: 25, date: "2026-10-10" });
});

test("refreshes an expired rate and shares an in-flight request", async () => {
  storedRates.set("rate:EUR:CZK", {
    rate: 24,
    date: "2026-10-09",
    fetchedAt: Date.now() - 13 * 60 * 60 * 1000,
  });
  let calls = 0;
  fetchRate = async () => {
    calls++;
    return new Response(JSON.stringify({ rate: 25, date: "2026-10-10" }));
  };

  expect(await Promise.all([requestRate(), requestRate()])).toEqual([
    { rate: 25, date: "2026-10-10" },
    { rate: 25, date: "2026-10-10" },
  ]);
  expect(calls).toBe(1);
  expect(storedRates.get("rate:EUR:CZK")).toMatchObject({ rate: 25, date: "2026-10-10" });
});

test("uses an expired rate when the service fails", async () => {
  storedRates.set("rate:EUR:CZK", {
    rate: 24,
    date: "2026-10-09",
    fetchedAt: Date.now() - 13 * 60 * 60 * 1000,
  });
  fetchRate = async () => {
    throw new Error("offline");
  };

  expect(await requestRate()).toEqual({ rate: 24, date: "2026-10-09" });
});

test("reports an error when no usable rate exists", async () => {
  fetchRate = async () => new Response("unavailable", { status: 503 });

  expect(await requestRate()).toEqual({ error: "Exchange rate service returned HTTP 503" });
});

test("rejects malformed exchange rate data", async () => {
  fetchRate = async () => new Response(JSON.stringify({ rate: -2, date: "today" }));

  expect(await requestRate()).toEqual({ error: "Invalid exchange rate" });
});

test("aborts a stalled request, falls back, and releases the pending request", async () => {
  storedRates.set("rate:EUR:CZK", { rate: 24, date: "2026-10-09", fetchedAt: 0 });
  const originalTimeout = globalThis.setTimeout;
  const acceleratedTimeout = ((...args: Parameters<typeof setTimeout>) =>
    originalTimeout(args[0], 5, ...args.slice(2))) as typeof setTimeout;
  const timer = spyOn(globalThis, "setTimeout").mockImplementation(acceleratedTimeout);
  fetchRate = async (_url, options) =>
    new Promise((_resolve, reject) => {
      const signal = options?.signal;
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  try {
    expect(await requestRate()).toEqual({ rate: 24, date: "2026-10-09" });
    storedRates.clear();
    expect(await requestRate()).toEqual({ error: "Exchange rate request timed out" });
    fetchRate = async () => new Response(JSON.stringify({ rate: 25, date: "2026-10-10" }));
    expect(await requestRate()).toEqual({ rate: 25, date: "2026-10-10" });
  } finally {
    timer.mockRestore();
  }
});

test("refreshes incomplete, invalid-date and future-dated cached records", async () => {
  for (const value of [
    { rate: 24 },
    { rate: 24, date: "garbage", fetchedAt: Date.now() },
    { rate: 24, date: "2026-02-30", fetchedAt: Date.now() },
    { rate: 24, date: "2026-10-09", fetchedAt: Date.now() + 60_000 },
    { rate: 24, date: "2026-10-09", fetchedAt: -1 },
  ]) {
    storedRates.set("rate:EUR:CZK", value);
    expect(await requestRate()).toEqual({ rate: 25, date: "2026-10-10" });
  }
});

test("does not use malformed cached records as an offline fallback", async () => {
  storedRates.set("rate:EUR:CZK", { rate: 24 });
  fetchRate = async () => {
    throw new Error("offline");
  };
  expect(await requestRate()).toEqual({ error: "offline" });
});
