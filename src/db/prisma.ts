import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

declare global {
  var __prisma__: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  // Prisma 7 has no built-in query engine connection: every client needs a
  // driver adapter, and the connection string is passed here rather than read
  // from schema.prisma.
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = global.__prisma__ ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
