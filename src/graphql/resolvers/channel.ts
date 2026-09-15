import type { Channel } from '@prisma/client';
import type { GraphQLContext } from '../context';
import type { CreateChannelInput } from '../../services/channelService';
import { requireUser } from './user';

export const channelResolvers = {
  Query: {
    channels: (_parent: unknown, args: { search?: string | null }, ctx: GraphQLContext) =>
      ctx.services.channels.list(args.search),
    channel: (_parent: unknown, args: { slug: string }, ctx: GraphQLContext) =>
      ctx.services.channels.findBySlug(args.slug),
  },
  Mutation: {
    createChannel: (_parent: unknown, args: { input: CreateChannelInput }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return ctx.services.channels.create(user.sub, args.input);
    },
    subscribeToChannel: (_parent: unknown, args: { slug: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return ctx.services.channels.subscribe(user.sub, args.slug);
    },
    unsubscribeFromChannel: (_parent: unknown, args: { slug: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return ctx.services.channels.unsubscribe(user.sub, args.slug);
    },
  },
  Channel: {
    owner: (parent: Channel, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.users.findById(parent.ownerId),
    subscriberCount: (parent: Channel, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.channels.subscriberCount(parent.id),
    isSubscribed: (parent: Channel, _args: unknown, ctx: GraphQLContext) =>
      ctx.services.channels.isSubscribed(ctx.user?.sub ?? null, parent.id),
  },
};
