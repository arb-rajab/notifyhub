import type { GraphQLContext } from '../context';
import { authenticationError } from '../../utils/errors';
import type { RegisterInput, LoginInput } from '../../services/userService';

export const userResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      return ctx.services.users.findById(ctx.user.sub);
    },
  },
  Mutation: {
    register: (_parent: unknown, args: { input: RegisterInput }, ctx: GraphQLContext) =>
      ctx.services.users.register(args.input),
    login: (_parent: unknown, args: { input: LoginInput }, ctx: GraphQLContext) =>
      ctx.services.users.login(args.input),
  },
};

export function requireUser(ctx: GraphQLContext) {
  if (!ctx.user) throw authenticationError();
  return ctx.user;
}
