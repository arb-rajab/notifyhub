import { startTestServer, type TestServer } from '../setup/testServer';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { graphqlRequest } from '../setup/graphqlClient';

const REGISTER = `mutation Register($input: RegisterInput!) { register(input: $input) { token } }`;
const REGISTER_DEVICE = `
  mutation RegisterDevice($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input) { id platform }
  }
`;
const ROTATE_DEVICE = `
  mutation RotateDevice($oldToken: String!, $newToken: String!) {
    rotateDeviceToken(oldToken: $oldToken, newToken: $newToken) { id }
  }
`;
const REVOKE_DEVICE = `mutation RevokeDevice($token: String!) { revokeDeviceToken(token: $token) }`;
const MY_DEVICE_TOKENS = `query { myDeviceTokens { id platform } }`;

async function registerUser(origin: string, email: string) {
  const res = await graphqlRequest<{ register: { token: string } }>(origin, REGISTER, {
    input: { email, password: 'password123', displayName: email.split('@')[0] },
  });
  return res.data!.register.token;
}

describe('device token mutations', () => {
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

  it('requires authentication to register a device token', async () => {
    const res = await graphqlRequest(server.origin, REGISTER_DEVICE, {
      input: { token: 'device-token-1' },
    });
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('registers a device token and lists it back for the owner', async () => {
    const token = await registerUser(server.origin, 'device1@example.com');
    const res = await graphqlRequest(
      server.origin,
      REGISTER_DEVICE,
      { input: { token: 'apns-token-abc' } },
      token,
    );
    expect(res.errors).toBeUndefined();
    expect(
      (res.data as { registerDeviceToken: { platform: string } }).registerDeviceToken.platform,
    ).toBe('IOS');

    const listRes = await graphqlRequest<{ myDeviceTokens: Array<{ id: string }> }>(
      server.origin,
      MY_DEVICE_TOKENS,
      undefined,
      token,
    );
    expect(listRes.data!.myDeviceTokens).toHaveLength(1);
  });

  it('reassigns a token registered by a different user (reinstall on a new account)', async () => {
    const firstUserToken = await registerUser(server.origin, 'device2a@example.com');
    const secondUserToken = await registerUser(server.origin, 'device2b@example.com');

    await graphqlRequest(
      server.origin,
      REGISTER_DEVICE,
      { input: { token: 'shared-device' } },
      firstUserToken,
    );
    await graphqlRequest(
      server.origin,
      REGISTER_DEVICE,
      { input: { token: 'shared-device' } },
      secondUserToken,
    );

    const firstUserList = await graphqlRequest<{ myDeviceTokens: unknown[] }>(
      server.origin,
      MY_DEVICE_TOKENS,
      undefined,
      firstUserToken,
    );
    const secondUserList = await graphqlRequest<{ myDeviceTokens: unknown[] }>(
      server.origin,
      MY_DEVICE_TOKENS,
      undefined,
      secondUserToken,
    );
    expect(firstUserList.data!.myDeviceTokens).toHaveLength(0);
    expect(secondUserList.data!.myDeviceTokens).toHaveLength(1);
  });

  it('rotates a device token the caller owns', async () => {
    const token = await registerUser(server.origin, 'device3@example.com');
    await graphqlRequest(server.origin, REGISTER_DEVICE, { input: { token: 'old-token' } }, token);

    const rotateRes = await graphqlRequest(
      server.origin,
      ROTATE_DEVICE,
      { oldToken: 'old-token', newToken: 'new-token' },
      token,
    );
    expect(rotateRes.errors).toBeUndefined();

    const listRes = await graphqlRequest<{ myDeviceTokens: Array<{ id: string }> }>(
      server.origin,
      MY_DEVICE_TOKENS,
      undefined,
      token,
    );
    expect(listRes.data!.myDeviceTokens).toHaveLength(1);
  });

  it('rejects rotating a device token the caller does not own', async () => {
    const ownerToken = await registerUser(server.origin, 'device4a@example.com');
    const otherToken = await registerUser(server.origin, 'device4b@example.com');
    await graphqlRequest(
      server.origin,
      REGISTER_DEVICE,
      { input: { token: 'owned-token' } },
      ownerToken,
    );

    const res = await graphqlRequest(
      server.origin,
      ROTATE_DEVICE,
      { oldToken: 'owned-token', newToken: 'stolen-token' },
      otherToken,
    );
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('revokes a device token so it no longer appears in the active list', async () => {
    const token = await registerUser(server.origin, 'device5@example.com');
    await graphqlRequest(server.origin, REGISTER_DEVICE, { input: { token: 'to-revoke' } }, token);

    const revokeRes = await graphqlRequest<{ revokeDeviceToken: boolean }>(
      server.origin,
      REVOKE_DEVICE,
      { token: 'to-revoke' },
      token,
    );
    expect(revokeRes.data!.revokeDeviceToken).toBe(true);

    const listRes = await graphqlRequest<{ myDeviceTokens: unknown[] }>(
      server.origin,
      MY_DEVICE_TOKENS,
      undefined,
      token,
    );
    expect(listRes.data!.myDeviceTokens).toHaveLength(0);
  });

  it('rejects revoking a device token owned by another user', async () => {
    const ownerToken = await registerUser(server.origin, 'device6a@example.com');
    const otherToken = await registerUser(server.origin, 'device6b@example.com');
    await graphqlRequest(
      server.origin,
      REGISTER_DEVICE,
      { input: { token: 'protected-token' } },
      ownerToken,
    );

    const res = await graphqlRequest(
      server.origin,
      REVOKE_DEVICE,
      { token: 'protected-token' },
      otherToken,
    );
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
