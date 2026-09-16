# Testing

## Philosophy

Tests run against a real PostgreSQL instance, not mocks of Prisma, and the
real-time path is tested by opening an actual WebSocket connection through
the actual `graphql-ws` protocol implementation and asserting a real push
arrives — not by unit-testing the `PubSub` or `NotificationDispatcher` in
isolation. The one thing this domain exists to prove (a published
notification reaches a live subscriber in real time) is exactly the thing
that gets an end-to-end test.

## Layout

```
tests/
  unit/            - pure functions: password hashing, JWT sign/verify, header parsing
  integration/      - full stack: real HTTP server + real Postgres, via supertest / a real ws client
  setup/
    env.ts           - test environment variables (jest `setupFiles`)
    db.ts             - resetDatabase() / disconnectDatabase()
    testServer.ts      - boots a full notifyhub instance on an ephemeral port
    graphqlClient.ts    - thin supertest-based GraphQL HTTP helper
```

## What's covered

- **`tests/unit/`** — password hashing round-trip and mismatch, JWT
  sign/verify round-trip plus malformed/tampered-token rejection, and
  bearer-token/connection-params extraction (including the
  case-insensitive `authorization`/`Authorization` key).
- **`tests/integration/auth.test.ts`** — register → token issued → `me`
  resolves; duplicate email is rejected (`CONFLICT`); login
  succeeds/fails correctly; unauthenticated `me` returns `null` rather
  than erroring.
- **`tests/integration/channels.test.ts`** — creating a channel requires
  auth; the creator is auto-subscribed; duplicate slugs are rejected;
  subscribe/unsubscribe update `isSubscribed`/`subscriberCount`; an owner
  cannot unsubscribe from their own channel; search filtering works.
- **`tests/integration/notifications.test.ts`** — publishing requires the
  caller to be subscribed to the channel; published notifications are
  listed back newest-first.
- **`tests/integration/subscription.test.ts`** (the genuine real-time
  test) — a subscriber opens a real `graphql-ws` client over a real
  WebSocket to a running server instance, subscribes to
  `notificationReceived(channelSlug: ...)`, and a _second_ HTTP client
  then runs the `publishNotification` mutation; the test asserts the
  WebSocket client receives the exact notification payload it expects.
  Two negative cases are covered the same way: a user who is not
  subscribed to the channel is rejected when opening the subscription,
  and an unauthenticated connection is rejected too — both assertions are
  made by awaiting the same live protocol exchange, not a resolver unit
  test.
- **`tests/integration/deviceTokens.test.ts`** —
  register/rotate/revoke/list `DeviceToken` mutations: auth required;
  registering the same token under a different account reassigns it
  (device reinstalled under a new user); rotate/revoke require the
  caller to own the token being changed.
- **`tests/unit/apnsJwtProvider.test.ts`** — the ES256 provider-auth JWT
  carries the right `kid`/`iss`, is reused within Apple's ~1h window, and
  is re-minted once that window passes (a fresh EC key pair is generated
  at test-run time via Node's `crypto` — no key is committed anywhere).
- **`tests/unit/apnsHttpClient.test.ts`** — see ADR-008 for why this is
  a protocol-level test against a real local `http2` server rather than
  a mock: asserts the actual request shape (`:path`, `apns-topic`,
  `authorization`, JSON payload), exponential retry/backoff on a
  transient 503 that later recovers, giving up after `maxRetries` on a
  persistent 500, and `ApnsTokenInvalidError` (no retry) specifically on
  400 `BadDeviceToken`/410 `Unregistered` but not on other 4xx reasons.
- **`tests/integration/apnsChannel.test.ts`** — `ApnsPushChannel`
  no-ops when unconfigured; sends only to a channel's subscribers' active
  (non-revoked) device tokens, with the expected payload shape including
  the `notificationId`/`channelSlug` deep-link keys; marks a `DeviceToken`
  `revokedAt` when the (test-double) client reports it invalid; never
  throws when a subscriber has no device tokens.

## Running tests

```bash
npm test                # jest --runInBand, against DATABASE_URL from tests/setup/env.ts
```

`tests/setup/env.ts` defaults `DATABASE_URL` to
`postgresql://notifyhub:notifyhub_dev_pw@localhost:5432/notifyhub_test`,
matching the local Postgres role/database created for this session (see
[06-ops.md](./06-ops.md)). CI overrides this with its own Postgres service
container's credentials via workflow `env:`. `--runInBand` is used
deliberately: `tests/setup/db.ts`'s `resetDatabase()` truncates shared
tables between tests, so test files are not safe to run with Jest's
default parallel workers against the same database.

## Verified in this session

All 7 suites / 26 tests pass locally against a real, freshly migrated
PostgreSQL 16 instance (`sudo service postgresql start`, migrations
applied via `prisma migrate deploy`). `npm run typecheck`,
`npm run lint`, and `npm run build` are all clean. `npm run build`'s
output was smoke-tested by starting the compiled server and hitting
`/healthz` and a live `channels` query over HTTP.

## Verified in the APNs/device-token follow-up session

All 11 suites / 46 tests pass locally (the original 7/26 plus 4 new
suites / 20 new tests for device tokens and APNs). `npm run
format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, and
`npm audit` (0 vulnerabilities) are all clean. See ADR-008 for why the
APNs tests are protocol-level (a real local `http2` server) rather than
either mocks or live Apple delivery — the latter is a permanent,
by-design gap (see [08-risk.md](./08-risk.md) R-8), not something a
future session should try to close in this sandbox.

## Known gaps

- No load/soak test for a large number of concurrent WebSocket
  subscribers (see [08-risk.md](./08-risk.md) R-3).
- No test asserts on `graphql-depth-limit` actually rejecting an
  over-depth query, or on the rate limiter's 429 behavior — both are
  configured but not directly exercised by an automated test yet (see
  [09-backlog.md](./09-backlog.md)).
- Docker image build/run was not verified inside this sandbox (no Docker
  daemon available — see [06-ops.md](./06-ops.md) for the exact
  limitation and what CI does instead).
