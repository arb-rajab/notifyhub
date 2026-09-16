import http from 'http';
import type { AddressInfo } from 'net';
import { schema } from '../../src/graphql/schema';
import { createWebSocketServer } from '../../src/graphql/wsServer';
import { createApolloServer } from '../../src/graphql/apolloServer';
import { createApp } from '../../src/app';

export interface TestServer {
  origin: string;
  httpUrl: string;
  wsUrl: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const httpServer = http.createServer();
  const wsServer = createWebSocketServer(httpServer, schema);
  const apolloServer = createApolloServer(httpServer, wsServer, schema);
  await apolloServer.start();

  const app = createApp(apolloServer);
  httpServer.on('request', app);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    origin: `http://localhost:${port}`,
    httpUrl: `http://localhost:${port}/graphql`,
    wsUrl: `ws://localhost:${port}/graphql`,
    close: async () => {
      // apolloServer.stop() drains and disposes wsServer via the
      // drainServer plugin hook wired in createApolloServer - disposing it
      // again here would double-close the underlying WebSocketServer.
      await apolloServer.stop();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
