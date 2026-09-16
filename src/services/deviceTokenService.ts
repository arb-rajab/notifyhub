import type { PrismaClient } from '@prisma/client';
import { forbiddenError, notFoundError, userInputError } from '../utils/errors';

export interface RegisterDeviceTokenInput {
  token: string;
  platform?: 'IOS';
}

export class DeviceTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Registers (or re-registers) a device token for the caller. A token is
   * globally unique - re-registering a token that belonged to a different
   * user (e.g. the app reinstalled under a new account on the same device)
   * reassigns it, since APNs itself does the same thing on the device side.
   */
  async register(userId: string, input: RegisterDeviceTokenInput) {
    const token = input.token.trim();
    if (token.length === 0) {
      throw userInputError('Device token is required.');
    }

    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform: input.platform ?? 'IOS', userId },
      update: { userId, revokedAt: null, lastSeenAt: new Date() },
    });
  }

  /**
   * Replaces a token the caller already owns (APNs rotated it) with a new
   * one, in one step so there's never a window with neither token active.
   */
  async rotate(userId: string, oldToken: string, newToken: string) {
    const trimmedNewToken = newToken.trim();
    if (trimmedNewToken.length === 0) {
      throw userInputError('New device token is required.');
    }

    const existing = await this.prisma.deviceToken.findUnique({
      where: { token: oldToken.trim() },
    });
    if (!existing || existing.userId !== userId) {
      throw notFoundError('No device token registration found to rotate.');
    }

    return this.prisma.deviceToken.update({
      where: { id: existing.id },
      data: { token: trimmedNewToken, revokedAt: null, lastSeenAt: new Date() },
    });
  }

  async revoke(userId: string, token: string): Promise<boolean> {
    const existing = await this.prisma.deviceToken.findUnique({ where: { token: token.trim() } });
    if (!existing) return false;
    if (existing.userId !== userId) {
      throw forbiddenError('You can only revoke your own device tokens.');
    }
    if (existing.revokedAt) return true;

    await this.prisma.deviceToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return true;
  }

  listForUser(userId: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}
