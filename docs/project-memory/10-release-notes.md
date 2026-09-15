# Release Notes

## v0.1.0 — initial build (this session)

First implementation of notifyhub: a Node.js + Express service exposing a
single GraphQL API (queries, mutations, and real-time subscriptions over
`graphql-ws`) for a channel/notification domain.

**Added**

- Auth: register/login, bcrypt password hashing, JWT access tokens shared
  across HTTP and WebSocket transports.
- Channels: create, list (with search), subscribe/unsubscribe, ownership
  rules.
- Notifications: publish (subscriber-only), query recent history,
  real-time delivery via the `notificationReceived` GraphQL subscription.
- A `PushChannel`/`NotificationDispatcher` abstraction designed for a
  future APNs delivery channel (notifyhub-ios) without touching the
  existing WebSocket path — see ADR-005.
- PostgreSQL persistence via Prisma, with a committed initial migration.
- Security hardening: helmet, CORS allowlist, per-route rate limiting,
  GraphQL query depth limiting, machine-readable error codes.
- Docker: multi-stage `Dockerfile` (non-root runtime user) and
  `docker-compose.yml` (Postgres + API).
- CI: GitHub Actions — lint/format/typecheck, tests against a real
  Postgres service container, production build, and a Docker image build
  check.
- Dependabot configured for npm, Docker, and GitHub Actions ecosystems.
- Full `docs/project-memory/` SDLC document set (this set).

**Verified in this session**

- `npm run lint`, `npm run typecheck`, `npm run build` all clean.
- 26/26 automated tests passing (7 suites) against a real local
  PostgreSQL 16 instance, including a genuine end-to-end WebSocket
  subscription/push test.
- `npm audit`: 0 vulnerabilities.
- Compiled server smoke-tested: `/healthz` and a live `channels` GraphQL
  query both verified over HTTP against the built (`dist/`) output.

**Known limitations at release**

- Docker image build was not executed in this sandbox (no Docker daemon
  available) — first real verification happens in CI. See
  [06-ops.md](./06-ops.md) and [08-risk.md](./08-risk.md) R-5.
- GitHub-native Dependabot alerts could not be enumerated by this
  session's tooling; only `npm audit` was directly verified. See
  [08-risk.md](./08-risk.md) R-7.
- No APNs/device-push implementation (explicitly out of scope — tracked
  for the notifyhub-ios companion repo).
