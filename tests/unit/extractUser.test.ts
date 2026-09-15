import { extractBearerToken, authenticateFromConnectionParams } from '../../src/auth/extractUser';
import { signAccessToken } from '../../src/auth/jwt';

describe('extractBearerToken', () => {
  it('extracts the token from a well-formed header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null for a missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for a header without the Bearer prefix', () => {
    expect(extractBearerToken('abc.def.ghi')).toBeNull();
  });
});

describe('authenticateFromConnectionParams', () => {
  it('authenticates using a lowercase or uppercase authorization key', () => {
    const token = signAccessToken({ sub: 'u1', email: 'a@b.com', role: 'USER' });
    expect(authenticateFromConnectionParams({ authorization: `Bearer ${token}` })?.sub).toBe('u1');
    expect(authenticateFromConnectionParams({ Authorization: `Bearer ${token}` })?.sub).toBe('u1');
  });

  it('returns null when connectionParams carry no credentials', () => {
    expect(authenticateFromConnectionParams(undefined)).toBeNull();
    expect(authenticateFromConnectionParams({})).toBeNull();
  });
});
