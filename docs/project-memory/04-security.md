# Security

## Authentication

- Passwords are hashed with `bcryptjs` at 12 salt rounds
  (`src/auth/password.ts`); the plaintext password never reaches storage
  or logs.
- Access tokens are JWTs (`jsonwebtoken`, HS256, signed with `JWT_SECRET`)
  carrying `sub` (user id), `email`, and `role`, expiring by default in 15
  minutes (`JWT_EXPIRES_IN`). See ADR-003 for why JWT over sessions, and
  its accepted tradeoff (no server-side revocation).
- The same verification path (`verifyAccessToken`) authenticates both
  transports: an HTTP `Authorization: Bearer <token>` header, and a
  WebSocket `connectionParams.authorization` value sent in the
  `graphql-ws` `connection_init` message. There is one code path for
  "who is the caller", not two.
- `env.ts` refuses to boot if `JWT_SECRET` is unset or under 16 characters
  (Zod schema), so the service cannot silently run with a weak or missing
  signing key.

## Authorization

Enforced in the service layer (not just the resolver layer), so the rule
holds regardless of which GraphQL operation reaches it:

- Only a channel's subscribers may publish notifications to it
  (`NotificationService.publish`).
- Only a channel's subscribers may open a `notificationReceived`
  subscription for it, checked before the async iterator is returned
  (`notificationResolvers.Subscription.notificationReceived.subscribe`) —
  an unauthorized client never receives so much as a connection ack for
  that operation, let alone a payload.
- A channel's owner cannot unsubscribe from their own channel
  (`ChannelService.unsubscribe`), preventing an orphaned channel with no
  subscribers/owner relationship.
- Errors carry a machine-readable `extensions.code`
  (`UNAUTHENTICATED` / `FORBIDDEN` / `NOT_FOUND` / `BAD_USER_INPUT` /
  `CONFLICT`, see `src/utils/errors.ts`) so clients can distinguish "you're
  not logged in" from "you're logged in but not allowed" without parsing
  message strings.

## Transport & HTTP hardening

- `helmet()` sets standard security headers (CSP defaults, no
  `X-Powered-By`, etc.) on every HTTP response.
- `cors()` restricts browser origins to the comma-separated
  `CORS_ORIGIN` env var; the default in `.env.example` is a single local
  dev origin, not `*`.
- `express-rate-limit` caps the `/graphql` HTTP endpoint at 300 requests
  per client per minute, mitigating basic request flooding.
- The WebSocket transport bypasses Express middleware entirely (manual
  `upgrade` handling, see ADR-004), so `express-rate-limit` doesn't reach
  it. `src/graphql/wsRateLimiter.ts` instead enforces, at the upgrade
  layer in `wsServer.ts`: a per-client sliding-window limit on connection
  attempts (default 20 per 60s, keyed by `socket.remoteAddress`) and a
  global concurrent-connection cap (default 1000), rejecting with
  `429`/`503` before the connection is accepted. Per-message rate
  limiting after a subscription is established is still not implemented;
  see [08-risk.md](./08-risk.md) R-3.
- `graphql-depth-limit` rejects any query/mutation/subscription document
  nested deeper than 10 levels, before execution — the standard mitigation
  for maliciously nested GraphQL queries designed to cause exponential
  resolver fan-out.

## Input validation

- `env.ts` validates all process environment variables through a Zod
  schema at startup; an invalid or missing required variable fails fast
  instead of running with `undefined` config.
- Service-layer validation (email format, password length ≥ 8, non-empty
  names/titles/bodies, slug format `^[a-z0-9]+(-[a-z0-9]+)*$`) happens in
  `UserService`, `ChannelService`, `NotificationService` before any
  database write.
- GraphQL's own type system rejects malformed shapes (wrong types, missing
  required fields) before a resolver ever runs.

## Secrets management

- No secret is committed to the repository. `.env` is gitignored;
  `.env.example` documents every variable with a placeholder and, for
  `JWT_SECRET`, the exact command to generate a real one
  (`openssl rand -base64 48`).
- Local development and CI both provide `JWT_SECRET` and `DATABASE_URL` as
  environment variables from outside the repo (a local `.env` file in dev,
  workflow `env:` in CI — see `.github/workflows/ci.yml`). Production
  deployment is expected to inject these from a real secrets manager
  (documented as an operational requirement in
  [06-ops.md](./06-ops.md), not implemented here since no cloud target is
  in scope for this repo).
- `docker-compose.yml`'s `api` service requires `JWT_SECRET` to be set in
  the host environment (`${JWT_SECRET:?...}` — compose refuses to start
  without it, rather than silently defaulting to an insecure value).

## Dependency vulnerabilities

- `npm audit` reports **0 vulnerabilities** as of the last run in this
  session (all dependencies pinned to current stable majors: Apollo Server
  5, Express 5, TypeScript 5.9, etc. — see ADR-006).
- `.github/dependabot.yml` is configured for weekly npm, Docker base
  image, and GitHub Actions update scans going forward.
- **Explicit limitation:** this session's tooling exposes `npm audit`
  (dependency-tree vulnerability scanning) but not GitHub's own
  Dependabot alerts API/UI — there was no tool available to enumerate
  repository-level Dependabot alerts directly. `npm audit` is the actual
  verification performed; treat "GitHub Dependabot alerts" as unverified
  by this session rather than assumed clear, until checked directly in the
  GitHub UI or via `gh api /repos/.../dependabot/alerts` by someone with
  that access.

## Container security

- The runtime Docker image runs as a non-root user (`notifyhub`, uid/gid
  1001), created explicitly in the final stage.
- Multi-stage build: the `deps`/`build` stages (which include the full
  devDependency tree and source) are discarded; only `dist/`,
  `node_modules` pruned to production dependencies, and `prisma/` reach
  the runtime image.
- Base image is `node:22-bookworm-slim`, pinned to a Debian release rather
  than a rolling `latest` tag.
