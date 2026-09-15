import type { Notification, Channel } from '@prisma/client';

export interface PushEvent {
  channel: Channel;
  notification: Notification;
}

/**
 * One delivery mechanism for a published notification. Today only
 * WebSocketPushChannel exists (fans out over a GraphQL subscription); a
 * future device-push channel (e.g. APNs, for the notifyhub-ios companion
 * app) implements the same interface and is added to the dispatcher's
 * channel list in src/services/push/dispatcher.ts without touching any
 * resolver or publish call site.
 */
export interface PushChannel {
  readonly name: string;
  publish(event: PushEvent): Promise<void> | void;
}
