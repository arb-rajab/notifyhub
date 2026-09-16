import { GraphQLError } from 'graphql';

export function authenticationError(message = 'You must be signed in to do this.'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED' } });
}

export function forbiddenError(message = 'You are not allowed to do this.'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'FORBIDDEN' } });
}

export function notFoundError(message = 'Not found.'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'NOT_FOUND' } });
}

export function userInputError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

export function conflictError(message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'CONFLICT' } });
}
