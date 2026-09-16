import { hashPassword, verifyPassword } from '../../src/auth/password';

describe('password hashing', () => {
  it('hashes a password to something other than the plain value', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toEqual('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a matching password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', hash)).resolves.toBe(false);
  });
});
