import type { AccessTokenPayload } from '../auth/jwt';
import { prisma } from '../db/prisma';
import { UserService } from '../services/userService';
import { ChannelService } from '../services/channelService';
import { NotificationService } from '../services/notificationService';

export type AuthenticatedUser = AccessTokenPayload;

export interface GraphQLContext {
  user: AuthenticatedUser | null;
  services: {
    users: UserService;
    channels: ChannelService;
    notifications: NotificationService;
  };
}

export function buildContext(user: AuthenticatedUser | null): GraphQLContext {
  return {
    user,
    services: {
      users: new UserService(prisma),
      channels: new ChannelService(prisma),
      notifications: new NotificationService(prisma),
    },
  };
}
