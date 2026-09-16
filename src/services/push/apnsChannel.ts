import type { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import type { PushChannel, PushEvent } from './types';
import { loadApnsConfigFromEnv } from './apns/config';
import { ApnsJwtProvider } from './apns/jwtProvider';
import { ApnsHttpClient } from './apns/httpClient';
import { ApnsTokenInvalidError, redactDeviceToken } from './apns/errors';

function buildApnsPayload(event: PushEvent) {
  return {
    aps: {
      alert: { title: event.notification.title, body: event.notification.body },
      sound: 'default',
    },
    // Custom keys the notifyhub-ios client reads to deep-link into the
    // right channel/notification from a background or killed-state launch.
    notificationId: event.notification.id,
    channelSlug: event.channel.slug,
  };
}

/**
 * Delivers a published notification to every APNs-registered device
 * belonging to a user subscribed to the channel. A concrete implementation
 * of the ADR-005 PushChannel interface - see ADR-008 for why this is the
 * accepted proof of correctness even though no live delivery can be
 * verified in this sandbox (no live credentials are ever kept in this repo
 * or in CI).
 *
 * When APNs isn't configured (the default everywhere except an operator's
 * own signing environment), this channel no-ops rather than failing
 * notification publishing - the WebSocket channel still delivers.
 */
export class ApnsPushChannel implements PushChannel {
  readonly name = 'apns';

  private readonly client: ApnsHttpClient | null;

  constructor(
    private readonly prisma: PrismaClient,
    client?: ApnsHttpClient | null,
  ) {
    if (client !== undefined) {
      this.client = client;
      return;
    }
    const config = loadApnsConfigFromEnv();
    if (!config) {
      this.client = null;
      return;
    }
    this.client = new ApnsHttpClient({
      baseUrl: config.baseUrl,
      bundleId: config.bundleId,
      jwtProvider: new ApnsJwtProvider({
        keyId: config.keyId,
        teamId: config.teamId,
        privateKey: config.privateKey,
      }),
    });
  }

  async publish(event: PushEvent): Promise<void> {
    if (!this.client) {
      logger.debug('apns not configured, skipping device push delivery');
      return;
    }

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        revokedAt: null,
        user: { subscriptions: { some: { channelId: event.channel.id } } },
      },
    });
    if (deviceTokens.length === 0) return;

    const payload = buildApnsPayload(event);
    const results = await Promise.allSettled(
      deviceTokens.map((deviceToken) =>
        this.sendToDevice(deviceToken.id, deviceToken.token, payload),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          { err: result.reason, deviceToken: redactDeviceToken(deviceTokens[index]!.token) },
          'apns delivery failed',
        );
      }
    });
  }

  private async sendToDevice(
    deviceTokenId: string,
    token: string,
    payload: ReturnType<typeof buildApnsPayload>,
  ): Promise<void> {
    try {
      await this.client!.send(token, payload);
    } catch (err) {
      if (err instanceof ApnsTokenInvalidError) {
        await this.prisma.deviceToken.update({
          where: { id: deviceTokenId },
          data: { revokedAt: new Date() },
        });
        return;
      }
      throw err;
    }
  }
}
