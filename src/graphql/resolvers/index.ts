import { scalarResolvers } from './scalars';
import { userResolvers } from './user';
import { channelResolvers } from './channel';
import { notificationResolvers } from './notification';

export const resolvers = {
  ...scalarResolvers,
  Query: {
    ...userResolvers.Query,
    ...channelResolvers.Query,
    ...notificationResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...channelResolvers.Mutation,
    ...notificationResolvers.Mutation,
  },
  Subscription: {
    ...notificationResolvers.Subscription,
  },
  Channel: channelResolvers.Channel,
  Notification: notificationResolvers.Notification,
};
