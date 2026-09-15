# Retirement Plan

notifyhub is a portfolio piece, not a service with real users or an SLA.
This document exists so that if/when it needs to be taken down or
archived, that's a deliberate, low-risk action rather than a guess.

## If retiring the deployed service (not the repo)

1. Confirm no companion repo depends on it being live. As of this
   writing, `notifyhub-ios` is planned but not yet built — check whether
   it exists and is pointed at a live notifyhub deployment before taking
   the backend down.
2. Stop the running container(s) / deployment; there is no persistent
   external state outside the Postgres database it owns (no other service
   writes to or reads from notifyhub's database).
3. Snapshot or dump the Postgres database if the data (demo users,
   channels, notification history) has any continuing value; otherwise it
   is safe to discard — it is entirely synthetic/demo data by design (see
   [01-brief.md](./01-brief.md)).
4. Revoke/rotate the `JWT_SECRET` used in that deployment so any
   still-valid tokens (at most 15 minutes old, per ADR-003) stop
   verifying immediately rather than waiting out their natural expiry.

## If archiving the repository itself

1. No other repository imports notifyhub as a package/dependency — it is
   a standalone service consumed only over its GraphQL API, never as a
   library. Archiving it does not break another repo's build.
2. Update the portfolio's index/manifest (outside this repo) to mark it
   archived, and note the notifyhub-ios coupling explicitly if that repo
   exists by then, so its README doesn't silently point at a dead
   backend.
3. GitHub's "Archive repository" is sufficient — no migration of issues,
   PRs, or wiki content is needed since this repo's living documentation
   is entirely within `docs/project-memory/`, which archives with it.

## What would make this not disposable

If notifyhub ever gains real users or real data with standing value (i.e.
stops being a portfolio demo), this retirement plan should be rewritten
before any of the above steps are taken — in particular, step 3 under
"retiring the deployed service" ("safe to discard") would no longer hold.
