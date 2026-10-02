import http, { type Server } from 'http';
import type { AddressInfo } from 'net';
import WebSocket from 'ws';
import { createWebSocketServer } from '../../src/graphql/wsServer';

/**
 * Real network test, not a mock: a live `http.Server` with the actual
 * `createWebSocketServer` upgrade handler attached, and real `ws` clients
 * connecting to it. Proves the cap/rate limit is enforced at the
 * WS-upgrade layer itself, since wsServer.ts bypasses Express middleware
 * entirely (see CLAUDE.md's ADR-004 note on why upgrade is wired manually).
 */

function startServer(rateLimiterOptions: {
  limitPerClient: number;
  windowMs: number;
  maxConnections: number;
}): Promise<{ httpServer: Server; url: string; dispose: () => Promise<void> }> {
  return new Promise((resolve) => {
    const httpServer = http.createServer();
    const disposable = createWebSocketServer(httpServer, undefined, rateLimiterOptions);

    httpServer.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address() as AddressInfo;
      resolve({
        httpServer,
        url: `ws://127.0.0.1:${port}/graphql`,
        dispose: async () => {
          await disposable.dispose();
          await new Promise<void>((res) => httpServer.close(() => res()));
        },
      });
    });
  });
}

function connect(url: string): Promise<{ ws: WebSocket; statusCode?: number }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let statusCode: number | undefined;
    ws.on('unexpected-response', (_req, res) => {
      statusCode = res.statusCode;
      resolve({ ws, statusCode });
    });
    ws.on('open', () => resolve({ ws, statusCode: 101 }));
    ws.on('error', (err) => {
      if (statusCode === undefined) reject(err);
    });
  });
}

describe('WebSocket upgrade rate limiting / connection cap', () => {
  it('rejects upgrade attempts beyond the per-client limit with 429', async () => {
    const { url, dispose } = await startServer({
      limitPerClient: 2,
      windowMs: 60_000,
      maxConnections: 1000,
    });

    try {
      const first = await connect(url);
      const second = await connect(url);
      const third = await connect(url);

      expect(first.statusCode).toBe(101);
      expect(second.statusCode).toBe(101);
      expect(third.statusCode).toBe(429);

      first.ws.close();
      second.ws.close();
    } finally {
      await dispose();
    }
  });

  it('rejects new connections beyond the global connection cap with 503', async () => {
    const { url, dispose } = await startServer({
      limitPerClient: 1000,
      windowMs: 60_000,
      maxConnections: 1,
    });

    try {
      const first = await connect(url);
      expect(first.statusCode).toBe(101);

      const second = await connect(url);
      expect(second.statusCode).toBe(503);

      first.ws.close();
    } finally {
      await dispose();
    }
  });
});
