import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createPriceConverter } from "./price-converter";

const window = new Window();
const document = window.document as unknown as Document;
for (const name of ["document", "Node", "Element", "NodeFilter", "navigator"] as const) {
  Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
}

function label(text: string) {
  const element = document.createElement("div");
  element.setAttribute("aria-label", text);
  document.body.append(element);
  return element;
}

test("retries an unchanged label after a failed rate lookup", async () => {
  let available = false;
  let calls = 0;
  const converter = createPriceConverter(
    async () => {
      calls++;
      return available ? { rate: 25, date: "2026-10-13" } : null;
    },
    () => "CZK",
  );
  const element = label("Price 19,99€");
  await converter.scan(element);
  await Bun.sleep(0);
  expect(element.getAttribute("aria-label")).toBe("Price 19,99€");
  available = true;
  await converter.scan(element);
  await Bun.sleep(0);
  expect(calls).toBe(2);
  expect(element.getAttribute("aria-label")).not.toContain("€");
});

test("keeps a mixed-currency label intact until all rates are available", async () => {
  let available = false;
  const converter = createPriceConverter(
    async (from) => {
      return from === "GBP" && !available ? null : { rate: 25, date: "2026-10-13" };
    },
    () => "CZK",
  );
  const original = "Prices: €19.99 and £9.99";
  const element = label(original);
  await converter.scan(element);
  await Bun.sleep(0);
  expect(element.getAttribute("aria-label")).toBe(original);
  available = true;
  await converter.scan(element);
  await Bun.sleep(0);
  expect(element.getAttribute("aria-label")).not.toMatch(/[€£]/);
});

test("lets browser tasks run before a large scan finishes", async () => {
  const root = document.createElement("div");
  root.innerHTML = "<span>€19.99</span>".repeat(500);
  document.body.append(root);
  const converter = createPriceConverter(
    async () => ({ rate: 25, date: "2026-10-13" }),
    () => "CZK",
  );
  let convertedAtNextTask = -1;
  setTimeout(() => {
    convertedAtNextTask = Array.from(root.children).filter(
      (element) => !element.textContent?.includes("€"),
    ).length;
  }, 0);
  await converter.scan(root);
  expect(convertedAtNextTask).toBeGreaterThan(0);
  expect(convertedAtNextTask).toBeLessThan(500);
  expect(root.textContent).not.toContain("€");
  root.remove();
});

test("stops a yielded scan when its root is removed", async () => {
  const root = document.createElement("div");
  root.innerHTML = "<span>€19.99</span>".repeat(500);
  document.body.append(root);
  const converter = createPriceConverter(
    async () => ({ rate: 25, date: "2026-10-13" }),
    () => "CZK",
  );
  setTimeout(() => root.remove(), 0);
  await converter.scan(root);
  expect(root.isConnected).toBe(false);
  expect(root.textContent).toContain("€");
});

test("continues scanning surviving siblings when its cursor is removed during a yield", async () => {
  const root = document.createElement("div");
  root.innerHTML = "<span>€19.99</span>".repeat(500);
  document.body.append(root);
  let calls = 0;
  const converter = createPriceConverter(
    async () => {
      calls++;
      return { rate: 25, date: "2026-10-13" };
    },
    () => "CZK",
  );
  setTimeout(() => root.children[49].remove(), 0);
  await converter.scan(root);
  expect(root.children.length).toBe(499);
  expect(root.textContent).not.toContain("€");
  expect(calls).toBe(1);
  root.remove();
});
