# Codacy setup

The CI workflow generates `coverage/lcov.info` and uploads it when the `CODACY_PROJECT_TOKEN` repository secret is available. This covers pushes to `main` and pull requests from branches in this repository. Pull requests from forks still run the local coverage gate, but cannot access the secret.

To activate Codacy:

1. Add `danielsitek/steam-currency-converter` to Codacy and verify its GitHub access scope.
2. Create a **repository** API token in Codacy. Store it only as the GitHub Actions repository secret `CODACY_PROJECT_TOKEN`.
3. Push a branch and open a pull request. Check that the CI upload step succeeds and Codacy processes its coverage report. Codacy needs coverage for subsequent commits on `main` to compare changes reliably.
4. Review Codacy's default analysis rules and coverage quality gate before enabling its GitHub status check as a required merge check.

The token is deliberately absent from the repository. Until the Codacy project and secret exist, CI skips the upload step.
