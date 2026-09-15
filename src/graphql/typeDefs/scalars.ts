import gql from 'graphql-tag';

export const scalarTypeDefs = gql`
  """
  ISO-8601 date-time string, e.g. 2026-09-15T21:00:00.000Z.
  """
  scalar DateTime

  """
  Arbitrary JSON payload attached to a notification (e.g. deep-link data).
  """
  scalar JSON
`;
