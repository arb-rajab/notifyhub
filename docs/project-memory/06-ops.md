# Operations

## Running locally without Docker

```bash
cp .env.example .env               # fill in DATABASE_URL / JWT_SECRET
npx prisma migrate dev             # apply schema to your Postgres instance
npm run dev                         # tsx watch, http://localhost:4000/graphql
```

## Running locally with Docker Compose

```bash
export JWT_SECRET=$(openssl rand -base64 48)
docker compose up --build
```

This starts a `postgres:16-alpine` service plus the `api` service (built
from the `runtime` target of `Dockerfile`); the `api` container runs
`prisma migrate deploy` before starting the server, so migrations apply
automatically on boot against the compose-managed database.

## Health & shutdown

- `GET /healthz` returns `{"status": "ok"}` once the process is accepting
  traffic; wired into the Docker image's `HEALTHCHECK`.
- `SIGTERM`/`SIGINT` trigger a graceful shutdown in `src/index.ts`:
  `apolloServer.stop()` (which drains both HTTP keep-alive connections and
  the WebSocket server via the `drainServer` plugin hook — see ADR-004) →
  `httpServer.close()` → `prisma.$disconnect()` → exit.

## Configuration reference

All configuration is environment variables, validated at startup by
`src/config/env.ts` (Zod). See `.env.example` for the full list with
inline documentation. Nothing is read from a config file.

| Variable         | Required                   | Notes                                        |
| ---------------- | -------------------------- | -------------------------------------------- |
| `DATABASE_URL`   | yes                        | Postgres connection string, Prisma format    |
| `JWT_SECRET`     | yes                        | ≥16 chars; sign/verify key for access tokens |
| `JWT_EXPIRES_IN` | no (default `15m`)         | any `jsonwebtoken` duration string           |
| `PORT`           | no (default `4000`)        |                                              |
| `CORS_ORIGIN`    | no (default `*`)           | comma-separated list of allowed origins      |
| `NODE_ENV`       | no (default `development`) | `development` \| `test` \| `production`      |

## Database migrations

Schema changes go through Prisma migrations (`prisma/migrations/`), never
hand-edited SQL against a running database:

```bash
npx prisma migrate dev --name <description>   # dev: create + apply
npx prisma migrate deploy                       # CI/prod: apply only, no drift check
```

## Logging

`pino` (JSON in production, `pino-pretty` in development), silent in the
test environment to keep test output readable. No request bodies or
tokens are logged.

## Sandbox limitations encountered in this session (permanent record)

- **No Docker daemon available in this sandbox.** `docker build` /
  `docker compose up` were written and reviewed for correctness but could
  not actually be executed or verified in this environment (`docker ps`
  fails with "cannot connect to the Docker daemon"). The `docker` job in
  `.github/workflows/ci.yml` builds the image on every PR/push and is the
  first real verification of the Dockerfile — check its status before
  trusting the image builds clean. This is a sandbox limitation, not a
  known defect.
- **PostgreSQL was available locally** (via `apt`, with `sudo`), so unlike
  Docker, the database layer and every test in this session _were_
  verified against a real Postgres 16 server, not mocked or skipped.
- **No live cloud/registry push was attempted or is in scope** — there is
  no deployment target configured for notifyhub in this session; CI builds
  the image but does not push it anywhere.
