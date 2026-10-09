# Dependabot status

_Last updated: 2026-10-09. Maintained during the Dependabot clean-up pass; update when the state changes._

## Configuration

- Ecosystems covered: npm (`/`), docker (`/`), github-actions (`/`), docker-compose (`/`).
- Grouping: npm development dependencies are grouped as `dev-dependencies`.
- Schedule: weekly.
- Ignore rules: `typescript` majors (ts-jest peer range); Docker `node` 25.x (non-LTS); docker-compose image majors (stateful services need a deliberate migration).

## State at last update

- Open Dependabot PRs: 0 (each merged or closed only after reading its checks).
- Default-branch CI: green at last check.
- Last full rescan: 2026-10-09. Checked open PRs (none), default-branch and scheduled CI, Dependabot update jobs, ecosystem coverage (no new manifests since 2026-10-08), Actions pins, exemption expiry dates and stray branches, plus three new dimensions: branch-protection required contexts against the check runs a PR actually produces, the repo's `security_and_analysis` settings, and check-run annotations on `main`. No required context is stale. The annotations showed `ubuntu-latest` moving to Ubuntu 26 from 2026-10-19, so every job is now pinned to `ubuntu-24.04` (see Notes). The full-history gitleaks scan was not repeated: the only commits since 2026-10-08 are docs and CI changes, each scanned by the push-run gitleaks job. Rescan cycle 2 (same day, after those pins merged) repeated every dimension and added one: each repo's `SECURITY.md` and whether GitHub private vulnerability reporting is enabled.
- Rescan cycle 3 (2026-10-09) repeated every dimension and added three: fork-PR workflow approval, whether `main` requires branches to be up to date before merging (`strict`), and the extra secret-scanning settings (non-provider patterns, validity checks). Live result: no open PRs; `security_and_analysis` shows secret scanning, push protection and Dependabot security updates enabled; private vulnerability reporting enabled; every required context is produced by the last merged PR's check runs and none is missing. The repo owner's token read 0 open Dependabot, code-scanning and secret-scanning alerts the same day (the first secret-scanning read; that permission was added to the token on 2026-10-09).

## Time-limited exemptions

- `osv-scanner.toml` (approved by the repo owner 2026-10-08, merged in #56): dev-only `sprintf-js` 1.0.3 (GHSA-hp3w-g68c-fv3c, moderate, no patched release), `ignoreUntil` 2026-11-15.

## Notes

- The `Dependency audit (npm audit, full tree)` job in `security.yml` actually runs `npm audit --omit=dev`, so it skips dev dependencies despite its name. A `dependency-scan` (osv-scanner) job now covers the whole lockfile.

- GitHub Actions pins refreshed by hand on 2026-10-08: `actions/checkout` v4 -> v7 and `actions/setup-node` v6 -> v7, matching the other repos. `actions/dependency-review-action` stays on v4 (no newer major could be confirmed from here).
- A manual OSV query of `package-lock.json` (2026-10-08) shows one dev-only moderate finding with no patched release: `sprintf-js` 1.0.3 (GHSA-hp3w-g68c-fv3c, affected through 1.1.3). `npm audit --omit=dev` in CI does not cover dev dependencies.
- `handlebars` 4.7.9 -> 4.7.10 in `package-lock.json` (2026-10-08, dev-only via the Jest coverage toolchain): three advisories published that day (GHSA-8r5x-fm3f-whwj and GHSA-p8wg-vrv2-v86f, both critical; GHSA-xw65-4hp5-5hc7) failed the `dependency-scan` job on PR #58. Fixed by a lockfile-only update; osv-scanner is clean again.
- Every workflow declares a top-level `permissions: contents: read` (added 2026-10-08, rescan cycle 3). Jobs that need more, such as CodeQL's `security-events: write`, declare it at job level.
- Merge policy (deliberate choice by the repo owner, 2026-10-08): every PR, major-version dependency bumps included, is merged as soon as all of its required checks are green, confirmed per PR. This repo is a code showcase with no business or sensitive dependency, so green checks are the only gate. Red, pending or conflicted PRs are fixed or closed instead.
- Every Linux job runs on `ubuntu-24.04` (pinned 2026-10-09; it is what `ubuntu-latest` resolved to). GitHub moves `ubuntu-latest` to Ubuntu 26 from 2026-10-19, and an unattended image change could turn every check red at once. Move to `ubuntu-26.04` deliberately, in one PR whose CI has run on it. Dependabot does not bump `runs-on` labels.
- `Dependency vulnerability scan (osv-scanner)` is a required check since 2026-10-09. It ran on every PR but was not required (found in that day's rescan), so under the merge policy a red scan would not have blocked a merge. Added by the repo owner through the API; the required-contexts list read before and after differs only by this entry.
- `SECURITY.md` added 2026-10-09 (rescan cycle 2: the repo had no security policy). It sends reporters to GitHub private vulnerability reporting, which is enabled here.
- Fork-PR workflow approval is `all_external_contributors` (set by the repo owner through the API on 2026-10-09, PUT 204, read back with the owner's token because the session's proxy blocks Actions paths).
- Secret scanning for non-provider patterns and validity checks stay off: the owner's PATCH on 2026-10-09 returned 200, but the read-back still shows both `disabled`, so GitHub does not offer them on this user-owned public repo. Not retried.

## Deferred (not re-raised each pass)

- Ignored major versions are listed in `.github/dependabot.yml` with the reason for each.
- Re-check exemptions before their `effectiveUntil` date (2026-11-15) and drop them once upstream fixes ship.
- Alerts read 2026-10-09 with the repo owner's PAT, run on their machine (Claude sessions still get 403: the proxy sends a GitHub App token instead of `GH_ALERTS_TOKEN`, even a PAT passed explicitly). No open Dependabot alerts (#2 `sprintf-js`, medium, is dismissed as tolerable risk to match the `osv-scanner.toml` exemption until 2026-11-15; #1 `braces`, high, is fixed). Code scanning #1 `js/cors-permissive-configuration` (`src/app.ts`) is addressed by sending a literal `*` instead of reflecting the caller's Origin when `CORS_ORIGIN` is `*` (credentials are never allowed, auth is the Authorization header); it shows as fixed after the CodeQL run on `main` (2026-10-09). No open alerts. Re-read 2026-10-09 after rescan cycle 2: code scanning #2 `js/cors-permissive-configuration` (`src/app.ts:28`) flags the literal `*` origin that resolved #1. It is intended: credentials are never allowed and auth is the `Authorization` header, so a cross-origin page gains nothing, and dropping `*` support would break `docker-compose.yml` and browser tools such as Apollo Sandbox. Dismissed as a false positive by the repo owner on 2026-10-09 (HTTP 200). No open Dependabot alerts.
