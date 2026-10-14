# Chrome Web Store — Steam Currency Converter

Last updated: 13 October 2026

## Listing and privacy

- Current version: **0.1.0**. These changes are part of the release draft; this document does not confirm a store submission.
- Name, descriptions, single purpose, permission justifications, and asset instructions: [store listing draft](docs/store-listing.md).
- Data use and privacy policy: [privacy policy](docs/privacy.md). Select a public policy URL in the Developer Dashboard before submission.
- Primary language: English. Category, publisher/contact details, visibility, and regions must be confirmed in the Developer Dashboard.
- Support: [GitHub issues](https://github.com/danielsitek/steam-currency-converter/issues).

## Graphics

| Asset            | File                                   | Dimensions     |
| ---------------- | -------------------------------------- | -------------- |
| Store icon       | `public/icons/icon128.png`             | 128 × 128 PNG  |
| Screenshot       | `store-assets/screenshot-1280x800.png` | 1280 × 800 PNG |
| Small promo tile | `store-assets/promo-440x280.png`       | 440 × 280 PNG  |

Review the screenshot against the packaged build. The settings page now disables the currency selector while loading and reports read failures. Refresh any future settings screenshot to match that behavior. Icon attribution is recorded in the listing draft and displayed in the extension.

## Release draft changes

The 0.1.0 draft now rejects conflicting currency markers, allows failed accessibility-label conversions to be retried on later scans, times out stalled rate requests after 10 seconds, validates cached rate records, and protects settings from delayed reads. Large page scans yield between batches and share rates throughout each scan.

## Verification before submission

Run `bun run check` and `bun run package`, then reload the unpacked `dist/` extension and refresh Steam pages. Verify currency changes on open pages, original-price tooltips, excluded purchase/account pages, and offline fallback. The ZIP contains only extension files; store graphics and this document are uploaded or consulted separately.
