import gql from 'graphql-tag';

export const deviceTokenTypeDefs = gql`
  enum DevicePlatform {
    IOS
  }

  type DeviceToken {
    id: ID!
    platform: DevicePlatform!
    createdAt: DateTime!
    lastSeenAt: DateTime!
  }

  input RegisterDeviceTokenInput {
    token: String!
    platform: DevicePlatform = IOS
  }

  extend type Query {
    "The caller's currently-active (non-revoked) device tokens."
    myDeviceTokens: [DeviceToken!]!
  }

  extend type Mutation {
    "Registers a device token for push delivery to the caller's account."
    registerDeviceToken(input: RegisterDeviceTokenInput!): DeviceToken!
    "Replaces a device token the caller already owns with a new one (e.g. after APNs rotates it)."
    rotateDeviceToken(oldToken: String!, newToken: String!): DeviceToken!
    "Revokes a device token so it no longer receives push notifications. Returns false if the token was not found."
    revokeDeviceToken(token: String!): Boolean!
  }
`;
