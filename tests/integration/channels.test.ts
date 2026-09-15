import { startTestServer, type TestServer } from '../setup/testServer';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { graphqlRequest } from '../setup/graphqlClient';

const REGISTER = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) { token user { id } }
  }
`;
const CREATE_CHANNEL = `
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) { id slug name isSubscribed subscriberCount owner { id } }
  }
`;
const CHANNELS = `query Channels($search: String) { channels(search: $search) { slug name } }`;
const SUBSCRIBE = `mutation Subscribe($slug: String!) { subscribeToChannel(slug: $slug) { slug isSubscribed subscriberCount } }`;
const UNSUBSCRIBE = `mutation Unsubscribe($slug: String!) { unsubscribeFromChannel(slug: $slug) { slug isSubscribed subscriberCount } }`;

async function registerUser(origin: string, email: string) {
  const res = await graphqlRequest<{ register: { token: string; user: { id: string } } }>(
    origin,
    REGISTER,
    { input: { email, password: 'password123', displayName: email.split('@')[0] } },
  );
  return res.data!.register;
}

describe('channels', () => {
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

  it('requires authentication to create a channel', async () => {
    const res = await graphqlRequest(server.origin, CREATE_CHANNEL, {
      input: { slug: 'no-auth', name: 'No Auth' },
    });
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('creates a channel, auto-subscribing the owner', async () => {
    const { token } = await registerUser(server.origin, 'owner@example.com');
    const res = await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'release-notes', name: 'Release Notes' } },
      token,
    );
    expect(res.errors).toBeUndefined();
    const channel = (res.data as { createChannel: Record<string, unknown> }).createChannel;
    expect(channel).toMatchObject({
      slug: 'release-notes',
      isSubscribed: true,
      subscriberCount: 1,
    });
  });

  it('rejects a duplicate slug', async () => {
    const { token } = await registerUser(server.origin, 'owner2@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'dup', name: 'Dup' } },
      token,
    );
    const res = await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'dup', name: 'Dup Again' } },
      token,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('lets another user subscribe and unsubscribe', async () => {
    const owner = await registerUser(server.origin, 'owner3@example.com');
    const subscriber = await registerUser(server.origin, 'subscriber@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'incidents', name: 'Incidents' } },
      owner.token,
    );

    const subRes = await graphqlRequest(
      server.origin,
      SUBSCRIBE,
      { slug: 'incidents' },
      subscriber.token,
    );
    expect(subRes.data).toMatchObject({
      subscribeToChannel: { isSubscribed: true, subscriberCount: 2 },
    });

    const unsubRes = await graphqlRequest(
      server.origin,
      UNSUBSCRIBE,
      { slug: 'incidents' },
      subscriber.token,
    );
    expect(unsubRes.data).toMatchObject({
      unsubscribeFromChannel: { isSubscribed: false, subscriberCount: 1 },
    });
  });

  it('prevents the owner from unsubscribing from their own channel', async () => {
    const owner = await registerUser(server.origin, 'owner4@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'owner-only', name: 'Owner Only' } },
      owner.token,
    );
    const res = await graphqlRequest(
      server.origin,
      UNSUBSCRIBE,
      { slug: 'owner-only' },
      owner.token,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });

  it('filters channels by search term', async () => {
    const owner = await registerUser(server.origin, 'owner5@example.com');
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'billing', name: 'Billing' } },
      owner.token,
    );
    await graphqlRequest(
      server.origin,
      CREATE_CHANNEL,
      { input: { slug: 'shipping', name: 'Shipping' } },
      owner.token,
    );

    const res = await graphqlRequest<{ channels: Array<{ slug: string }> }>(
      server.origin,
      CHANNELS,
      {
        search: 'bill',
      },
    );
    expect(res.data!.channels).toHaveLength(1);
    expect(res.data!.channels[0]!.slug).toBe('billing');
  });
});
