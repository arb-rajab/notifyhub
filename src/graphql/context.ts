import type { AccessTokenPayload } from '../auth/jwt';
import { prisma } from '../db/prisma';
import { UserService } from '../services/userService';
import { ChannelService } from '../services/channelService';
import { NotificationService } from '../services/notificationService';
import { DeviceTokenService } from '../services/deviceTokenService';

export type AuthenticatedUser = AccessTokenPayload;

export interface GraphQLContext {
  user: AuthenticatedUser | null;
  services: {
    users: UserService;
    channels: ChannelService;
    notifications: NotificationService;
    deviceTokens: DeviceTokenService;
  };
}

export function buildContext(user: AuthenticatedUser | null): GraphQLContext {
  return {
    user,
    services: {
      users: new UserService(prisma),
      channels: new ChannelService(prisma),
      notifications: new NotificationService(prisma),
      deviceTokens: new DeviceTokenService(prisma),
    },
  };
}
