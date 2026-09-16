process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://notifyhub:notifyhub_dev_pw@localhost:5432/notifyhub_test?schema=public';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test-only-secret-not-for-production-0123456789abcdef';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
process.env.PORT = process.env.PORT ?? '4001';
