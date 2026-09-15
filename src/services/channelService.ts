import type { PrismaClient } from '@prisma/client';
import { conflictError, forbiddenError, notFoundError, userInputError } from '../utils/errors';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CreateChannelInput {
  slug: string;
  name: string;
  description?: string | null;
}

export class ChannelService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(ownerId: string, input: CreateChannelInput) {
    const slug = input.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      throw userInputError(
        'Slug must be lowercase, alphanumeric, and hyphen-separated (e.g. "order-updates").',
      );
    }
    if (input.name.trim().length === 0) {
      throw userInputError('Channel name is required.');
    }

    const existing = await this.prisma.channel.findUnique({ where: { slug } });
    if (existing) {
      throw conflictError(`A channel with slug "${slug}" already exists.`);
    }

    return this.prisma.channel.create({
      data: {
        slug,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        ownerId,
        subscriptions: { create: { userId: ownerId } },
      },
    });
  }

  list(search?: string | null) {
    if (!search || search.trim().length === 0) {
      return this.prisma.channel.findMany({ orderBy: { createdAt: 'desc' } });
    }
    const term = search.trim();
    return this.prisma.channel.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.channel.findUnique({ where: { slug } });
  }

  findById(id: string) {
    return this.prisma.channel.findUnique({ where: { id } });
  }

  async requireBySlug(slug: string) {
    const channel = await this.findBySlug(slug);
    if (!channel) throw notFoundError(`No channel found with slug "${slug}".`);
    return channel;
  }

  async subscribe(userId: string, slug: string) {
    const channel = await this.requireBySlug(slug);
    await this.prisma.subscription.upsert({
      where: { userId_channelId: { userId, channelId: channel.id } },
      create: { userId, channelId: channel.id },
      update: {},
    });
    return channel;
  }

  async unsubscribe(userId: string, slug: string) {
    const channel = await this.requireBySlug(slug);
    if (channel.ownerId === userId) {
      throw forbiddenError('The channel owner cannot unsubscribe from their own channel.');
    }
    await this.prisma.subscription.deleteMany({ where: { userId, channelId: channel.id } });
    return channel;
  }

  async isSubscribed(userId: string | null, channelId: string): Promise<boolean> {
    if (!userId) return false;
    const sub = await this.prisma.subscription.findUnique({
      where: { userId_channelId: { userId, channelId } },
    });
    return sub !== null;
  }

  subscriberCount(channelId: string) {
    return this.prisma.subscription.count({ where: { channelId } });
  }
}
