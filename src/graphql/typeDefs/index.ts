import { rootTypeDefs } from './root';
import { scalarTypeDefs } from './scalars';
import { userTypeDefs } from './user';
import { channelTypeDefs } from './channel';
import { notificationTypeDefs } from './notification';

export const typeDefs = [
  rootTypeDefs,
  scalarTypeDefs,
  userTypeDefs,
  channelTypeDefs,
  notificationTypeDefs,
];
