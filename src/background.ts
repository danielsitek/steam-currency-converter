import { isCurrency } from "./currency";
import { getRate } from "./rate-service";

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    message.type !== "getRate" ||
    !("from" in message) ||
    !("to" in message) ||
    !isCurrency(message.from) ||
    !isCurrency(message.to)
  ) {
    return false;
  }
  getRate(message.from, message.to)
    .then(({ rate, date }) => sendResponse({ rate, date }))
    .catch((error: unknown) =>
      sendResponse({ error: error instanceof Error ? error.message : "Exchange rate unavailable" }),
    );
  return true;
});
