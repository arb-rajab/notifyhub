import request from 'supertest';

export interface GraphQLResponseBody<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export async function graphqlRequest<T = unknown>(
  origin: string,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GraphQLResponseBody<T>> {
  const req = request(origin).post('/graphql').set('Content-Type', 'application/json');
  if (token) req.set('Authorization', `Bearer ${token}`);
  const res = await req.send({ query, variables });
  return res.body as GraphQLResponseBody<T>;
}
