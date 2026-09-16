import gql from 'graphql-tag';

export const userTypeDefs = gql`
  enum Role {
    USER
    ADMIN
  }

  type User {
    id: ID!
    email: String!
    displayName: String!
    role: Role!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    email: String!
    password: String!
    displayName: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  extend type Query {
    "The currently authenticated user, or null if unauthenticated."
    me: User
  }

  extend type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
  }
`;
