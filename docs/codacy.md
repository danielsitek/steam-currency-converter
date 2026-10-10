# Codacy setup

The CI workflow already generates `coverage/lcov.info` and uploads it on pushes to `main` when the `CODACY_PROJECT_TOKEN` repository secret is present. Pull requests still run the local coverage gate without a secret.

To activate Codacy:

1. Add `danielsitek/steam-currency-converter` to Codacy and verify its GitHub access scope.
2. Create a **repository** API token in Codacy. Store it only as the GitHub Actions repository secret `CODACY_PROJECT_TOKEN`.
3. Push a commit to `main`. Check that the CI upload step succeeds and Codacy processes its coverage report. Codacy needs coverage for subsequent commits to compare changes reliably.
4. Review Codacy's default analysis rules and coverage quality gate before enabling its GitHub status check as a required merge check.

The token is deliberately absent from the repository. Until the Codacy project and secret exist, CI skips the upload step.
