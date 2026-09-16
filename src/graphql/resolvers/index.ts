import { scalarResolvers } from './scalars';
import { userResolvers } from './user';
import { channelResolvers } from './channel';
import { notificationResolvers } from './notification';
import { deviceTokenResolvers } from './deviceToken';

export const resolvers = {
  ...scalarResolvers,
  Query: {
    ...userResolvers.Query,
    ...channelResolvers.Query,
    ...notificationResolvers.Query,
    ...deviceTokenResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...channelResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...deviceTokenResolvers.Mutation,
  },
  Subscription: {
    ...notificationResolvers.Subscription,
  },
  Channel: channelResolvers.Channel,
  Notification: notificationResolvers.Notification,
};
