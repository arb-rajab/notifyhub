import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { corsOrigins } from './config/env';
import { authenticateFromHeader } from './auth/extractUser';
import { buildContext, type GraphQLContext } from './graphql/context';

const GRAPHQL_PATH = '/graphql';

const graphqlRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export function createApp(apolloServer: ApolloServer<GraphQLContext>): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins.includes('*') ? true : corsOrigins,
    }),
  );

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(
    GRAPHQL_PATH,
    graphqlRateLimiter,
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const user = authenticateFromHeader(req.headers.authorization);
        return buildContext(user);
      },
    }),
  );

  return app;
}
