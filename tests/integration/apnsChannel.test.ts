import { prisma } from '../../src/db/prisma';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { ApnsPushChannel } from '../../src/services/push/apnsChannel';
import { ApnsTokenInvalidError } from '../../src/services/push/apns/errors';
import type { ApnsHttpClient } from '../../src/services/push/apns/httpClient';

/**
 * Verifies the dispatch-side behavior that lives above the raw HTTP/2
 * protocol (already covered against a real fake server in
 * apnsHttpClient.test.ts): which device tokens get a push, what payload
 * they get, and that a token-invalid response results in the DeviceToken
 * row being revoked. The APNs client itself is a test double here since
 * that transport layer already has its own protocol-level tests.
 */
class FakeApnsClient {
  public readonly sent: Array<{ token: string; payload: unknown }> = [];
  private readonly invalidTokens: Set<string>;

  constructor(invalidTokens: string[] = []) {
    this.invalidTokens = new Set(invalidTokens);
  }

  send = jest.fn(async (token: string, payload: unknown) => {
    this.sent.push({ token, payload });
    if (this.invalidTokens.has(token)) {
      throw new ApnsTokenInvalidError(token, 'Unregistered');
    }
  });
}

async function createUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: 'x', displayName: email.split('@')[0]! },
  });
}

async function createChannelWithSubscribers(ownerId: string, subscriberIds: string[]) {
  return prisma.channel.create({
    data: {
      slug: 'alerts',
      name: 'Alerts',
      ownerId,
      subscriptions: { create: subscriberIds.map((userId) => ({ userId })) },
    },
  });
}

describe('ApnsPushChannel', () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('no-ops without querying the database when APNs is not configured', async () => {
    const channel = new ApnsPushChannel(prisma, null);
    const owner = await createUser('apns-owner1@example.com');
    const dbChannel = await createChannelWithSubscribers(owner.id, [owner.id]);
    const notification = await prisma.notification.create({
      data: { title: 'Hi', body: 'Hello', channelId: dbChannel.id, authorId: owner.id },
    });

    await expect(channel.publish({ channel: dbChannel, notification })).resolves.toBeUndefined();
  });

  it('sends to every active device token belonging to a subscriber, and skips revoked ones', async () => {
    const owner = await createUser('apns-owner2@example.com');
    const subscriber = await createUser('apns-sub2@example.com');
    const nonSubscriber = await createUser('apns-nonsub2@example.com');
    const dbChannel = await createChannelWithSubscribers(owner.id, [owner.id, subscriber.id]);

    await prisma.deviceToken.create({ data: { token: 'owner-device', userId: owner.id } });
    await prisma.deviceToken.create({ data: { token: 'sub-device', userId: subscriber.id } });
    await prisma.deviceToken.create({
      data: { token: 'sub-revoked-device', userId: subscriber.id, revokedAt: new Date() },
    });
    await prisma.deviceToken.create({ data: { token: 'nonsub-device', userId: nonSubscriber.id } });

    const notification = await prisma.notification.create({
      data: {
        title: 'Server down',
        body: 'Investigating',
        channelId: dbChannel.id,
        authorId: owner.id,
      },
    });

    const fakeClient = new FakeApnsClient();
    const channel = new ApnsPushChannel(prisma, fakeClient as unknown as ApnsHttpClient);

    await channel.publish({ channel: dbChannel, notification });

    const sentTokens = fakeClient.sent.map((s) => s.token).sort();
    expect(sentTokens).toEqual(['owner-device', 'sub-device']);
    expect(fakeClient.sent[0]!.payload).toMatchObject({
      aps: { alert: { title: 'Server down', body: 'Investigating' }, sound: 'default' },
      notificationId: notification.id,
      channelSlug: 'alerts',
    });
  });

  it('revokes a device token when APNs reports it as invalid', async () => {
    const owner = await createUser('apns-owner3@example.com');
    const dbChannel = await createChannelWithSubscribers(owner.id, [owner.id]);
    const deviceToken = await prisma.deviceToken.create({
      data: { token: 'dead-device', userId: owner.id },
    });
    const notification = await prisma.notification.create({
      data: { title: 'Hi', body: 'Hello', channelId: dbChannel.id, authorId: owner.id },
    });

    const fakeClient = new FakeApnsClient(['dead-device']);
    const channel = new ApnsPushChannel(prisma, fakeClient as unknown as ApnsHttpClient);

    await channel.publish({ channel: dbChannel, notification });

    const updated = await prisma.deviceToken.findUniqueOrThrow({ where: { id: deviceToken.id } });
    expect(updated.revokedAt).not.toBeNull();
  });

  it('does not throw when a subscriber has no device tokens at all', async () => {
    const owner = await createUser('apns-owner4@example.com');
    const dbChannel = await createChannelWithSubscribers(owner.id, [owner.id]);
    const notification = await prisma.notification.create({
      data: { title: 'Hi', body: 'Hello', channelId: dbChannel.id, authorId: owner.id },
    });

    const fakeClient = new FakeApnsClient();
    const channel = new ApnsPushChannel(prisma, fakeClient as unknown as ApnsHttpClient);

    await expect(channel.publish({ channel: dbChannel, notification })).resolves.toBeUndefined();
    expect(fakeClient.sent).toHaveLength(0);
  });
});
