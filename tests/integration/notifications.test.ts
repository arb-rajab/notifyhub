import { startTestServer, type TestServer } from '../setup/testServer';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { graphqlRequest } from '../setup/graphqlClient';

const REGISTER = `mutation Register($input: RegisterInput!) { register(input: $input) { token } }`;
const CREATE_CHANNEL = `mutation CreateChannel($input: CreateChannelInput!) { createChannel(input: $input) { id slug } }`;
const PUBLISH = `
  mutation Publish($input: PublishNotificationInput!) {
    publishNotification(input: $input) { id title body channel { slug } author { id } }
  }
`;
const NOTIFICATIONS = `
  query Notifications($channelSlug: String!, $limit: Int) {
    notifications(channelSlug: $channelSlug, limit: $limit) { id title body }
  }
`;

async function registerUser(origin: string, email: string) {
  const res = await graphqlRequest<{ register: { token: string } }>(origin, REGISTER, {
    input: { email, password: 'password123', displayName: email.split('@')[0] },
  });
  return res.data!.register.token;
}

describe('notifications', () => {
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

  it('rejects publishing to a channel the caller is not subscribed to', async () => {
    const ownerToken = await registerUser(server.origin, 'pub-owner@example.com');
    const otherToken = await registerUser(server.origin, 'pub-other@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'alerts', name: 'Alerts' } },
      ownerToken,
    );

    const res = await graphqlRequest(
      server.origin,
      PUBLISH,
      { input: { channelSlug: 'alerts', title: 'Hi', body: 'Hello' } },
      otherToken,
    );
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('publishes a notification and lists it back newest-first', async () => {
    const token = await registerUser(server.origin, 'pub-owner2@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'status', name: 'Status' } },
      token,
    );

    await graphqlRequest(
      server.origin,
      PUBLISH,
      { input: { channelSlug: 'status', title: 'First', body: 'One' } },
      token,
    );
    await graphqlRequest(
      server.origin,
      PUBLISH,
      { input: { channelSlug: 'status', title: 'Second', body: 'Two' } },
      token,
    );

    const res = await graphqlRequest<{ notifications: Array<{ title: string }> }>(
      server.origin,
      NOTIFICATIONS,
      { channelSlug: 'status', limit: 10 },
    );
    expect(res.data!.notifications.map((n) => n.title)).toEqual(['Second', 'First']);
  });
});
