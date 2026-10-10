import { beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window();
window.document.body.innerHTML =
  '<select id="currency"><option value="CZK">CZK</option><option value="GBP">GBP</option></select><p id="status"></p>';
const select = window.document.querySelector("#currency") as unknown as HTMLSelectElement;
const status = window.document.querySelector("#status") as unknown as HTMLElement;
let savedCurrency: string | undefined;
let rejectSave = false;

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: window.document,
});
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    storage: {
      sync: {
        async get() {
          return { targetCurrency: "GBP" };
        },
        async set(settings: { targetCurrency: string }) {
          if (rejectSave) {
            throw new Error("Storage unavailable");
          }
          savedCurrency = settings.targetCurrency;
        },
      },
    },
  },
});

beforeAll(async () => {
  await import("./options");
});

test("loads the saved target currency", async () => {
  await Bun.sleep(0);
  expect(select.value).toBe("GBP");
});

test("saves a selected currency and reports success", async () => {
  select.value = "CZK";
  select.dispatchEvent(new window.Event("change") as unknown as Event);
  await Bun.sleep(0);

  expect(savedCurrency).toBe("CZK");
  expect(status.textContent).toBe("Saved. Open Steam pages will update automatically.");
});

test("reports a storage error", async () => {
  rejectSave = true;
  select.value = "GBP";
  select.dispatchEvent(new window.Event("change") as unknown as Event);
  await Bun.sleep(0);

  expect(status.textContent).toBe("Could not save the setting.");
});
