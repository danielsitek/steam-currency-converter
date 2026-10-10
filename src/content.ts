import { DEFAULT_CURRENCY, isCurrency, type Currency } from "./currency";
import { createPriceConverter, type Rate } from "./price-converter";

const rates = new Map<string, Promise<Rate | null>>();
const queued = new Set<Node>();
let target: Currency = DEFAULT_CURRENCY;
let scheduled = false;

function getRate(from: Currency, to: Currency): Promise<Rate | null> {
  const key = `${from}:${to}`;
  const existing = rates.get(key);
  if (existing) {
    return existing;
  }
  const request = chrome.runtime
    .sendMessage({ type: "getRate", from, to })
    .then((result: unknown): Rate | null => {
      if (!result || typeof result !== "object" || !("rate" in result) || !("date" in result)) {
        return null;
      }
      return typeof result.rate === "number" &&
        Number.isFinite(result.rate) &&
        result.rate > 0 &&
        typeof result.date === "string"
        ? { rate: result.rate, date: result.date }
        : null;
    })
    .catch(() => null)
    .finally(() => rates.delete(key));
  rates.set(key, request);
  return request;
}

const converter = createPriceConverter(getRate, () => target);

function queue(root: Node): void {
  queued.add(root);
  if (scheduled) {
    return;
  }
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const node of queued) {
      converter.scan(node);
    }
    queued.clear();
  });
}

async function loadCurrency(): Promise<void> {
  const settings = await chrome.storage.sync.get("targetCurrency");
  target = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
  queue(document.body);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.targetCurrency) {
    void loadCurrency();
  }
});

new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "characterData" || record.type === "attributes") {
      queue(record.target);
    } else {
      for (const node of record.addedNodes) {
        queue(node);
      }
    }
  }
}).observe(document.documentElement, {
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label"],
  subtree: true,
});

void loadCurrency();
