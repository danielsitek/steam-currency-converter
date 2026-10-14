import { expect, test } from "bun:test";
import { findPrices, parsePrice } from "./currency";

test("reads Steam's Czech euro prices and decimal separators", () => {
  expect(parsePrice("19,99€")).toEqual({ amount: 19.99, currency: "EUR" });
  expect(parsePrice("1 299,99 €")).toEqual({ amount: 1299.99, currency: "EUR" });
  expect(parsePrice("€1,299.99")).toEqual({ amount: 1299.99, currency: "EUR" });
});

test("reads other supported source currencies", () => {
  expect(parsePrice("$9.99")).toEqual({ amount: 9.99, currency: "USD" });
  expect(parsePrice("£12.50")).toEqual({ amount: 12.5, currency: "GBP" });
  expect(parsePrice("499 Kč")).toEqual({ amount: 499, currency: "CZK" });
  expect(parsePrice("CHF 24.90")).toEqual({ amount: 24.9, currency: "CHF" });
});

test("ignores non-price and ambiguous text", () => {
  expect(parsePrice("Free To Play")).toBeNull();
  expect(parsePrice("19,99")).toBeNull();
  expect(parsePrice("€19.99 USD")).toBeNull();
  expect(parsePrice("€12,ab")).toBeNull();
});

test("accepts matching currency markers and grouped prices", () => {
  expect(parsePrice("€1.299,99 EUR")).toEqual({ amount: 1299.99, currency: "EUR" });
  expect(parsePrice("eur 0,00")).toEqual({ amount: 0, currency: "EUR" });
});

test("finds both prices in a sale accessibility label", () => {
  const prices = findPrices("50% off (29,99€ normally, 14,99€ after discount)");
  expect(prices.map((match) => match.text.trim())).toEqual(["29,99€", "14,99€"]);
  expect(prices.map((match) => match.price.amount)).toEqual([29.99, 14.99]);
});

test("does not reinterpret qualified dollars or conflicting markers inside labels", () => {
  for (const value of [
    "CDN$ 9.99",
    "A$ 9.99",
    "HK$9.99",
    "€19.99 USD",
    "EURope 19.99",
    "$9.99CAD",
    "€19.99USDx",
    "€19.99 USDT",
    "$9.99 CAD",
    "CAD $9.99",
    "$9.99 cad",
    "EUR $9.99",
  ]) {
    expect(findPrices(value)).toEqual([]);
  }
  expect(findPrices("Price: $9.99!")[0]?.price).toEqual({ amount: 9.99, currency: "USD" });
  expect(findPrices("Price: €19.99 EUR")[0]?.price).toEqual({ amount: 19.99, currency: "EUR" });
});

test("keeps normal uppercase sale words after a price", () => {
  expect(findPrices("€19.99 OFF")[0]?.price).toEqual({ amount: 19.99, currency: "EUR" });
  expect(findPrices("€19.99 HKD")).toEqual([]);
});

test("accepts matching currency qualifiers before a symbol", () => {
  expect(findPrices("USD $9.99")[0]?.price).toEqual({ amount: 9.99, currency: "USD" });
});

test("rejects Canadian dollar aliases separated from the symbol", () => {
  for (const text of ["CDN $9.99", "$9.99 CDN", "Price: cdn\u00a0$9.99"]) {
    expect(findPrices(text)).toEqual([]);
  }
});
