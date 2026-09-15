# Requirements

## Functional requirements

### Authentication & accounts

- FR1. A visitor can register with an email, password, and display name.
- FR2. A registered user can log in with email + password and receive a
  bearer access token.
- FR3. An authenticated user can query their own profile (`me`).

### Channels

- FR4. An authenticated user can create a channel (topic) with a unique,
  URL-safe slug. The creator becomes the channel's owner and is
  automatically subscribed.
- FR5. Anyone (authenticated or not) can list and search channels, and view
  a single channel's metadata, including whether the current viewer is
  subscribed.
- FR6. An authenticated user can subscribe to, or unsubscribe from, any
  channel. A channel's owner cannot unsubscribe from their own channel.

### Notifications

- FR7. An authenticated user who is subscribed to a channel can publish a
  notification (title, body, optional structured metadata) to it. A user
  who is not subscribed to a channel cannot publish to it.
- FR8. Anyone can query the most recent notifications for a channel
  (paginated by a limit), newest first.
- FR9. An authenticated user who is subscribed to a channel can open a
  GraphQL subscription and receive every notification published to that
  channel in real time, for as long as the subscription is live. A user
  who is not subscribed to the channel cannot open this subscription.

## Non-functional requirements

- NFR1 (Auth). Passwords are never stored in plaintext or a reversible
  form; access tokens are signed and time-limited. See
  [04-security.md](./04-security.md).
- NFR2 (Consistency). Real-time delivery and persisted history must agree:
  a notification is durably written before it is dispatched to live
  subscribers, so a client that reconnects and queries history never sees
  a notification it should have received live but didn't, or vice versa.
- NFR3 (Abuse resistance). The GraphQL HTTP endpoint is rate-limited per
  client and query depth is bounded, to blunt the two most common abuse
  vectors for a public GraphQL API (request flooding and maliciously
  nested queries).
- NFR4 (Testability). The real-time path must be covered by an automated
  test that exercises an actual WebSocket connection and actual push
  delivery — not a mock of the transport. See
  [05-testing.md](./05-testing.md).
- NFR5 (Extensibility). The push-delivery path must support adding a
  second delivery channel (a future device-push/APNs channel for
  notifyhub-ios) without changing the GraphQL schema, resolvers, or
  existing channel implementations. See ADR-005 in
  [07-decisions.md](./07-decisions.md).
- NFR6 (Operability). The service must be runnable via Docker Compose with
  one command against a real Postgres instance, expose a health check, and
  shut down gracefully (draining both HTTP and WebSocket connections).

## Explicit non-goals (this session)

- Real APNs / device-push integration (tracked for notifyhub-ios).
- Multi-instance horizontal scaling of the WebSocket layer (the in-memory
  PubSub is single-process; see ADR-005).
- Admin-role authorization workflows beyond the `Role` field existing on
  `User` (no admin-only mutations are implemented yet — see
  [09-backlog.md](./09-backlog.md)).
- Refresh tokens / token revocation (access tokens are short-lived and
  stateless; see ADR-003).
