import { DEFAULT_CURRENCY, isCurrency } from "./currency";

const select = document.querySelector<HTMLSelectElement>("#currency")!;
const status = document.querySelector<HTMLElement>("#status")!;

void chrome.storage.sync.get("targetCurrency").then((settings) => {
  select.value = isCurrency(settings.targetCurrency) ? settings.targetCurrency : DEFAULT_CURRENCY;
});

select.addEventListener("change", async () => {
  try {
    await chrome.storage.sync.set({ targetCurrency: select.value });
    status.textContent = "Uloženo. Otevřené stránky Steamu se aktualizují automaticky.";
  } catch {
    status.textContent = "Nastavení se nepodařilo uložit.";
  }
});
