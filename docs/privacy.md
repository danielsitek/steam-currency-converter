# Privacy policy — Steam Currency Converter

Last updated: 10 October 2026

Steam Currency Converter displays estimated converted prices on public Steam Store pages. It reads price text and accessibility labels on those pages locally in your browser. It does not send page content, page addresses, or browsing history to the developer or to the exchange-rate provider.

## Data used

- Your selected display currency is stored with `chrome.storage.sync`, so Chrome may synchronize it across browsers signed in to the same Chrome account.
- Exchange rates, their dates, and retrieval times are cached with `chrome.storage.local` for up to 12 hours before refresh. An older cached rate may be used if the rate service is unavailable.
- To retrieve a rate, the extension sends only the source and target currency codes to the Frankfurter API at `api.frankfurter.dev` over HTTPS. As with any web request, that service may receive standard connection information such as an IP address. See [Frankfurter](https://frankfurter.dev/) for information about its service.

The extension does not use analytics, advertising, or a developer-operated server, and the developer does not receive the data above from the extension. Chrome manages the extension storage; you can change the selected currency in the extension settings or remove the extension.

## Limited use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data accessed by the extension is used only to display converted prices and maintain the selected currency and exchange-rate cache.

For privacy questions, open an issue at [the project repository](https://github.com/danielsitek/steam-currency-converter/issues).
