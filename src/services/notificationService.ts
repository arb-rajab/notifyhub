import { Prisma, type PrismaClient } from '@prisma/client';
import { forbiddenError, userInputError } from '../utils/errors';
import { ChannelService } from './channelService';
import { notificationDispatcher } from './push/dispatcher';

export interface PublishNotificationInput {
  channelSlug: string;
  title: string;
  body: string;
  metadata?: unknown;
}

export class NotificationService {
  private readonly channelService: ChannelService;

  constructor(private readonly prisma: PrismaClient) {
    this.channelService = new ChannelService(prisma);
  }

  async publish(authorId: string, input: PublishNotificationInput) {
    if (input.title.trim().length === 0) {
      throw userInputError('Notification title is required.');
    }
    if (input.body.trim().length === 0) {
      throw userInputError('Notification body is required.');
    }

    const channel = await this.channelService.requireBySlug(input.channelSlug);
    const isSubscribed = await this.channelService.isSubscribed(authorId, channel.id);
    if (!isSubscribed) {
      throw forbiddenError('You must be subscribed to a channel to publish notifications to it.');
    }

    const notification = await this.prisma.notification.create({
      data: {
        title: input.title.trim(),
        body: input.body.trim(),
        metadata:
          input.metadata === undefined
            ? undefined
            : input.metadata === null
              ? Prisma.JsonNull
              : (input.metadata as Prisma.InputJsonValue),
        channelId: channel.id,
        authorId,
      },
    });

    await notificationDispatcher.dispatch({ channel, notification });

    return notification;
  }

  listForChannel(channelId: string, limit: number) {
    return this.prisma.notification.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}
