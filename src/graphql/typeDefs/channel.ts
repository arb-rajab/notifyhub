import gql from 'graphql-tag';

export const channelTypeDefs = gql`
  type Channel {
    id: ID!
    slug: String!
    name: String!
    description: String
    owner: User!
    subscriberCount: Int!
    "Whether the current viewer is subscribed to this channel. False when unauthenticated."
    isSubscribed: Boolean!
    createdAt: DateTime!
  }

  input CreateChannelInput {
    slug: String!
    name: String!
    description: String
  }

  extend type Query {
    "List channels, optionally filtered by a case-insensitive name/slug search term."
    channels(search: String): [Channel!]!
    channel(slug: String!): Channel
  }

  extend type Mutation {
    "Creates a channel. The caller becomes its owner and is auto-subscribed."
    createChannel(input: CreateChannelInput!): Channel!
    subscribeToChannel(slug: String!): Channel!
    unsubscribeFromChannel(slug: String!): Channel!
  }
`;
