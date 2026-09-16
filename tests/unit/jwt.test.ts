import { signAccessToken, verifyAccessToken } from '../../src/auth/jwt';

describe('jwt access tokens', () => {
  const payload = { sub: 'user-1', email: 'user@example.com', role: 'USER' as const };

  it('round-trips a signed token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).toEqual(payload);
  });

  it('rejects a malformed token', () => {
    expect(verifyAccessToken('not-a-real-token')).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -2) + (token.at(-2) === 'a' ? 'b' : 'a') + token.at(-1);
    expect(verifyAccessToken(tampered)).toBeNull();
  });
});
