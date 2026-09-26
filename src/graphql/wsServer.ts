import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Socket } from 'net';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import type { GraphQLSchema } from 'graphql';
import { schema as defaultSchema } from './schema';
import { authenticateFromConnectionParams } from '../auth/extractUser';
import { buildContext } from './context';
import { logger } from '../utils/logger';
import {
  WsRateLimiter,
  defaultWsRateLimiterOptions,
  type WsRateLimiterOptions,
} from './wsRateLimiter';

const WS_PATH = '/graphql';

/**
 * Uses `noServer: true` and wires the 'upgrade' event manually instead of
 * passing `server: httpServer` directly. The latter makes the `ws` library
 * attach its own listener to the http server's 'close' event that re-closes
 * the WebSocketServer - which throws if graphql-ws's dispose() (called
 * during our own graceful shutdown) already closed it first. Manual wiring
 * keeps the two shutdown paths independent.
 */
export function createWebSocketServer(
  httpServer: HttpServer,
  schema: GraphQLSchema = defaultSchema,
  rateLimiterOptions: WsRateLimiterOptions = defaultWsRateLimiterOptions,
) {
  const wss = new WebSocketServer({ noServer: true });
  const rateLimiter = new WsRateLimiter(rateLimiterOptions);

  httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(req.url ?? '', 'http://localhost');
    if (pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    rateLimiter.prune();

    const clientKey = req.socket.remoteAddress ?? 'unknown';
    const decision = rateLimiter.checkUpgrade(clientKey, wss.clients.size);
    if (!decision.allowed) {
      logger.warn(
        { clientKey, reason: decision.reason },
        'websocket upgrade rejected by rate limiter',
      );
      const status =
        decision.reason === 'connection_cap' ? '503 Service Unavailable' : '429 Too Many Requests';
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  const disposable = useServer(
    {
      schema,
      context: (ctx) => {
        const user = authenticateFromConnectionParams(
          ctx.connectionParams as Record<string, unknown> | undefined,
        );
        return buildContext(user);
      },
      onConnect: () => {
        logger.debug('websocket client connected');
      },
      onDisconnect: () => {
        logger.debug('websocket client disconnected');
      },
    },
    wss,
  );

  return disposable;
}
