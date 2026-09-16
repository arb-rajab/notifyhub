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

## APNs / device-token work is done — read ADR-008 before touching it again

`src/services/push/apnsChannel.ts` + `src/services/push/apns/{config,
jwtProvider,httpClient,errors}.ts` is a real, tested `ApnsPushChannel
implements PushChannel`, wired into `src/services/push/dispatcher.ts`.
Device-token GraphQL mutations
(`registerDeviceToken`/`rotateDeviceToken`/`revokeDeviceToken`/
`myDeviceTokens`) already exist in
`src/graphql/{typeDefs,resolvers}/deviceToken.ts` +
`src/services/deviceTokenService.ts`. Don't re-derive this from ADR-005 —
read ADR-008 in `docs/project-memory/07-decisions.md` first.

- **The `DevicePlatform` enum only has `IOS` today.** Adding Android/FCM
  later means widening that enum and adding a second `PushChannel`, not
  restructuring `DeviceToken` — the model is already generic (token,
  platform, revokedAt) on purpose.
- **A brand-new container's `notifyhub_test` Postgres database will be
  missing the `device_tokens` table** even after recreating the
  `notifyhub`/`notifyhub_dev`/`notifyhub_test` roles/DBs from the section
  above — `prisma migrate dev` was only ever run by hand against
  `notifyhub_dev`. Run `DATABASE_URL=postgresql://notifyhub:notifyhub_dev_pw@localhost:5432/notifyhub_test?schema=public
  npx prisma migrate deploy` once before `npm test`, or you'll see a
  confusing "table `device_tokens` does not exist" error on every test
  file, not just device-token ones (because `tests/setup/db.ts`'s
  `resetDatabase()` touches it in every test's `beforeEach`).
- **Testing an HTTP/2 client without mocks:** `http2.connect()` picks
  plaintext h2c or TLS h2 based on the URL scheme, so
  `tests/unit/apnsHttpClient.test.ts` runs a real local
  `http2.createServer()` (plain `http://`) and points `ApnsHttpClient` at
  it — this is a real protocol-level test, not a mock, and is the pattern
  to reuse for any future raw-HTTP/2 client in this repo. Don't reach for
  `nock`/`jest.mock('http2')` instead; it would test less than this does
  for no less effort.
- **Never put real APNs credentials (`APNS_KEY_ID`, `APNS_TEAM_ID`,
  `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`) in this repo, `.env.example`,
  CI secrets, or any automated session's environment.** This is
  permanent by design (ADR-008), not a TODO — `loadApnsConfigFromEnv`
  returning `null` and `ApnsPushChannel` no-op'ing is the intended
  behavior everywhere except an operator's own machine. Don't "fix" the
  no-op by wiring in a real key to make a demo look more complete.
- **ES256 test keys:** don't hardcode a fabricated-looking PEM string for
  an EC key in a test — it won't be a valid key and will fail signing
  with a confusing error. Generate a real throwaway one at test-run time
  with `crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1'
  })` (see `tests/unit/apnsJwtProvider.test.ts` /
  `tests/unit/apnsHttpClient.test.ts`).

## Things this session could not verify — don't assume they were checked

- GitHub-native Dependabot alerts (only `npm audit` was actually run —
  see `docs/project-memory/08-risk.md` R-7).
- Whether PostgreSQL is over-represented elsewhere in the portfolio (this
  session's GitHub access was scoped to this repo only — see
  `docs/project-memory/07-decisions.md` ADR-006 and `08-risk.md` R-1).

If either becomes checkable in a future session, do it once and update
the relevant doc rather than re-flagging it as unknown every time.
