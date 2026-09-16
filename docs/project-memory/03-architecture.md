# Architecture

## Big picture

```
                          ┌───────────────────────────┐
                          │        http.Server         │
                          │   (single Node process)    │
                          └──────────────┬──────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │ 'request' event                                │ 'upgrade' event
                  ▼                                                ▼
        ┌───────────────────┐                          ┌───────────────────────┐
        │   Express app      │                          │  ws.WebSocketServer    │
        │  /healthz           │                          │  (noServer: true)       │
        │  /graphql (POST)    │                          │  path === '/graphql'   │
        │  helmet/cors/       │                          └───────────┬───────────┘
        │  rate-limit          │                                      │
        └─────────┬───────────┘                          ┌───────────▼───────────┐
                  │ expressMiddleware                     │  graphql-ws useServer  │
                  ▼                                        └───────────┬───────────┘
        ┌───────────────────┐                                          │
        │   Apollo Server 5   │◄───────── same GraphQLSchema ──────────┘
        │  (query/mutation)   │
        └─────────┬───────────┘
                  │
                  ▼
        ┌────────────────────────────────────────────────────────────┐
        │                     Resolvers / Services                     │
        │  UserService · ChannelService · NotificationService           │
        └─────────┬──────────────────────────────────┬─────────────────┘
                  │                                    │
                  ▼                                    ▼
        ┌───────────────────┐              ┌─────────────────────────┐
        │  Prisma → Postgres  │              │  NotificationDispatcher   │
        │  (durable state)     │              │  → PushChannel[]           │
        └───────────────────┘              │     - WebSocketPushChannel │
                                              │       (→ graphql-ws PubSub)│
                                              │     - (future) APNsChannel │
                                              └─────────────────────────┘
```

One `http.Server` backs both the HTTP GraphQL endpoint (queries and
mutations) and the WebSocket GraphQL endpoint (subscriptions), both on the
same path, `/graphql`. This is the single-repo design goal stated in the
brief: one coherent GraphQL API, not a REST API with a WebSocket
side-channel.

## Why GraphQL subscriptions instead of a bespoke WebSocket protocol

A hand-rolled WebSocket message protocol (`{"type": "notification", ...}`)
would have been the "quicker" real-time option, but it would have produced
two disconnected APIs: a typed, introspectable GraphQL schema for
queries/mutations, and an untyped, undocumented ad hoc protocol for
real-time. GraphQL subscriptions (over the `graphql-transport-ws`
sub-protocol implemented by `graphql-ws`) let the same schema, the same
type system, and the same authorization model cover both. A client
introspects one schema and knows the exact shape of `notificationReceived`.
See ADR-001 and ADR-002 in [07-decisions.md](./07-decisions.md).

## Layering

- **`src/graphql/`** — schema (typeDefs + resolvers merged with
  `@graphql-tools/schema`), the Apollo Server instance, the `graphql-ws`
  server, the shared `GraphQLContext` builder, and the process-local
  `PubSub` used to fan events out to live subscriptions.
- **`src/services/`** — domain logic (`UserService`, `ChannelService`,
  `NotificationService`) that resolvers call into. Resolvers stay thin:
  they extract arguments, call a service, and return the result. This
  keeps authorization and validation logic testable independent of
  GraphQL.
- **`src/services/push/`** — the push-delivery abstraction described
  below and in ADR-005.
- **`src/auth/`** — password hashing (bcrypt), JWT signing/verification,
  and the two call sites that extract a caller's identity: an
  `Authorization` HTTP header for queries/mutations, and a
  `connectionParams.authorization` value for the WebSocket's
  `connection_init` handshake. Both funnel into the same
  `verifyAccessToken` and the same `GraphQLContext` shape, so authorization
  logic in resolvers is transport-agnostic.
- **`src/db/prisma.ts`** — a single `PrismaClient` instance (Postgres).
- **`prisma/schema.prisma`** — `User`, `Channel`, `Subscription` (the
  user↔channel join table), `Notification`.

## The push-delivery abstraction (`src/services/push/`)

```ts
interface PushChannel {
  readonly name: string;
  publish(event: PushEvent): Promise<void> | void;
}

class NotificationDispatcher {
  constructor(private readonly channels: PushChannel[]) {}
  async dispatch(event: PushEvent): Promise<void> {
    /* fan out, Promise.allSettled */
  }
}
```

`NotificationService.publish()` writes the `Notification` row, then calls
`notificationDispatcher.dispatch({ channel, notification })` exactly once.
Today the dispatcher holds a single channel, `WebSocketPushChannel`, which
publishes onto the in-memory `PubSub` under a per-channel topic
(`NOTIFICATION_RECEIVED:<channelId>`); the `notificationReceived` GraphQL
subscription resolver's `subscribe` function returns that topic's async
iterator (after checking the caller is authenticated and subscribed to the
channel).

This is the concrete answer to the notifyhub-ios coupling constraint: a
future `ApnsPushChannel implements PushChannel` is added to the array
passed into `NotificationDispatcher` in
`src/services/push/dispatcher.ts:24` and nothing else in the codebase
changes — not the schema, not the resolvers, not `NotificationService`.
Channels run concurrently via `Promise.allSettled`, so a slow or failing
APNs provider can never block or fail WebSocket delivery, and vice versa.

## Request/connection lifecycle

**HTTP (`/graphql`, POST):** `helmet` → `cors` → per-route
`express-rate-limit` → `express.json()` → Apollo's `expressMiddleware`,
whose `context` callback reads `Authorization: Bearer <token>`, verifies
it, and builds a `GraphQLContext { user, services }`.

**WebSocket (`/graphql`, upgrade):** the raw `http.Server`'s `'upgrade'`
event is handled manually (`WebSocketServer({ noServer: true })` +
`wss.handleUpgrade`, gated on `pathname === '/graphql'`) rather than
letting `ws` bind to the HTTP server directly — see the comment in
`src/graphql/wsServer.ts` and ADR-004 for why. `graphql-ws`'s `useServer`
reads `connectionParams.authorization` during `connection_init` and builds
the same `GraphQLContext` shape used by HTTP.

**Shutdown:** `ApolloServerPluginDrainHttpServer` plus a custom plugin
`drainServer` hook (in `createApolloServer`) call `wsServer.dispose()` as
part of `apolloServer.stop()`, so there is exactly one owner of the
WebSocket server's lifecycle — see the "double-dispose" note in
[07-decisions.md](./07-decisions.md) ADR-004 for the bug this avoids.

## Data model

```
User 1───* Channel        (owner)
User 1───* Subscription *───1 Channel   (join table, unique on (userId, channelId))
User 1───* Notification *───1 Channel   (author, channel)
```

See `prisma/schema.prisma` for the full model, including indexes
(`Subscription.channelId`, `Notification.(channelId, createdAt)`).

## What is deliberately not built here

- **DataLoader / batched field resolution.** `Channel.owner`,
  `Notification.channel`, `Notification.author` etc. are resolved with a
  direct `findUnique` per parent, which is N+1 for a list query. For this
  API's scale and portfolio purpose this is an accepted, documented
  tradeoff rather than an oversight — see
  [09-backlog.md](./09-backlog.md).
- **Distributed PubSub.** See ADR-005: swapping the in-memory `PubSub` for
  `graphql-redis-subscriptions` (or similar) is the documented path to
  running more than one notifyhub instance; it is not implemented because
  nothing in this session's scope requires horizontal scaling.
