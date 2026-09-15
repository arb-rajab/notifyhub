import { pubsub, notificationTopic } from '../../graphql/pubsub';
import type { PushChannel, PushEvent } from './types';

/**
 * Delivers a published notification to every client currently running a
 * live `notificationReceived` GraphQL subscription for the channel, over
 * the graphql-ws WebSocket connection.
 */
export class WebSocketPushChannel implements PushChannel {
  readonly name = 'websocket';

  async publish(event: PushEvent): Promise<void> {
    await pubsub.publish(notificationTopic(event.channel.id), {
      notificationReceived: event.notification,
    });
  }
}
