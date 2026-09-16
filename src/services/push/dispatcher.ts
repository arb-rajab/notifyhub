import { logger } from '../../utils/logger';
import { prisma } from '../../db/prisma';
import { WebSocketPushChannel } from './websocketChannel';
import { ApnsPushChannel } from './apnsChannel';
import type { PushChannel, PushEvent } from './types';

/**
 * Fans a published notification out to every registered PushChannel.
 * Channels are dispatched concurrently and independently: a failure in one
 * (e.g. a future APNs channel hitting a provider outage) is logged but
 * never blocks or fails delivery on the others.
 */
export class NotificationDispatcher {
  constructor(private readonly channels: PushChannel[]) {}

  async dispatch(event: PushEvent): Promise<void> {
    const results = await Promise.allSettled(
      this.channels.map((channel) => channel.publish(event)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          { err: result.reason, channel: this.channels[index]?.name },
          'push channel failed to deliver notification',
        );
      }
    });
  }
}

export const notificationDispatcher = new NotificationDispatcher([
  new WebSocketPushChannel(),
  new ApnsPushChannel(prisma),
]);
