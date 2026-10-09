import { expect, test } from "bun:test";
import { parsePrice } from "./currency";

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
});
