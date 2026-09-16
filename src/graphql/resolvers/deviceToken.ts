import type { GraphQLContext } from '../context';
import type { RegisterDeviceTokenInput } from '../../services/deviceTokenService';
import { requireUser } from './user';

export const deviceTokenResolvers = {
  Query: {
    myDeviceTokens: (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return ctx.services.deviceTokens.listForUser(user.sub);
    },
  },
  Mutation: {
    registerDeviceToken: (
      _parent: unknown,
      args: { input: RegisterDeviceTokenInput },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      return ctx.services.deviceTokens.register(user.sub, args.input);
    },
    rotateDeviceToken: (
      _parent: unknown,
      args: { oldToken: string; newToken: string },
      ctx: GraphQLContext,
    ) => {
      const user = requireUser(ctx);
      return ctx.services.deviceTokens.rotate(user.sub, args.oldToken, args.newToken);
    },
    revokeDeviceToken: (_parent: unknown, args: { token: string }, ctx: GraphQLContext) => {
      const user = requireUser(ctx);
      return ctx.services.deviceTokens.revoke(user.sub, args.token);
    },
  },
};
