import { findPrices, parsePrice, type Currency, type PriceMatch } from "./currency";

export type Rate = { rate: number; date: string };
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
    return getTarget() !== target || node.data !== current || !node.isConnected;
  }

  function keepOriginalWhitespace(original: string, converted: string): string {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    return leading + converted + trailing;
  }

  async function convertText(node: Text): Promise<void> {
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

    const rate = await getRate(price.currency, target);
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

  async function convertMatches(matches: PriceMatch[], target: Currency): Promise<string[]> {
    return Promise.all(
      matches.map(async ({ price, text }) => {
        if (price.currency === target) {
          return text;
        }
        const rate = await getRate(price.currency, target);
        return rate ? format(price.amount * rate.rate, target) : text;
      }),
    );
  }

  function labelChangedWhileWaiting(element: Element, current: string, target: Currency): boolean {
    return (
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

  async function convertLabel(element: Element): Promise<void> {
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

    const replacements = await convertMatches(matches, target);
    if (labelChangedWhileWaiting(element, current, target)) {
      return;
    }
    const rendered = replaceMatches(original, matches, replacements);
    if (current !== rendered) {
      element.setAttribute("aria-label", rendered);
    }
    savedLabels.set(element, { original, rendered, target });
  }

  function scan(root: Node): void {
    if (root.nodeType === Node.TEXT_NODE) {
      void convertText(root as Text);
      return;
    }
    if (!(root instanceof Element) || root.matches(ignored)) {
      return;
    }
    if (root.hasAttribute("aria-label")) {
      void convertLabel(root);
    }
    for (const element of root.querySelectorAll("[aria-label]")) {
      void convertLabel(element);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      void convertText(walker.currentNode as Text);
    }
  }

  return { scan };
}
