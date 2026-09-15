import type { Notification } from '@prisma/client';
import type { GraphQLContext } from '../context';
import type { PublishNotificationInput } from '../../services/notificationService';
import { requireUser } from './user';
import { forbiddenError } from '../../utils/errors';
import { pubsub, notificationTopic } from '../pubsub';

export const notificationResolvers = {
  Query: {
    notifications: (
      _parent: unknown,
      args: { channelSlug: string; limit?: number },
      ctx: GraphQLContext,
    ) => resolveNotificationsForChannel(ctx, args.channelSlug, args.limit ?? 20),
  },
  Mutation: {
    publishNotification: (
      _parent: unknown,
      args: { input: PublishNotificationInput },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      return ctx.services.notifications.publish(user.sub, args.input);
    },
  },
  Subscription: {
    notificationReceived: {
      subscribe: async (_parent: unknown, args: { channelSlug: string }, ctx: GraphQLContext) => {
        const user = requireUser(ctx);
        const channel = await ctx.services.channels.requireBySlug(args.channelSlug);
        const isSubscribed = await ctx.services.channels.isSubscribed(user.sub, channel.id);
        if (!isSubscribed) {
          throw forbiddenError('You must be subscribed to a channel to receive its notifications.');
        }
        return pubsub.asyncIterator(notificationTopic(channel.id));
      },
      resolve: (payload: { notificationReceived: Notification }) => payload.notificationReceived,
    },
  },
  Notification: {
    channel: (parent: Notification, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.channels.findById(parent.channelId),
    author: (parent: Notification, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.users.findById(parent.authorId),
  },
};

async function resolveNotificationsForChannel(
  ctx: GraphQLContext,
  channelSlug: string,
  limit: number,
) {
  const channel = await ctx.services.channels.requireBySlug(channelSlug);
  return ctx.services.notifications.listForChannel(channel.id, limit);
}
