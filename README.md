# Steam Currency Converter

A lightweight Chrome extension (Manifest V3) that displays standalone prices on public Steam Store pages in your chosen currency. The default is CZK. It retrieves exchange rates from the [Frankfurter API](https://frankfurter.dev/) and caches them locally for 12 hours. If the service is unavailable, it uses the last cached rate. Hover over a converted price to see the original price and rate date.

## Development

Requirement: [Bun](https://bun.sh/).

```sh
bun install
bun run check
```

`bun run check` verifies formatting, lint rules (including braces and a cyclomatic complexity limit of 10), types, `*.spec.ts` tests, and the production build. Run `bun run format` to apply formatting changes.

The build creates `dist/` with plain JavaScript, HTML, CSS, and the manifest. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist/`. Change the target currency by clicking the extension icon or opening its settings page.

The extension finds standalone price text and prices in `aria-label` attributes across public `store.steampowered.com` pages, including the home page, game details, and search results. It does not rely on Steam's CSS classes and preserves the surrounding HTML in recommendation cards and sale widgets. It does not run in the cart, checkout, account, sign-in, or purchase pages. It recognizes EUR, USD, GBP, CZK, PLN, and CHF as source currencies; a bare `$` is treated as USD. Converted prices are estimates, not the amounts charged by Steam or your bank.
