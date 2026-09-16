import { rootTypeDefs } from './root';
import { scalarTypeDefs } from './scalars';
import { userTypeDefs } from './user';
import { channelTypeDefs } from './channel';
import { notificationTypeDefs } from './notification';
import { deviceTokenTypeDefs } from './deviceToken';

export const typeDefs = [
  rootTypeDefs,
  scalarTypeDefs,
  userTypeDefs,
  channelTypeDefs,
  notificationTypeDefs,
  deviceTokenTypeDefs,
];
