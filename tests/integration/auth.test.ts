import { startTestServer, type TestServer } from '../setup/testServer';
import { resetDatabase, disconnectDatabase } from '../setup/db';
import { graphqlRequest } from '../setup/graphqlClient';

const REGISTER = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user { id email displayName role }
    }
  }
`;

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user { id email }
    }
  }
`;

const ME = `query { me { id email } }`;

describe('auth', () => {
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

  it('registers a new user and returns a usable token', async () => {
    const res = await graphqlRequest(server.origin, REGISTER, {
      input: { email: 'ada@example.com', password: 'lovelace123', displayName: 'Ada' },
    });

    expect(res.errors).toBeUndefined();
    const body = res.data as { register: { token: string; user: { email: string } } };
    expect(body.register.user.email).toBe('ada@example.com');
    expect(typeof body.register.token).toBe('string');

    const meRes = await graphqlRequest(server.origin, ME, undefined, body.register.token);
    expect((meRes.data as { me: { email: string } }).me.email).toBe('ada@example.com');
  });

  it('rejects registering the same email twice', async () => {
    await graphqlRequest(server.origin, REGISTER, {
      input: { email: 'dup@example.com', password: 'password123', displayName: 'Dup' },
    });
    const res = await graphqlRequest(server.origin, REGISTER, {
      input: { email: 'dup@example.com', password: 'password123', displayName: 'Dup' },
    });
    expect(res.data).toBeNull();
    expect(res.errors?.[0]?.extensions?.code).toBe('CONFLICT');
  });

  it('logs in with correct credentials and rejects incorrect ones', async () => {
    await graphqlRequest(server.origin, REGISTER, {
      input: { email: 'grace@example.com', password: 'hopper1234', displayName: 'Grace' },
    });

    const good = await graphqlRequest(server.origin, LOGIN, {
      input: { email: 'grace@example.com', password: 'hopper1234' },
    });
    expect(good.errors).toBeUndefined();

    const bad = await graphqlRequest(server.origin, LOGIN, {
      input: { email: 'grace@example.com', password: 'wrong-password' },
    });
    expect(bad.data).toBeNull();
    expect(bad.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('returns null for me when unauthenticated', async () => {
    const res = await graphqlRequest(server.origin, ME);
    expect((res.data as { me: null }).me).toBeNull();
  });
});
