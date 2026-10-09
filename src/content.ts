import { DEFAULT_CURRENCY, findPrices, isCurrency, parsePrice, type Currency } from "./currency";

type Saved = { original: string; rendered: string; target: Currency };
type Rate = { rate: number; date: string };
const savedText = new WeakMap<Text, Saved>();
const savedLabels = new WeakMap<Element, Saved>();
const addedTitles = new WeakMap<HTMLElement, string>();
const rates = new Map<string, Promise<Rate | null>>();
const queued = new Set<Node>();
const ignored = "script, style, noscript, textarea, option, [contenteditable]";
let target: Currency = DEFAULT_CURRENCY;
let scheduled = false;

function getRate(from: Currency, to: Currency): Promise<Rate | null> {
  const key = `${from}:${to}`;
  const existing = rates.get(key);
  if (existing) return existing;
  const request = chrome.runtime
    .sendMessage({ type: "getRate", from, to })
    .then((result: unknown): Rate | null => {
      if (!result || typeof result !== "object" || !("rate" in result) || !("date" in result))
        return null;
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

function format(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(navigator.language || "cs-CZ", {
    style: "currency",
    currency,
  }).format(amount);
}

function setTooltip(node: Text, original: string, date: string): void {
  const element = node.parentElement;
  if (!element) return;
  const previous = addedTitles.get(element);
  if (element.hasAttribute("title") && element.title !== previous) return;
  const title = `${original.trim()} · estimated exchange rate from ${date}`;
  element.title = title;
  addedTitles.set(element, title);
}

function clearTooltip(node: Text): void {
  const element = node.parentElement;
  if (!element) return;
  const previous = addedTitles.get(element);
  if (previous && element.title === previous) element.removeAttribute("title");
  addedTitles.delete(element);
}

async function convertText(node: Text): Promise<void> {
  if (!node.isConnected || node.parentElement?.closest(ignored)) return;
  const current = node.data;
  const previous = savedText.get(node);
  if (previous && current === previous.rendered && previous.target === target) return;
  const original = previous && current === previous.rendered ? previous.original : current;
  const price = parsePrice(original);
  if (!price) return;
  const requestedTarget = target;
  if (price.currency === requestedTarget) {
    if (current !== original) node.data = original;
    clearTooltip(node);
    savedText.set(node, { original, rendered: original, target: requestedTarget });
    return;
  }
  const rate = await getRate(price.currency, requestedTarget);
  if (!rate || target !== requestedTarget || node.data !== current || !node.isConnected) return;
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  const rendered = leading + format(price.amount * rate.rate, requestedTarget) + trailing;
  if (current !== rendered) node.data = rendered;
  setTooltip(node, original, rate.date);
  savedText.set(node, { original, rendered, target: requestedTarget });
}

async function convertLabel(element: Element): Promise<void> {
  if (!element.isConnected || element.closest(ignored)) return;
  const current = element.getAttribute("aria-label");
  if (!current) return;
  const previous = savedLabels.get(element);
  if (previous && current === previous.rendered && previous.target === target) return;
  const original = previous && current === previous.rendered ? previous.original : current;
  const matches = findPrices(original);
  if (matches.length === 0) return;
  const requestedTarget = target;
  const replacements = await Promise.all(
    matches.map(async (match) => {
      const price = parsePrice(match.text)!;
      if (price.currency === requestedTarget) return match.text;
      const rate = await getRate(price.currency, requestedTarget);
      return rate ? format(price.amount * rate.rate, requestedTarget) : match.text;
    }),
  );
  if (
    target !== requestedTarget ||
    element.getAttribute("aria-label") !== current ||
    !element.isConnected
  )
    return;
  let rendered = "";
  let offset = 0;
  matches.forEach((match, index) => {
    rendered += original.slice(offset, match.start) + replacements[index];
    offset = match.end;
  });
  rendered += original.slice(offset);
  if (current !== rendered) element.setAttribute("aria-label", rendered);
  savedLabels.set(element, { original, rendered, target: requestedTarget });
}

function scan(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    void convertText(root as Text);
    return;
  }
  if (!(root instanceof Element)) return;
  if (root.matches(ignored)) return;
  if (root.hasAttribute("aria-label")) void convertLabel(root);
  for (const element of root.querySelectorAll("[aria-label]")) void convertLabel(element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) void convertText(walker.currentNode as Text);
}

function queue(root: Node): void {
  queued.add(root);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    for (const node of queued) scan(node);
    queued.clear();
  });
}

async function loadCurrency(): Promise<void> {
  const settings = await chrome.storage.sync.get("targetCurrency");
  target = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
  queue(document.body);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.targetCurrency) void loadCurrency();
});
new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === "characterData" || record.type === "attributes") queue(record.target);
    else for (const node of record.addedNodes) queue(node);
  }
}).observe(document.documentElement, {
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label"],
  subtree: true,
});
void loadCurrency();
