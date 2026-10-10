# Steam Currency Converter

A lightweight Chrome extension (Manifest V3) that displays standalone prices on public Steam Store pages in your chosen currency. The default is CZK. It retrieves exchange rates from the [Frankfurter API](https://frankfurter.dev/) and caches them locally for 12 hours. If the service is unavailable, it uses the last cached rate. Hover over a converted price to see the original price and rate date.

## Development

Requirement: [Bun](https://bun.sh/).

```sh
bun install
bun run check
bun run package
```

`bun run check` verifies formatting, lint rules (including braces and a cyclomatic complexity limit of 10), types, `*.spec.ts` tests with at least 90% line and function coverage, and the production build. Coverage is saved to `coverage/lcov.info`. Run `bun run format` to apply formatting changes.

GitHub Actions runs the same gate on pull requests and pushes to `main`. See [Codacy setup](docs/codacy.md) for optional coverage reporting.

`bun run package` rebuilds the extension and creates `release/steam-currency-converter-<version>.zip` for Chrome Web Store upload. The ZIP contains only the generated extension files, with `manifest.json` at its root. See the [store listing draft](docs/store-listing.md) and [privacy policy](docs/privacy.md) when preparing a release.

The build creates `dist/` with plain JavaScript, HTML, CSS, and the manifest. In Chrome, open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `dist/`. Change the target currency by clicking the extension icon or opening its settings page.

The extension finds standalone price text and prices in `aria-label` attributes across public `store.steampowered.com` pages, including the home page, game details, and search results. It does not rely on Steam's CSS classes and preserves the surrounding HTML in recommendation cards and sale widgets. It does not run in the cart, checkout, account, sign-in, or purchase pages. It recognizes EUR, USD, GBP, CZK, PLN, and CHF as source currencies; a bare `$` is treated as USD. Converted prices are estimates, not the amounts charged by Steam or your bank.
