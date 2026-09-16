# Architecture Decision Records

Format: Context → Decision → Consequences. Numbered chronologically;
superseding an earlier decision gets a new ADR that says so rather than
editing history.

---

## ADR-001: GraphQL as the entire API surface, not REST-plus-GraphQL

**Context.** notifyhub's purpose is to cover Node/Express and GraphQL
skill areas in one repo. A REST API with a bolted-on `/graphql` endpoint
for "the interesting part" would demonstrate GraphQL syntax but not
GraphQL as an API design discipline — resolvers, a real type graph,
field-level authorization.

**Decision.** Every operation (auth, channel management, notification
publish/read, real-time delivery) goes through one GraphQL schema. There
is no parallel REST surface except `GET /healthz`, which is
infrastructure, not domain API.

**Consequences.** Clients get one schema to introspect and one
authorization model to reason about. The cost is that simple operations
(like a health check consumers might expect at a REST-ish path) still go
through GraphQL's request/response envelope — accepted, since `/healthz`
covers the one case that matters (uptime probes) outside GraphQL.

---

## ADR-002: Real-time delivery is a GraphQL subscription over `graphql-ws`, not a separate WebSocket protocol

**Context.** Real-time push could be built as (a) a GraphQL subscription
using the schema's type system, sharing auth/validation with the rest of
the API, or (b) a hand-rolled WebSocket message protocol running
alongside the GraphQL API, decoupled from its schema and type safety.

**Decision.** (a). `notificationReceived(channelSlug: String!):
Notification!` is a first-class subscription field in the same schema as
every query and mutation, transported over `graphql-ws` implementing the
`graphql-transport-ws` protocol — the current standard successor to the
deprecated `subscriptions-transport-ws`.

**Consequences.** A client introspects one schema and gets the exact
shape of real-time events, the same field-level resolvers and error
format as everything else, and reuses the same auth token flow
(`connectionParams.authorization`, verified the same way as the HTTP
`Authorization` header — see ADR-003). The cost is operational: WebSocket
connections are stateful and don't horizontally scale as trivially as
stateless HTTP requests behind a load balancer; see ADR-005 for how that
is contained rather than solved in this session.

---

## ADR-003: JWT access tokens over server-side sessions

**Context.** Two transports (HTTP and WebSocket) both need to identify
the caller. A cookie-based session ties authentication to browser cookie
handling, which is awkward for a WebSocket `connection_init` handshake and
for non-browser clients (a future native iOS app, in particular — the
whole reason `notifyhub-ios` will exist). A stateless bearer token works
identically for both transports and for any client.

**Decision.** Signed, short-lived (15 min default) JWTs
(`src/auth/jwt.ts`), issued by `register`/`login`, sent as
`Authorization: Bearer <token>` over HTTP and as
`connectionParams.authorization` over the WebSocket handshake. No
server-side session store.

**Consequences.** Stateless verification (no database round-trip to check
a session), works identically for HTTP and WebSocket, and is a natural fit
for a future native mobile client that won't carry a browser's cookie jar.
The accepted tradeoff: a JWT cannot be revoked before it expires without
adding a server-side blocklist (not implemented — mitigated by the short
15-minute default expiry, not eliminated). Refresh tokens and revocation
are explicitly out of scope for this session (see
[02-requirements.md](./02-requirements.md) non-goals and
[09-backlog.md](./09-backlog.md)).

---

## ADR-004: Manual `'upgrade'` wiring (`noServer: true`) instead of `ws`'s built-in `server` binding

**Context.** `ws.WebSocketServer` can be constructed with
`{ server: httpServer, path }` and it will attach its own listeners to the
HTTP server, including one on the HTTP server's `'close'` event that
re-closes the WebSocket server. During test-suite teardown this collided
with `graphql-ws`'s own `useServer(...).dispose()` (invoked from Apollo's
`drainServer` plugin hook on `apolloServer.stop()`), which had _already_
closed the same `WebSocketServer` — producing an intermittent "The server
is not running" thrown from inside the `ws` library during the second,
redundant close. This is a real ordering bug, not a test-only artifact: it
would have fired identically during a real graceful shutdown in
production.

**Decision.** Construct `WebSocketServer({ noServer: true })` and handle
the HTTP server's `'upgrade'` event manually, checking `pathname ===
'/graphql'` and calling `wss.handleUpgrade` explicitly
(`src/graphql/wsServer.ts`). Only one thing (`wsServer.dispose()`, invoked
exactly once, from Apollo's `drainServer` hook) now owns closing the
WebSocket server.

**Consequences.** Slightly more code than the one-line `{ server }` form,
in exchange for a single, unambiguous owner of the WebSocket server's
lifecycle and a shutdown path that was actually exercised (every
integration test starts and cleanly tears down a full server instance —
see [05-testing.md](./05-testing.md)) rather than merely written.

---

## ADR-005: In-memory `PubSub` behind a `PushChannel` abstraction, not a distributed pub/sub from day one

**Context.** GraphQL subscriptions need an event bus connecting
`publishNotification` to every live `notificationReceived` subscription.
`graphql-subscriptions`' in-memory `PubSub` is sufficient for a
single-process deployment but does not fan events out across multiple
instances of the process. Reaching for Redis (or similar) immediately
would add a second datastore this session's scope does not otherwise
need, purely to solve a scaling problem notifyhub doesn't have yet. A
second, unrelated forward requirement does exist, though: the future
`notifyhub-ios` companion app needs real APNs device-push delivery added
to this same backend later, and that must not require re-architecting the
publish path when it lands.

**Decision.** Two separate concerns, deliberately kept separate:

1. **Transport fan-out** uses the in-memory `PubSub` today
   (`src/graphql/pubsub.ts`), accepted as a single-process constraint, with
   the swap-in point documented directly in that file (a
   `graphql-redis-subscriptions`-backed `PubSub` implements the same
   interface).
2. **Delivery-channel extensibility** is solved now, independent of
   (1)'s scaling question, via a `PushChannel` interface and a
   `NotificationDispatcher` that fans a published notification out to
   every registered channel concurrently
   (`src/services/push/{types,dispatcher,websocketChannel}.ts`). Today the
   dispatcher holds one channel (`WebSocketPushChannel`, which publishes to
   the `PubSub`). A future `ApnsPushChannel implements PushChannel` is
   added to the array in `src/services/push/dispatcher.ts` — nothing else
   in the codebase changes.

**Consequences.** notifyhub does not take on Redis (or another datastore)
without a concrete requirement for it, keeping this session's persistence
story to one deliberately-chosen database (ADR-006). Horizontally scaling
the WebSocket layer later requires exactly one change (swap the `PubSub`
implementation), isolated from the delivery-channel/APNs question, which
requires a different, also-isolated change (add a `PushChannel`). Neither
future change touches the GraphQL schema, resolvers, or existing channels.

---

## ADR-006: PostgreSQL + Prisma for persistence

**Context.** notifyhub needs relational integrity (users, channels, a
many-to-many subscription join, notifications referencing both) and real
migrations. The portfolio goal is distinct technology coverage across
repos — this session could not inspect sibling repos' stacks directly
(GitHub access in this session was scoped to `arb-rajab/notifyhub` only;
see the explicit limitation note in
[06-ops.md](./06-ops.md)/session notes), so this choice was made on the
domain's own merits rather than verified against what else the portfolio
already uses.

**Decision.** PostgreSQL, accessed through Prisma (schema-first models,
generated client, migration files committed to the repo). Prisma was
chosen over a raw `pg` driver for compile-time-checked queries and
first-class migration tooling; Postgres was chosen over a document store
because the domain (`User` ↔ `Subscription` ↔ `Channel` ↔ `Notification`)
is genuinely relational with real foreign keys and a real many-to-many
join, not a fit for a schemaless document model.

**Consequences.** Real migrations
(`prisma/migrations/20260915211154_init/`), a generated, typed client
(`@prisma/client`), and a schema that documents the domain on its own. The
explicit risk this decision carries for the portfolio as a whole — that
Postgres might already be over-represented elsewhere — is recorded in
[08-risk.md](./08-risk.md) R-1 for the coordinator session to check, rather
than silently assumed fine.

---

## ADR-007: TypeScript, strict mode, CommonJS module output

**Context.** A GraphQL API benefits disproportionately from static typing
— resolver argument/return shapes, Prisma's generated model types, and
the `GraphQLContext` threaded through every resolver are exactly the kind
of surface where a typo becomes a runtime 500 instead of a compile error
without it.

**Decision.** TypeScript with `strict: true` and
`noUncheckedIndexedAccess: true`. Module output is CommonJS
(`module`/`moduleResolution: "Node"`) rather than native ESM, specifically
to keep `ts-jest` interop simple — Jest's native-ESM support still carries
enough sharp edges (transform config, `--experimental-vm-modules`) that
it was judged not worth the friction for this repo's size.

**Consequences.** `tsc --noEmit` and `npm run build` both pass cleanly at
strict settings (verified in this session). `tsconfig.build.json` extends
the root config and restricts `rootDir`/`include` to `src/` so
`npm run build` doesn't try to emit compiled output for `tests/`, which is
type-checked (`tsc --noEmit` against the root config, which includes both
`src` and `tests`) but never built.

---

## ADR-008: A raw HTTP/2 APNs client (not `node-apn`/`@parse/node-apn`), and mock/protocol-level verification as the permanent proof of correctness

**Context.** ADR-005 deliberately designed the `PushChannel` interface so a
device-push channel could be added later without touching the publish path,
schema, or resolvers - this session is that follow-up, for the
`notifyhub-ios` companion app's real APNs delivery. Two separate questions
had to be answered: how to talk to APNs, and how to prove the result works
without ever holding real Apple credentials anywhere this session (or any
automated session) can reach.

**Decision, part 1 - transport.** `src/services/push/apns/httpClient.ts`
implements Apple's HTTP/2 provider API directly on top of Node's built-in
`http2` module, rather than adding `node-apn` or `@parse/node-apn` as a
dependency. Reasons:

- Apple's provider API is a small, well-documented HTTP/2 surface (one
  `POST /3/device/<token>` call, one bearer-JWT auth header, a handful of
  `apns-*` headers, and JSON error bodies with a `reason` field) - not
  large enough to justify an external dependency's transitive surface and
  update cadence for this repo's scope.
- Critically, `http2.connect()` picks plaintext HTTP/2 (h2c) or TLS HTTP/2
  (h2) based on the URL scheme. Pointing the same client at `http://` lets
  tests run a real local `http2.createServer()` and exercise the actual
  request/response wire format - not a mocked transport - while production
  use points the identical code at `https://api.sandbox.push.apple.com` or
  `https://api.push.apple.com`. A wrapper library would make this dual-mode
  testing harder, not easier, since most hide the HTTP/2 session entirely.
- ES256 JWT signing for the bearer token reuses the `jsonwebtoken` package
  already a dependency for ADR-003's access tokens (`src/services/push/
  apns/jwtProvider.ts`), rather than pulling in a second JWT library.

**Decision, part 2 - verification posture, permanent, not a gap to close
later.** Live APNs credentials (a `.p8` signing key, Key ID, Team ID, real
device tokens from a physical iOS device) must never sit in this repo or in
any CI-readable/automated environment. This mirrors the same posture the
portfolio's pulsewatch project takes for its own production push
credentials (its B-016): production push credentials are an operator-only
secret, deliberately kept out of anything a repository or its automation
can read, so that no compromised CI run or leaked repo secret can ever
reach a real APNs account. `ApnsPushChannel` and `loadApnsConfigFromEnv`
(`src/services/push/apns/config.ts`) are built around this: when the four
required env vars aren't present - the expected state in this repo and its
CI, always - the channel logs and no-ops rather than erroring, so
publishing a notification never fails because of an absent device-push
credential.

The accepted proof of correctness is therefore protocol-level and
behavioral, not live-delivery:

- `tests/unit/apnsHttpClient.test.ts` runs a real local `http2` server and
  asserts the actual request (`:path`, `apns-topic`, `authorization`,
  payload shape), retry/backoff behavior on 429/5xx, and that 400
  `BadDeviceToken`/410 `Unregistered` responses raise
  `ApnsTokenInvalidError` without retrying.
- `tests/integration/apnsChannel.test.ts` verifies the dispatch-side
  behavior (which subscribers' device tokens get a push, that a revoked
  token is skipped, that an APNs-reported invalid token gets marked
  `revokedAt` in the database) with a test double standing in for the
  already-protocol-tested HTTP client.

No test in this repo, and no session working on it, can verify an actual
push notification arriving on a physical device - that requires a real
Apple Developer account, a real `.p8` key, and a real device, none of
which can or should exist in this sandbox or its CI. This is recorded as a
**permanent** limitation (not a "TODO: verify later") in
[08-risk.md](./08-risk.md) R-8, exactly as pulsewatch-mobile documents its
equivalent gap.

**Consequences.** Adding APNs required zero changes to
`NotificationService.publish`, the GraphQL schema, or the WebSocket
channel - `ApnsPushChannel implements PushChannel` and one line in
`src/services/push/dispatcher.ts`'s channel array, exactly as ADR-005
predicted. The cost is that this repo can never claim "verified working
push delivery" from within itself; anyone needing that assurance must run
the app on a physical device with real credentials outside this sandbox,
by design.
