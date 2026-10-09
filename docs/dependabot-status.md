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
- Pending owner action (found 2026-10-09): `Dependency vulnerability scan (osv-scanner)` runs on every PR but is not a required check (six other repos require theirs), so under the merge policy a red scan would not block a merge. Needs the Administration permission on the owner's token; escalation requested 2026-10-09.
- `SECURITY.md` added 2026-10-09 (rescan cycle 2: the repo had no security policy). It sends reporters to GitHub private vulnerability reporting, which is enabled here.

## Deferred (not re-raised each pass)

- Ignored major versions are listed in `.github/dependabot.yml` with the reason for each.
- Re-check exemptions before their `effectiveUntil` date (2026-11-15) and drop them once upstream fixes ship.
- Alerts read 2026-10-09 with the repo owner's PAT, run on their machine (Claude sessions still get 403: the proxy sends a GitHub App token instead of `GH_ALERTS_TOKEN`, even a PAT passed explicitly). No open Dependabot alerts (#2 `sprintf-js`, medium, is dismissed as tolerable risk to match the `osv-scanner.toml` exemption until 2026-11-15; #1 `braces`, high, is fixed). Code scanning #1 `js/cors-permissive-configuration` (`src/app.ts`) is addressed by sending a literal `*` instead of reflecting the caller's Origin when `CORS_ORIGIN` is `*` (credentials are never allowed, auth is the Authorization header); it shows as fixed after the CodeQL run on `main` (2026-10-09). No open alerts.
