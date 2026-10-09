import { DEFAULT_CURRENCY, isCurrency, parsePrice, type Currency } from "./currency";

const selector = ".game_area_purchase .game_purchase_price, .game_area_purchase .discount_final_price, .game_area_purchase .discount_original_price";
type SavedPrice = { original: string; rendered: string; title: string | null; target: Currency };
const saved = new WeakMap<HTMLElement, SavedPrice>();
let target: Currency = DEFAULT_CURRENCY;
let scheduled = false;

async function convert(element: HTMLElement): Promise<void> {
  const current = element.textContent?.trim() || "";
  const previous = saved.get(element);
  if (previous && current === previous.rendered && previous.target === target) return;
  const original = previous && current === previous.rendered ? previous.original : current;
  const title = previous && current === previous.rendered ? previous.title : element.getAttribute("title");
  const price = parsePrice(original);
  if (!price) return;
  if (price.currency === target) {
    if (previous && current === previous.rendered && previous.original !== previous.rendered) {
      element.textContent = original;
      if (title === null) element.removeAttribute("title");
      else element.setAttribute("title", title);
      saved.set(element, { original, rendered: original, title, target });
    }
    return;
  }
  const targetAtRequest = target;
  const response: { rate?: number; date?: string; error?: string } = await chrome.runtime.sendMessage({ type: "getRate", from: price.currency, to: targetAtRequest });
  if (!response || typeof response.rate !== "number" || !Number.isFinite(response.rate) || response.rate <= 0) return;
  // Ignore responses for an older setting or a price that Steam changed meanwhile.
  if (target !== targetAtRequest || (element.textContent?.trim() || "") !== current) return;
  const rendered = new Intl.NumberFormat(navigator.language || "cs-CZ", { style: "currency", currency: targetAtRequest }).format(price.amount * response.rate);
  if (current !== rendered) element.textContent = rendered;
  element.title = `${original} · orientační kurz ${response.date || ""}`.trim();
  saved.set(element, { original, rendered, title, target: targetAtRequest });
}

function scan(): void {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) void convert(element);
}

function scheduleScan(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; scan(); });
}

async function loadCurrency(): Promise<void> {
  const settings = await chrome.storage.sync.get("targetCurrency");
  target = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
  scheduleScan();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.targetCurrency) void loadCurrency();
});
new MutationObserver(scheduleScan).observe(document.documentElement, { childList: true, characterData: true, subtree: true });
void loadCurrency();
