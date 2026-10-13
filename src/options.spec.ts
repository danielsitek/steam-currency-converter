import { beforeAll, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window();
const select = window.document.createElement("select");
select.id = "currency";
for (const currency of ["CZK", "GBP"]) {
  const option = window.document.createElement("option");
  option.value = currency;
  option.textContent = currency;
  select.append(option);
}

const status = window.document.createElement("p");
status.id = "status";
window.document.body.append(select, status);
let savedCurrency: string | undefined;
let rejectSave = false;
let readSettings: () => Promise<{ targetCurrency: string }> = async () => ({
  targetCurrency: "GBP",
});
let loadCurrency: () => Promise<void>;

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: window.document,
});
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    storage: {
      sync: {
        get() {
          return readSettings();
        },
        set(settings: { targetCurrency: string }) {
          if (rejectSave) {
            return Promise.reject(new Error("Storage unavailable"));
          }
          savedCurrency = settings.targetCurrency;
          return Promise.resolve();
        },
      },
    },
  },
});

beforeAll(async () => {
  ({ loadCurrency } = await import("./options"));
});

test("loads the saved target currency", async () => {
  await Bun.sleep(0);
  expect(select.value).toBe("GBP");
});

test("saves a selected currency and reports success", async () => {
  select.value = "CZK";
  select.dispatchEvent(new window.Event("change"));
  await Bun.sleep(0);

  expect(savedCurrency).toBe("CZK");
  expect(status.textContent).toBe("Saved. Open Steam pages will update automatically.");
});

test("reports a storage error", async () => {
  rejectSave = true;
  select.value = "GBP";
  select.dispatchEvent(new window.Event("change"));
  await Bun.sleep(0);

  expect(status.textContent).toBe("Could not save the setting.");
});

beforeEach(() => {
  rejectSave = false;
  savedCurrency = undefined;
  readSettings = async () => ({ targetCurrency: "GBP" });
});

test("disables changes until delayed settings finish loading", async () => {
  let respond!: (settings: { targetCurrency: string }) => void;
  readSettings = () =>
    new Promise((resolve) => {
      respond = resolve;
    });
  const loading = loadCurrency();
  expect(select.disabled).toBe(true);
  select.value = "CZK";
  select.dispatchEvent(new window.Event("change"));
  expect(savedCurrency).toBeUndefined();
  respond({ targetCurrency: "GBP" });
  await loading;
  expect(select.disabled).toBe(false);
  expect(select.value).toBe("GBP");
  select.value = "CZK";
  select.dispatchEvent(new window.Event("change"));
  await Bun.sleep(0);
  expect(savedCurrency).toBe("CZK");
  expect(select.value).toBe("CZK");
});

test("recovers from a settings read failure and allows saving", async () => {
  readSettings = async () => {
    throw new Error("Storage unavailable");
  };
  await loadCurrency();
  expect(select.value).toBe("CZK");
  expect(select.disabled).toBe(false);
  expect(status.textContent).toContain("Could not load");
  select.value = "GBP";
  select.dispatchEvent(new window.Event("change"));
  await Bun.sleep(0);
  expect(savedCurrency).toBe("GBP");
});
