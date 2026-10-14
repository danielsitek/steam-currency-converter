import { SCAN_TIME_BUDGET_MS, yieldToBrowser } from "./dom-scheduler";
import { findPrices, parsePrice, type Currency, type PriceMatch } from "./currency";

export type Rate = { rate: number; date: string };
const MAX_SCAN_BATCH_NODES = 100;
type Saved = { original: string; rendered: string; target: Currency };
type GetRate = (from: Currency, to: Currency) => Promise<Rate | null>;

const ignored = "script, style, noscript, textarea, option, [contenteditable]";

function originalValue(current: string, previous: Saved | undefined): string {
  return previous?.rendered === current ? previous.original : current;
}

function alreadyConverted(current: string, previous: Saved | undefined, target: Currency): boolean {
  return previous?.rendered === current && previous.target === target;
}

export function createPriceConverter(getRate: GetRate, getTarget: () => Currency) {
  const savedText = new WeakMap<Text, Saved>();
  const savedLabels = new WeakMap<Element, Saved>();
  const addedTitles = new WeakMap<HTMLElement, string>();
  const formatters = new Map<string, Intl.NumberFormat>();

  function format(amount: number, currency: Currency): string {
    const locale = navigator.language || "cs-CZ";
    const key = `${locale}:${currency}`;
    let formatter = formatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
      formatters.set(key, formatter);
    }
    return formatter.format(amount);
  }

  function setTooltip(node: Text, original: string, date: string): void {
    const element = node.parentElement;
    if (!element) {
      return;
    }
    const previous = addedTitles.get(element);
    if (element.hasAttribute("title") && element.title !== previous) {
      return;
    }
    const title = `${original.trim()} · estimated exchange rate from ${date}`;
    element.title = title;
    addedTitles.set(element, title);
  }

  function clearTooltip(node: Text): void {
    const element = node.parentElement;
    if (!element) {
      return;
    }
    const previous = addedTitles.get(element);
    if (previous && element.title === previous) {
      element.removeAttribute("title");
    }
    addedTitles.delete(element);
  }

  function restoreOriginalText(node: Text, original: string, target: Currency): void {
    if (node.data !== original) {
      node.data = original;
    }
    clearTooltip(node);
    savedText.set(node, { original, rendered: original, target });
  }

  function textChangedWhileWaiting(node: Text, current: string, target: Currency): boolean {
    return document.hidden || getTarget() !== target || node.data !== current || !node.isConnected;
  }

  function keepOriginalWhitespace(original: string, converted: string): string {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    return leading + converted + trailing;
  }

  async function convertText(node: Text, lookup: GetRate): Promise<void> {
    if (!node.isConnected || node.parentElement?.closest(ignored)) {
      return;
    }
    const current = node.data;
    const previous = savedText.get(node);
    const target = getTarget();
    if (alreadyConverted(current, previous, target)) {
      return;
    }
    const original = originalValue(current, previous);
    const price = parsePrice(original);
    if (!price) {
      return;
    }

    if (price.currency === target) {
      restoreOriginalText(node, original, target);
      return;
    }

    const rate = await lookup(price.currency, target);
    if (!rate || textChangedWhileWaiting(node, current, target)) {
      return;
    }
    const rendered = keepOriginalWhitespace(original, format(price.amount * rate.rate, target));
    if (current !== rendered) {
      node.data = rendered;
    }
    setTooltip(node, original, rate.date);
    savedText.set(node, { original, rendered, target });
  }

  async function convertMatches(
    matches: PriceMatch[],
    target: Currency,
    lookup: GetRate,
  ): Promise<Array<string | null>> {
    return Promise.all(
      matches.map(async ({ price, text }) => {
        if (price.currency === target) {
          return text;
        }
        const rate = await lookup(price.currency, target);
        return rate ? format(price.amount * rate.rate, target) : null;
      }),
    );
  }

  function labelChangedWhileWaiting(element: Element, current: string, target: Currency): boolean {
    return (
      document.hidden ||
      getTarget() !== target ||
      element.getAttribute("aria-label") !== current ||
      !element.isConnected
    );
  }

  function replaceMatches(original: string, matches: PriceMatch[], replacements: string[]): string {
    let rendered = "";
    let offset = 0;
    matches.forEach((match, index) => {
      rendered += original.slice(offset, match.start) + replacements[index];
      offset = match.end;
    });
    return rendered + original.slice(offset);
  }

  async function convertLabel(element: Element, lookup: GetRate): Promise<void> {
    if (!element.isConnected || element.closest(ignored)) {
      return;
    }
    const current = element.getAttribute("aria-label");
    if (!current) {
      return;
    }
    const previous = savedLabels.get(element);
    const target = getTarget();
    if (alreadyConverted(current, previous, target)) {
      return;
    }
    const original = originalValue(current, previous);
    const matches = findPrices(original);
    if (matches.length === 0) {
      return;
    }

    const replacements = await convertMatches(matches, target, lookup);
    if (!replacements.every((value): value is string => value !== null)) {
      return;
    }
    if (labelChangedWhileWaiting(element, current, target)) {
      return;
    }
    const rendered = replaceMatches(original, matches, replacements);
    if (current !== rendered) {
      element.setAttribute("aria-label", rendered);
    }
    savedLabels.set(element, { original, rendered, target });
  }

  async function convertNode(node: Node, lookup: GetRate): Promise<void> {
    if (node.nodeType === Node.TEXT_NODE) {
      await convertText(node as Text, lookup);
    } else if (node instanceof Element && node.hasAttribute("aria-label")) {
      await convertLabel(node, lookup);
    }
  }

  function scanRateLookup(): GetRate {
    const requests = new Map<string, Promise<Rate | null>>();
    return (from, to) => {
      const key = `${from}:${to}`;
      let request = requests.get(key);
      if (!request) {
        request = getRate(from, to);
        requests.set(key, request);
      }
      return request;
    };
  }

  function scanInterrupted(root: Node, target: Currency): boolean {
    return !root.isConnected || document.hidden || getTarget() !== target;
  }

  async function scan(root: Node): Promise<void> {
    const lookup = scanRateLookup();
    if (root.nodeType === Node.TEXT_NODE) {
      await convertText(root as Text, lookup);
      return;
    }
    if (!(root instanceof Element) || root.closest(ignored)) {
      return;
    }
    const target = getTarget();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node instanceof Element && node.matches(ignored)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node: Node | null = root;
    let batch: Promise<void>[] = [];
    let started = performance.now();
    while (node) {
      if (scanInterrupted(root, target)) {
        return;
      }
      if (!root.contains(node)) {
        walker.currentNode = root;
        node = root;
      }
      batch.push(convertNode(node, lookup));
      node = walker.nextNode();
      if (
        batch.length >= MAX_SCAN_BATCH_NODES ||
        performance.now() - started >= SCAN_TIME_BUDGET_MS
      ) {
        await Promise.all(batch);
        batch = [];
        await yieldToBrowser();
        started = performance.now();
      }
    }
    await Promise.all(batch);
  }

  return { scan };
}
