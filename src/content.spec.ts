import { beforeAll, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";

const browserWindow = new Window({ url: "https://store.steampowered.com/app/123" });
const document = browserWindow.document;
Object.defineProperty(browserWindow.navigator, "language", { configurable: true, value: "cs-CZ" });
let targetCurrency = "CZK";
let readSettings: () => Promise<{ targetCurrency: string }> = async () => ({ targetCurrency });
let loadCurrency: () => Promise<void>;
let rateRequests = 0;
let hidden = false;
let frameCalls = 0;
let replyToRateRequest: () => Promise<unknown> = async () => ({
  rate: 25,
  date: "2026-10-10",
});
let onStorageChanged: (changes: Record<string, unknown>, area: string) => void;

for (const name of ["Node", "Element", "NodeFilter", "MutationObserver", "navigator"] as const) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: browserWindow[name],
  });
}
Object.defineProperty(globalThis, "document", { configurable: true, value: document });
Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
Object.defineProperty(globalThis, "requestAnimationFrame", {
  configurable: true,
  value: (callback: FrameRequestCallback) => {
    frameCalls++;
    if (!hidden) {
      setTimeout(() => callback(performance.now()), 0);
    }
    return frameCalls;
  },
});
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    runtime: {
      async sendMessage() {
        rateRequests++;
        return replyToRateRequest();
      },
    },
    storage: {
      sync: {
        async get() {
          return readSettings();
        },
      },
      onChanged: {
        addListener(callback: typeof onStorageChanged) {
          onStorageChanged = callback;
        },
      },
    },
  },
});

async function waitFor(assertion: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (assertion()) {
      return;
    }
    await Bun.sleep(5);
  }
  throw new Error("Timed out waiting for price conversion");
}

beforeAll(async () => {
  ({ loadCurrency } = await import("./content"));
});

beforeEach(async () => {
  document.body.replaceChildren();
  targetCurrency = "CZK";
  readSettings = async () => ({ targetCurrency });
  hidden = false;
  rateRequests = 0;
  replyToRateRequest = async () => ({ rate: 25, date: "2026-10-10" });
  onStorageChanged({ targetCurrency: { newValue: targetCurrency } }, "sync");
  await Bun.sleep(0);
});

test("converts a standalone text price and keeps its whitespace and original tooltip", async () => {
  const price = document.createElement("div");
  price.textContent = " 19,99€ ";
  document.body.append(price);

  await waitFor(() => price.textContent?.includes("Kč") ?? false);

  expect(price.textContent?.startsWith(" ")).toBe(true);
  expect(price.textContent?.endsWith(" ")).toBe(true);
  expect(price.title).toBe("19,99€ · estimated exchange rate from 2026-10-10");
  expect(rateRequests).toBe(1);
});

test("converts both prices in an accessibility label without changing markup", async () => {
  const card = document.createElement("div");
  card.setAttribute("aria-label", "50% off (29,99€ normally, 14,99€ after discount)");
  card.innerHTML = "<strong>Sale</strong>";
  document.body.append(card);

  await waitFor(() => card.getAttribute("aria-label")?.includes("Kč") ?? false);

  expect(card.getAttribute("aria-label")).toContain("normally");
  expect(card.getAttribute("aria-label")).toContain("after discount");
  expect(card.getAttribute("aria-label")?.match(/Kč/g)).toHaveLength(2);
  expect(card.innerHTML).toBe("<strong>Sale</strong>");
  expect(rateRequests).toBe(1);
});

test("reconverts edited source text and restores it when the target matches", async () => {
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await waitFor(() => price.textContent?.includes("Kč") ?? false);

  price.firstChild!.textContent = "29,99€";
  await waitFor(() => price.title.startsWith("29,99€"));
  expect(price.textContent).toContain("749,75");

  targetCurrency = "EUR";
  onStorageChanged({ targetCurrency: { newValue: targetCurrency } }, "sync");
  await waitFor(() => price.textContent === "29,99€");
  expect(price.hasAttribute("title")).toBe(false);
});

test("does not overwrite text changed while a rate request is pending", async () => {
  let respond!: (value: unknown) => void;
  replyToRateRequest = () => new Promise((resolve) => (respond = resolve));
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await waitFor(() => typeof respond === "function");

  price.firstChild!.textContent = "Free To Play";
  respond({ rate: 25, date: "2026-10-10" });
  await Bun.sleep(20);

  expect(price.textContent).toBe("Free To Play");
});

test("does not apply a pending rate after the target currency changes", async () => {
  let respond!: (value: unknown) => void;
  replyToRateRequest = () => new Promise((resolve) => (respond = resolve));
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await waitFor(() => typeof respond === "function");

  targetCurrency = "EUR";
  onStorageChanged({ targetCurrency: { newValue: targetCurrency } }, "sync");
  respond({ rate: 25, date: "2026-10-10" });
  await Bun.sleep(20);

  expect(price.textContent).toBe("19,99€");
  expect(price.hasAttribute("title")).toBe(false);
});

test("does not convert a node detached while its rate request is pending", async () => {
  let respond!: (value: unknown) => void;
  replyToRateRequest = () => new Promise((resolve) => (respond = resolve));
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await waitFor(() => typeof respond === "function");

  price.remove();
  respond({ rate: 25, date: "2026-10-10" });
  await Bun.sleep(20);

  expect(price.textContent).toBe("19,99€");
  expect(price.hasAttribute("title")).toBe(false);
});

test("ignores editable fields and converts newly inserted prices", async () => {
  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.textContent = "19,99€";
  document.body.append(editable);
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);

  await waitFor(() => price.textContent?.includes("Kč") ?? false);

  expect(editable.textContent).toBe("19,99€");
});

test("defers hidden-page mutations and scans the live page when visible again", async () => {
  hidden = true;
  document.dispatchEvent(new browserWindow.Event("visibilitychange"));
  const callsBeforeMutations = frameCalls;

  for (let index = 0; index < 5; index++) {
    const removed = document.createElement("div");
    removed.textContent = "19,99€";
    document.body.replaceChildren(removed);
    await Bun.sleep(1);
  }
  expect(frameCalls).toBe(callsBeforeMutations);

  const livePrice = document.createElement("div");
  livePrice.textContent = "29,99€";
  document.body.replaceChildren(livePrice);
  hidden = false;
  document.dispatchEvent(new browserWindow.Event("visibilitychange"));

  await waitFor(() => livePrice.textContent?.includes("Kč") ?? false);
  expect(livePrice.textContent).toContain("749,75");
});

test("keeps a newer currency change when the initial settings read completes late", async () => {
  let respond!: (value: { targetCurrency: string }) => void;
  readSettings = () =>
    new Promise((resolve) => {
      respond = resolve;
    });
  const loading = loadCurrency();
  targetCurrency = "EUR";
  onStorageChanged({ targetCurrency: { newValue: targetCurrency } }, "sync");
  respond({ targetCurrency: "CZK" });
  await loading;
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await Bun.sleep(20);
  expect(price.textContent).toBe("19,99€");
});

test("continues scanning when settings storage is unavailable", async () => {
  readSettings = async () => {
    throw new Error("Storage unavailable");
  };
  await loadCurrency();
  const price = document.createElement("div");
  price.textContent = "19,99€";
  document.body.append(price);
  await waitFor(() => price.textContent?.includes("Kč") ?? false);
});
