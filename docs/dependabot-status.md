# Dependabot status

_Last updated: 2026-10-08. Maintained during the Dependabot clean-up pass; update when the state changes._

## Configuration

- Ecosystems covered: npm (`/`), docker (`/`), github-actions (`/`), docker-compose (`/`).
- Grouping: npm development dependencies are grouped as `dev-dependencies`.
- Schedule: weekly.
- Ignore rules: `typescript` majors (ts-jest peer range); Docker `node` 25.x (non-LTS); docker-compose image majors (stateful services need a deliberate migration).

## State at last update

- Open Dependabot PRs: 0 (each merged or closed only after reading its checks).
- Default-branch CI: green at last check.

## Time-limited exemptions

- `osv-scanner.toml` (approved by the repo owner 2026-10-08, merged in #56): dev-only `sprintf-js` 1.0.3 (GHSA-hp3w-g68c-fv3c, moderate, no patched release), `ignoreUntil` 2026-11-15.

## Notes

- The `Dependency audit (npm audit, full tree)` job in `security.yml` actually runs `npm audit --omit=dev`, so it skips dev dependencies despite its name. A `dependency-scan` (osv-scanner) job now covers the whole lockfile.

- GitHub Actions pins refreshed by hand on 2026-10-08: `actions/checkout` v4 -> v7 and `actions/setup-node` v6 -> v7, matching the other repos. `actions/dependency-review-action` stays on v4 (no newer major could be confirmed from here).
- A manual OSV query of `package-lock.json` (2026-10-08) shows one dev-only moderate finding with no patched release: `sprintf-js` 1.0.3 (GHSA-hp3w-g68c-fv3c, affected through 1.1.3). `npm audit --omit=dev` in CI does not cover dev dependencies.
- A Dependabot security alert exists (`security/dependabot/2`); alerts can't be listed with the tooling used here, so check the repo Security tab.

## Deferred (not re-raised each pass)

- Ignored major versions are listed in `.github/dependabot.yml` with the reason for each.
- Re-check exemptions before their `effectiveUntil` date (2026-11-15) and drop them once upstream fixes ship.
