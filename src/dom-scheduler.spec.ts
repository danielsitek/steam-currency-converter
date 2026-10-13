import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { uniqueScanRoots, yieldToBrowser } from "./dom-scheduler";

const document = new Window().document as unknown as Document;

test("scans connected ancestors once and drops nested or detached roots", () => {
  const parent = document.createElement("div");
  const child = document.createElement("span");
  child.textContent = "€19.99";
  parent.append(child);
  document.body.append(parent);
  const detached = document.createElement("div");
  expect(uniqueScanRoots(new Set([child, child.firstChild!, parent, detached]))).toEqual([parent]);
});

test("uses the browser scheduler when available and a timer otherwise", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
  let yielded = false;
  try {
    Object.defineProperty(globalThis, "scheduler", {
      configurable: true,
      value: {
        async yield() {
          yielded = true;
        },
      },
    });
    await yieldToBrowser();
    expect(yielded).toBe(true);
    Object.defineProperty(globalThis, "scheduler", { configurable: true, value: undefined });
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);
    await yieldToBrowser();
    expect(timerRan).toBe(true);
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "scheduler", previous);
    } else {
      Reflect.deleteProperty(globalThis, "scheduler");
    }
  }
});
