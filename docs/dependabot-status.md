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

- None.

## Notes

- A Dependabot security alert exists (`security/dependabot/2`); alerts can't be listed with the tooling used here, so check the repo Security tab.

## Deferred (not re-raised each pass)

- Ignored major versions are listed in `.github/dependabot.yml` with the reason for each.
- Re-check exemptions before their `effectiveUntil` date (2026-11-15) and drop them once upstream fixes ship.
