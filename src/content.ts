import { SCAN_TIME_BUDGET_MS, uniqueScanRoots, yieldToBrowser } from "./dom-scheduler";
import { DEFAULT_CURRENCY, isCurrency, type Currency } from "./currency";
import { createPriceConverter, type Rate } from "./price-converter";

const rates = new Map<string, Promise<Rate | null>>();
const queued = new Set<Node>();
let target: Currency = DEFAULT_CURRENCY;
let settingsVersion = 0;
let scheduled = false;
let scanning = false;
let needsFullScan = false;
let scheduleVersion = 0;

async function requestRate(from: Currency, to: Currency): Promise<Rate | null> {
  try {
    const result: unknown = await chrome.runtime.sendMessage({ type: "getRate", from, to });
    if (!result || typeof result !== "object" || !("rate" in result) || !("date" in result)) {
      return null;
    }
    return typeof result.rate === "number" &&
      Number.isFinite(result.rate) &&
      result.rate > 0 &&
      typeof result.date === "string"
      ? { rate: result.rate, date: result.date }
      : null;
  } catch {
    return null;
  }
}

function getRate(from: Currency, to: Currency): Promise<Rate | null> {
  const key = `${from}:${to}`;
  const existing = rates.get(key);
  if (existing) {
    return existing;
  }
  const request = requestRate(from, to).finally(() => rates.delete(key));
  rates.set(key, request);
  return request;
}

const converter = createPriceConverter(getRate, () => target);

function deferFullScan(): void {
  queued.clear();
  needsFullScan = true;
  scheduled = false;
  scheduleVersion++;
}

function queue(root: Node): void {
  if (document.hidden) {
    deferFullScan();
    return;
  }

  if (needsFullScan) {
    queued.clear();
    queued.add(document.body);
  } else if (root.isConnected) {
    queued.add(root);
  }
  scheduleScan();
}

function scheduleScan(): void {
  if (scheduled || scanning || queued.size === 0) {
    return;
  }

  scheduled = true;
  const version = ++scheduleVersion;
  requestAnimationFrame(() => {
    if (version !== scheduleVersion) {
      return;
    }
    scheduled = false;
    if (document.hidden) {
      deferFullScan();
      return;
    }

    const roots = uniqueScanRoots(queued);
    queued.clear();
    needsFullScan = false;
    scanning = true;
    void scanRoots(roots).finally(() => {
      scanning = false;
      scheduleScan();
    });
  });
}

async function scanRoots(roots: Node[]): Promise<void> {
  let started = performance.now();
  for (const node of roots) {
    if (document.hidden) {
      deferFullScan();
      return;
    }
    await converter.scan(node);
    if (performance.now() - started >= SCAN_TIME_BUDGET_MS) {
      await yieldToBrowser();
      started = performance.now();
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    deferFullScan();
  } else if (needsFullScan) {
    queue(document.body);
  }
});

export async function loadCurrency(): Promise<void> {
  const version = settingsVersion;
  try {
    const settings = await chrome.storage.sync.get("targetCurrency");
    if (version === settingsVersion) {
      target = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
    }
  } catch {
    // Keep the current currency if Chrome storage is temporarily unavailable.
  }
  queue(document.body);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.targetCurrency) {
    settingsVersion++;
    const value: unknown = changes.targetCurrency.newValue;
    target = isCurrency(value) ? value : DEFAULT_CURRENCY;
    queue(document.body);
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
