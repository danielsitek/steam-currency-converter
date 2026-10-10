# Codacy integration

The CI workflow generates `coverage/lcov.info` and uploads it when the `CODACY_PROJECT_TOKEN` repository secret is available. This covers pushes to `main` and pull requests from branches in this repository. Pull requests from forks still run the local coverage gate, but cannot access the secret.

The [Codacy project](https://app.codacy.com/gh/danielsitek/steam-currency-converter) is connected, and the repository-scoped token is stored as a GitHub Actions secret. The upload and Codacy's pull request checks passed on [PR #1](https://github.com/danielsitek/steam-currency-converter/pull/1).

For future token rotation, create a new **repository** API token in Codacy and replace the `CODACY_PROJECT_TOKEN` GitHub Actions secret. Verify the next CI upload before revoking the old token.

Review Codacy's default analysis rules and coverage quality gate before making its status checks required for merges. Codacy needs coverage for subsequent commits on `main` to compare changes reliably. The token value is deliberately absent from the repository.
