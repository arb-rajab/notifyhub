# CLAUDE.md — notes for future sessions on this repo

Repo-specific ways to avoid burning tokens re-discovering things this
session already worked out. Read this before re-exploring the codebase
from scratch.

## Local database is already provisioned — don't re-derive a test strategy

This sandbox has PostgreSQL 16 installed via `apt` (not just the client —
the full server), and `sudo` is available. Don't spend tokens evaluating
mocking Prisma, using SQLite, or standing up Docker for tests.

```bash
sudo service postgresql start   # if not already running
```

Roles/databases already exist from this session (recreate identically if
a fresh container has none):

```bash
sudo -u postgres psql -c "CREATE USER notifyhub WITH PASSWORD 'notifyhub_dev_pw' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE notifyhub_dev OWNER notifyhub;"
sudo -u postgres psql -c "CREATE DATABASE notifyhub_test OWNER notifyhub;"
```

`tests/setup/env.ts` already defaults `DATABASE_URL` to the
`notifyhub_test` database with these exact credentials — you don't need
to set env vars to run `npm test` locally if this database exists.

## Tests must run with `--runInBand`

`npm test` already does this (see `package.json`). `tests/setup/db.ts`'s
`resetDatabase()` truncates shared tables between tests; running Jest's
default parallel workers against one database will produce flaky,
confusing cross-test failures that look like real bugs but aren't. Don't
spend a debugging pass on "why is this test flaky" before checking
whether `--runInBand` got dropped somewhere.

## Docker cannot be built or run in this sandbox

`docker ps` fails here (no daemon). Don't attempt `docker build` /
`docker compose up` locally and don't burn a turn diagnosing why it
"doesn't work" — it's a sandbox limitation, not a bug. Trust the `docker`
job in `.github/workflows/ci.yml` for actual build verification.

## Package versions in this repo's ecosystem, as of this session (Sept 2026)

The npm registry's `latest` dist-tag is **not always what you want** for
this stack right now:

- `@apollo/server` v4 is EOL (Jan 2026) — this repo is on **v5**. There is
  no bundled Express integration in v5; this repo uses
  `@as-integrations/express5` (which requires **Express 5**, also what
  this repo uses — Express 4 is now the `latest-4` dist-tag, not
  `latest`).
- `graphql-ws` v5's Node/`ws` adapter import path is
  **`graphql-ws/lib/use/ws`**, not the more commonly-documented
  `graphql-ws/use/ws` — check `node_modules/graphql-ws/package.json`'s
  `exports` map before assuming an import path from older docs/examples.
- The `prisma` (CLI) package's `latest` npm dist-tag pointed at an
  `8.0.0-rc.*` prerelease at the time of this session, while
  `@prisma/client`'s `latest` tag was a stable `7.x`. This repo pins both
  `prisma` and `@prisma/client` to the same matched stable `5.22.x` pair
  instead of trusting `latest`. **Before bumping either, check
  `npm view <pkg> dist-tags` for both and keep them matched** — a
  mismatched CLI/client major will fail confusingly, not obviously.

Don't re-run `npm view ... version` for every package "just to check" at
the start of a session — the pins in `package.json`/`package-lock.json`
are already deliberate and internally consistent; only re-check when
actually planning a version bump.

## A real bug already found and fixed — don't reintroduce it

`src/graphql/wsServer.ts` deliberately uses `new WebSocketServer({
noServer: true })` plus manual `'upgrade'` handling, **not** the simpler
`new WebSocketServer({ server: httpServer, path })`. The simpler form
double-closes on shutdown (see ADR-004 in
`docs/project-memory/07-decisions.md`) because `ws` attaches its own
`httpServer.on('close', ...)` listener that re-closes a `WebSocketServer`
`graphql-ws`'s `dispose()` already closed. If you "simplify" this file
back to the one-line form, you will reintroduce an intermittent shutdown
crash that only shows up under test teardown or real `SIGTERM` — budget a
debugging session to rediscover ADR-004 the hard way if you do.

Relatedly: `wsServer.dispose()` must be called **exactly once**, from the
`drainServer` plugin hook inside `apolloServer.stop()`
(`src/graphql/apolloServer.ts`). Don't add a second explicit
`wsServer.dispose()` call anywhere else (e.g. in a shutdown handler or a
test helper) — that's the double-dispose that caused the bug in the first
place.

## Where to look before adding APNs / notifyhub-ios support

Don't redesign the push path. Read ADR-005
(`docs/project-memory/07-decisions.md`) and
`src/services/push/{types,dispatcher,websocketChannel}.ts` first — a
future device-push channel is meant to be a new file implementing
`PushChannel`, registered in `src/services/push/dispatcher.ts`, and
nothing else changes.

## Things this session could not verify — don't assume they were checked

- GitHub-native Dependabot alerts (only `npm audit` was actually run —
  see `docs/project-memory/08-risk.md` R-7).
- Whether PostgreSQL is over-represented elsewhere in the portfolio (this
  session's GitHub access was scoped to this repo only — see
  `docs/project-memory/07-decisions.md` ADR-006 and `08-risk.md` R-1).

If either becomes checkable in a future session, do it once and update
the relevant doc rather than re-flagging it as unknown every time.
