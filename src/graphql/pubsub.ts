import { PubSub } from 'graphql-subscriptions';

/**
 * Single in-process event bus backing GraphQL subscriptions. Swappable for a
 * distributed implementation (e.g. graphql-redis-subscriptions) behind the
 * same PubSub interface if notifyhub ever runs as more than one instance -
 * see docs/project-memory/07-decisions.md ADR-005.
 */
export const pubsub = new PubSub();

export function notificationTopic(channelId: string): string {
  return `NOTIFICATION_RECEIVED:${channelId}`;
}
