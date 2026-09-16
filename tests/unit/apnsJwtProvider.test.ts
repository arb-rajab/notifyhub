import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { ApnsJwtProvider } from '../../src/services/push/apns/jwtProvider';

// A throwaway EC (P-256) key pair generated fresh for this test run - APNs
// provider auth tokens are always ES256, so a real ES256-capable key is
// required to exercise jsonwebtoken's signing path, but this key never
// talks to Apple and is discarded when the process exits.
const TEST_PRIVATE_KEY = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
  type: 'sec1',
  format: 'pem',
}) as string;

describe('ApnsJwtProvider', () => {
  it('signs an ES256 token with the configured kid/iss', () => {
    const provider = new ApnsJwtProvider({
      keyId: 'KEY123',
      teamId: 'TEAM456',
      privateKey: TEST_PRIVATE_KEY,
    });
    const token = provider.getToken();

    const decodedHeader = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString());
    expect(decodedHeader).toMatchObject({ alg: 'ES256', kid: 'KEY123' });

    const decodedPayload = jwt.decode(token) as { iss: string; iat: number };
    expect(decodedPayload.iss).toBe('TEAM456');
    expect(typeof decodedPayload.iat).toBe('number');
  });

  it("reuses the cached token within Apple's reuse window", () => {
    let now = 1_000_000;
    const provider = new ApnsJwtProvider(
      { keyId: 'KEY123', teamId: 'TEAM456', privateKey: TEST_PRIVATE_KEY },
      () => now,
    );

    const first = provider.getToken();
    now += 5 * 60 * 1000; // +5 minutes
    const second = provider.getToken();
    expect(second).toBe(first);
  });

  it('mints a new token once the reuse window has passed', () => {
    let now = 1_000_000;
    const provider = new ApnsJwtProvider(
      { keyId: 'KEY123', teamId: 'TEAM456', privateKey: TEST_PRIVATE_KEY },
      () => now,
    );

    const first = provider.getToken();
    now += 56 * 60 * 1000; // +56 minutes, past the 55-minute reuse window
    const second = provider.getToken();
    expect(second).not.toBe(first);
  });
});
