import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Socket } from 'net';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import type { GraphQLSchema } from 'graphql';
import { schema as defaultSchema } from './schema';
import { authenticateFromConnectionParams } from '../auth/extractUser';
import { buildContext } from './context';
import { logger } from '../utils/logger';

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
) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(req.url ?? '', 'http://localhost');
    if (pathname !== WS_PATH) {
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
