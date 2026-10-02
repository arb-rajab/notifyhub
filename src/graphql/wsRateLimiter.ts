/**
 * Connection-attempt rate limiting + concurrent connection cap for the
 * WebSocket upgrade path, which bypasses Express (and therefore
 * `express-rate-limit`) entirely because `wsServer.ts` handles `upgrade`
 * manually. This mirrors the HTTP limiter's shape (fixed window, per
 * client) at the transport layer graphql-ws actually uses.
 */

export interface WsRateLimiterOptions {
  /** Max upgrade attempts a single client (by remote address) may make per window. */
  limitPerClient: number;
  /** Window size in ms for the per-client attempt count. */
  windowMs: number;
  /** Max concurrent open WebSocket connections, across all clients. */
  maxConnections: number;
}

export const defaultWsRateLimiterOptions: WsRateLimiterOptions = {
  limitPerClient: 20,
  windowMs: 60_000,
  maxConnections: 1000,
};

export type WsUpgradeRejectionReason = 'per_client_limit' | 'connection_cap';

export interface WsUpgradeDecision {
  allowed: boolean;
  reason?: WsUpgradeRejectionReason;
}

export class WsRateLimiter {
  private readonly attemptsByClient = new Map<string, number[]>();

  constructor(private readonly options: WsRateLimiterOptions = defaultWsRateLimiterOptions) {}

  /** Call once per upgrade attempt, before accepting the connection. */
  checkUpgrade(clientKey: string, currentConnectionCount: number): WsUpgradeDecision {
    if (currentConnectionCount >= this.options.maxConnections) {
      return { allowed: false, reason: 'connection_cap' };
    }

    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const attempts = (this.attemptsByClient.get(clientKey) ?? []).filter((t) => t > windowStart);

    if (attempts.length >= this.options.limitPerClient) {
      this.attemptsByClient.set(clientKey, attempts);
      return { allowed: false, reason: 'per_client_limit' };
    }

    attempts.push(now);
    this.attemptsByClient.set(clientKey, attempts);
    return { allowed: true };
  }

  /** Drop stale per-client entries so memory doesn't grow unbounded. */
  prune(now: number = Date.now()): void {
    const windowStart = now - this.options.windowMs;
    for (const [key, attempts] of this.attemptsByClient) {
      const kept = attempts.filter((t) => t > windowStart);
      if (kept.length === 0) {
        this.attemptsByClient.delete(key);
      } else {
        this.attemptsByClient.set(key, kept);
      }
    }
  }
}
