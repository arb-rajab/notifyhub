import http from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { schema } from './graphql/schema';
import { createWebSocketServer } from './graphql/wsServer';
import { createApolloServer } from './graphql/apolloServer';
import { createApp } from './app';
import { prisma } from './db/prisma';

async function main() {
  // Created without a request listener: the WebSocket server attaches its
  // own 'upgrade' listener below, and the Express app is wired in as the
  // HTTP request handler only once Apollo has started.
  const httpServer = http.createServer();

  const wsServer = createWebSocketServer(httpServer, schema);
  const apolloServer = createApolloServer(httpServer, wsServer, schema);
  await apolloServer.start();

  const expressApp = createApp(apolloServer);
  httpServer.on('request', expressApp);

  httpServer.listen(env.PORT, () => {
    logger.info(`notifyhub listening on http://localhost:${env.PORT}/graphql (HTTP + WS)`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`received ${signal}, shutting down`);
    // apolloServer.stop() drains and disposes wsServer via the drainServer
    // plugin hook wired in createApolloServer.
    await apolloServer.stop();
    httpServer.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'failed to start notifyhub');
  process.exit(1);
});
