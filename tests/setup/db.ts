import { prisma } from '../../src/db/prisma';

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.deviceToken.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.channel.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
