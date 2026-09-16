import type { Server as HttpServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import depthLimit from 'graphql-depth-limit';
import type { GraphQLSchema } from 'graphql';
import { schema as defaultSchema } from './schema';
import type { GraphQLContext } from './context';

const MAX_QUERY_DEPTH = 10;

export interface WsServerLike {
  dispose: () => void | Promise<void>;
}

export function createApolloServer(
  httpServer: HttpServer,
  wsServer: WsServerLike,
  schema: GraphQLSchema = defaultSchema,
): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>({
    schema,
    validationRules: [depthLimit(MAX_QUERY_DEPTH)],
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsServer.dispose();
            },
          };
        },
      },
    ],
  });
}
