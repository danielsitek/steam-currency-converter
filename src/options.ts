import { DEFAULT_CURRENCY, isCurrency } from "./currency";

const select = document.querySelector<HTMLSelectElement>("#currency")!;
const status = document.querySelector<HTMLElement>("#status")!;

export async function loadCurrency(): Promise<void> {
  select.disabled = true;
  try {
    const settings = await chrome.storage.sync.get("targetCurrency");
    select.value = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
  } catch {
    select.value = DEFAULT_CURRENCY;
    status.textContent = "Could not load the setting. Choose a currency to save it again.";
  } finally {
    select.disabled = false;
  }
}

void loadCurrency();

select.addEventListener("change", async () => {
  if (select.disabled) {
    return;
  }
  try {
    await chrome.storage.sync.set({ targetCurrency: select.value });
    status.textContent = "Saved. Open Steam pages will update automatically.";
  } catch {
    status.textContent = "Could not save the setting.";
  }
});
