import { createClient, type Client } from 'graphql-ws';
import WebSocket from 'ws';
import { startTestServer, type TestServer } from '../setup/testServer';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { graphqlRequest } from '../setup/graphqlClient';

const REGISTER = `mutation Register($input: RegisterInput!) { register(input: $input) { token } }`;
const CREATE_CHANNEL = `mutation CreateChannel($input: CreateChannelInput!) { createChannel(input: $input) { slug } }`;
const SUBSCRIBE_CHANNEL = `mutation Subscribe($slug: String!) { subscribeToChannel(slug: $slug) { slug } }`;
const PUBLISH = `
  mutation Publish($input: PublishNotificationInput!) {
    publishNotification(input: $input) { id title }
  }
`;
const NOTIFICATION_RECEIVED = `
  subscription OnNotification($channelSlug: String!) {
    notificationReceived(channelSlug: $channelSlug) { id title body }
  }
`;

async function registerUser(origin: string, email: string) {
  const res = await graphqlRequest<{ register: { token: string } }>(origin, REGISTER, {
    input: { email, password: 'password123', displayName: email.split('@')[0] },
  });
  return res.data!.register.token;
}

function makeWsClient(wsUrl: string, token?: string): Client {
  return createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    connectionParams: token ? { authorization: `Bearer ${token}` } : {},
    retryAttempts: 0,
  });
}

/** Subscribes and resolves with the first event (or rejects on a protocol/GraphQL error). */
function nextEvent<T>(
  client: Client,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    client.subscribe<T>(
      { query, variables },
      {
        next: (msg) => {
          if (msg.errors && msg.errors.length > 0) {
            reject(msg.errors[0]);
            return;
          }
          resolve(msg.data as T);
        },
        error: (err) => reject(err),
        complete: () => reject(new Error('subscription completed with no data')),
      },
    );
  });
}

describe('real-time notification delivery over GraphQL subscriptions', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('pushes a published notification to a live subscriber over the websocket', async () => {
    const publisherToken = await registerUser(server.origin, 'realtime-publisher@example.com');
    const subscriberToken = await registerUser(server.origin, 'realtime-subscriber@example.com');

    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'incidents-live', name: 'Incidents Live' } },
      publisherToken,
    );
    await graphqlRequest(
      server.origin,
      SUBSCRIBE_CHANNEL,
      { slug: 'incidents-live' },
      subscriberToken,
    );

    const client = makeWsClient(server.wsUrl, subscriberToken);
    try {
      const eventPromise = nextEvent<{
        notificationReceived: { id: string; title: string; body: string };
      }>(client, NOTIFICATION_RECEIVED, { channelSlug: 'incidents-live' });

      // Give the server a moment to register the subscription before publishing.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const publishRes = await graphqlRequest(
        server.origin,
        PUBLISH,
        {
          input: {
            channelSlug: 'incidents-live',
            title: 'Database failover',
            body: 'Primary is down, failing over.',
          },
        },
        publisherToken,
      );
      expect(publishRes.errors).toBeUndefined();

      const event = await eventPromise;
      expect(event.notificationReceived).toMatchObject({
        title: 'Database failover',
        body: 'Primary is down, failing over.',
      });
    } finally {
      client.dispose();
    }
  });

  it('rejects a subscription attempt from a user who is not subscribed to the channel', async () => {
    const ownerToken = await registerUser(server.origin, 'gate-owner@example.com');
    const outsiderToken = await registerUser(server.origin, 'gate-outsider@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'private-room', name: 'Private Room' } },
      ownerToken,
    );

    const client = makeWsClient(server.wsUrl, outsiderToken);
    try {
      await expect(
        nextEvent(client, NOTIFICATION_RECEIVED, { channelSlug: 'private-room' }),
      ).rejects.toBeTruthy();
    } finally {
      client.dispose();
    }
  });

  it('rejects a subscription attempt with no authentication', async () => {
    const ownerToken = await registerUser(server.origin, 'gate-owner2@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'auth-required', name: 'Auth Required' } },
      ownerToken,
    );

    const client = makeWsClient(server.wsUrl);
    try {
      await expect(
        nextEvent(client, NOTIFICATION_RECEIVED, { channelSlug: 'auth-required' }),
      ).rejects.toBeTruthy();
    } finally {
      client.dispose();
    }
  });
});
