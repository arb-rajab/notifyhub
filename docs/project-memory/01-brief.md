# Project Brief

## What this is

notifyhub is a Node.js + Express backend whose entire public API is
GraphQL, with real-time delivery implemented as GraphQL subscriptions over
a WebSocket transport (`graphql-ws`) — not a separate ad hoc WebSocket
layer bolted alongside a REST/GraphQL API. It exists as a portfolio piece
covering three related technical areas in one coherent design: Node/Express
as the runtime, GraphQL as the API paradigm, and WebSocket-based real-time
push as the delivery mechanism.

The domain is a small, invented notification service: users create or
subscribe to **channels** (topics), and any subscriber can **publish a
notification** to a channel they belong to. Every other subscriber with a
live GraphQL subscription open receives that notification immediately over
their WebSocket connection, and it is also durably stored so clients can
query recent history on reconnect.

## Why this shape

The domain is intentionally simple — this is a skill demonstration, not a
production business. What is not simplified is the engineering underneath
it: real auth, a real relational schema with migrations, a real
push-delivery abstraction, genuine automated tests (including one that
opens an actual WebSocket connection and asserts it receives a real push),
containerization, CI, and this documentation set.

## Forward-looking constraint

A future companion repository, `notifyhub-ios`, will be a native
Swift/SwiftUI app whose purpose is demonstrating real Apple Push
Notification service (APNs) delivery from this backend. notifyhub does not
implement APNs in this session, but the push-delivery path
(`NotificationDispatcher` / `PushChannel`, see
[03-architecture.md](./03-architecture.md) and ADR-005 in
[07-decisions.md](./07-decisions.md)) is deliberately shaped so that adding
a device-push channel later is an additive change, not a rewrite.

## Scope of this session

This document set, and the codebase it describes, were produced in a single
first-time architecture session on a brand-new, empty repository. There is
no prior session to defer to — see
[12-session-handoff.md](./12-session-handoff.md) for what a future session
should know.
