# notifyhub

A Node.js + Express service whose entire API is **GraphQL** — queries and
mutations for standard CRUD, and **GraphQL subscriptions over WebSocket**
(via `graphql-ws`) as the real-time delivery mechanism. Not a REST API
with a WebSocket bolted on the side: one schema, one auth model, one
transport pair (HTTP + WS) serving it.

**Domain:** a small notification service. Users create or subscribe to
**channels** (topics); any subscriber can **publish a notification** to a
channel they belong to, and every other live subscriber receives it in
real time over an open GraphQL subscription.

## Quick start

```bash
cp .env.example .env               # fill in DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev             # apply schema to Postgres
npm run dev                         # http://localhost:4000/graphql
```

Or with Docker Compose (starts Postgres + the API together):

```bash
export JWT_SECRET=$(openssl rand -base64 48)
docker compose up --build
```

## Example: subscribe to a channel in real time

```graphql
mutation {
  register(input: { email: "ada@example.com", password: "lovelace123", displayName: "Ada" }) {
    token
  }
}

mutation {
  createChannel(input: { slug: "incidents", name: "Incidents" }) {
    slug
  }
}

subscription {
  notificationReceived(channelSlug: "incidents") {
    id
    title
    body
    createdAt
  }
}

mutation {
  publishNotification(
    input: { channelSlug: "incidents", title: "DB failover", body: "Primary is down." }
  ) {
    id
  }
}
```

Run the subscription over a WebSocket client speaking the
`graphql-transport-ws` protocol (e.g. Apollo Sandbox, GraphiQL, or
`graphql-ws`'s own client) with `Authorization: Bearer <token>` passed as
a `connectionParams` value; the mutation runs over plain HTTP with the
same header. The subscriber receives the notification the instant it's
published.

## Project layout

```
src/
  graphql/     - schema, resolvers, Apollo Server + graphql-ws wiring, pubsub
  services/     - domain logic (users, channels, notifications, push dispatch)
  auth/          - JWT + bcrypt, shared across HTTP and WebSocket
  db/             - Prisma client
prisma/         - schema + migrations
tests/           - unit + integration (real Postgres, real WebSocket client)
docs/project-memory/ - architecture, security, testing, ADRs, ops, etc.
```

## Documentation

Full SDLC documentation lives in [`docs/project-memory/`](./docs/project-memory/):
brief, requirements, architecture, security, testing, ops, decisions
(ADRs), risk, backlog, release notes, retirement plan, and session
handoff. Start with
[`03-architecture.md`](./docs/project-memory/03-architecture.md) and
[`07-decisions.md`](./docs/project-memory/07-decisions.md) for the "why"
behind the real-time design.

## Scripts

| Command                              | Purpose                                              |
| ------------------------------------ | ---------------------------------------------------- |
| `npm run dev`                        | Run with hot reload (`tsx watch`)                    |
| `npm run build` / `npm start`        | Compile to `dist/` and run it                        |
| `npm test`                           | Run the full test suite (needs a reachable Postgres) |
| `npm run lint` / `npm run typecheck` | Static checks                                        |
| `npm run prisma:migrate`             | Create + apply a new migration                       |

## License

MIT
