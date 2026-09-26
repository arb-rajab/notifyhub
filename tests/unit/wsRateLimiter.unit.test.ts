import { WsRateLimiter } from '../../src/graphql/wsRateLimiter';

/**
 * Direct unit test of prune()'s cleanup behavior, complementing the
 * network-level tests in wsRateLimiter.test.ts. Accesses the private
 * `attemptsByClient` map to prove stale entries are actually removed,
 * not just that prune() runs without throwing.
 */
function trackedClientCount(limiter: WsRateLimiter): number {
  return (limiter as unknown as { attemptsByClient: Map<string, number[]> }).attemptsByClient
    .size;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('WsRateLimiter.prune', () => {
  it('removes per-client entries once their attempts fall outside the window', async () => {
    const limiter = new WsRateLimiter({
      limitPerClient: 5,
      windowMs: 50,
      maxConnections: 1000,
    });

    limiter.checkUpgrade('client-a', 0);
    limiter.checkUpgrade('client-b', 0);
    expect(trackedClientCount(limiter)).toBe(2);

    limiter.prune();
    expect(trackedClientCount(limiter)).toBe(2);

    await wait(75);
    limiter.prune();
    expect(trackedClientCount(limiter)).toBe(0);
  });

  it('keeps fresh entries while dropping ones whose window has expired', async () => {
    const limiter = new WsRateLimiter({
      limitPerClient: 5,
      windowMs: 50,
      maxConnections: 1000,
    });

    limiter.checkUpgrade('stale-client', 0);
    await wait(75);

    limiter.checkUpgrade('fresh-client', 0);
    limiter.prune();

    expect(trackedClientCount(limiter)).toBe(1);
  });
});
