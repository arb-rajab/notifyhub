import gql from 'graphql-tag';

export const notificationTypeDefs = gql`
  type Notification {
    id: ID!
    title: String!
    body: String!
    metadata: JSON
    channel: Channel!
    author: User!
    createdAt: DateTime!
  }

  input PublishNotificationInput {
    channelSlug: String!
    title: String!
    body: String!
    metadata: JSON
  }

  extend type Query {
    "Most recent notifications on a channel, newest first."
    notifications(channelSlug: String!, limit: Int = 20): [Notification!]!
  }

  extend type Mutation {
    "Publishes a notification to a channel. Caller must be subscribed to the channel."
    publishNotification(input: PublishNotificationInput!): Notification!
  }

  extend type Subscription {
    """
    Real-time stream of notifications published to a channel. The caller must
    be authenticated and subscribed to the channel to receive events.
    """
    notificationReceived(channelSlug: String!): Notification!
  }
`;
