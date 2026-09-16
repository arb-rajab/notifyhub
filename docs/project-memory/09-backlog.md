# Backlog

Not committed to any timeline — ordered roughly by expected value for a
portfolio piece at this stage.

## Near-term

- [ ] Add a DataLoader (or equivalent per-request batching) for
      `Channel.owner`, `Notification.channel`, `Notification.author` to
      remove the accepted N+1 tradeoff noted in
      [03-architecture.md](./03-architecture.md) / [08-risk.md](./08-risk.md)
      R-6.
- [ ] Add an automated test that asserts `graphql-depth-limit` actually
      rejects an over-depth query, and one that asserts the HTTP rate limiter
      returns 429 once its window is exceeded (both are configured but only
      indirectly covered today — [05-testing.md](./05-testing.md)).
- [ ] Cursor-based pagination for `notifications` (currently a flat
      `limit`, capped at 100, no `before`/`after` cursor) and for `channels`.
- [ ] Per-connection/per-message rate limiting on the WebSocket transport
      ([08-risk.md](./08-risk.md) R-3).

## Medium-term

- [ ] Refresh tokens + a revocation list, replacing the current
      short-lived-JWT-only model (ADR-003 / [08-risk.md](./08-risk.md) R-4).
- [ ] Admin-role mutations (e.g. deleting a channel, banning a user) —
      `Role.ADMIN` exists on the schema today but nothing checks it yet.
- [ ] Structured request tracing (a request id threaded through
      `pino`/`pino-http` and returned in responses) for easier debugging
      across the HTTP/WebSocket split.

## Larger, deliberately deferred

- [ ] Swap the in-memory `PubSub` for a distributed implementation
      (`graphql-redis-subscriptions` or equivalent) if/when notifyhub ever
      needs to run more than one instance — see ADR-005 and
      [08-risk.md](./08-risk.md) R-2. Not started; no current requirement for
      it.
- [x] **notifyhub-ios coupling:** implement `ApnsPushChannel implements
PushChannel` (`src/services/push/types.ts`) and register it in
      `notificationDispatcher`'s channel list
      (`src/services/push/dispatcher.ts`). Done this session — see ADR-008.

## Near-term (added this session)

- [ ] A scheduled cleanup job for stale `DeviceToken` rows (revoked more
      than N days ago, or never seen again after a long silence) — nothing
      prunes these today, they just accumulate with `revokedAt` set.
- [ ] Rate-limit `registerDeviceToken`/`rotateDeviceToken` specifically (the
      general `/graphql` rate limiter covers it today, but a tighter,
      per-mutation limit would catch a misbehaving client hammering
      registration harder than the general query traffic).
- [ ] A DataLoader-style batch for `ApnsPushChannel.publish`'s
      `deviceToken.findMany` if a channel with a very large subscriber count
      ever makes per-notification device-token fan-out a real bottleneck —
      not needed at current scale, same reasoning as R-6.
