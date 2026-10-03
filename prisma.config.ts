import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read directly instead of via `env()`: `prisma generate` runs where no
    // database exists (Docker build, the lint/typecheck CI job) and must not
    // require DATABASE_URL. Commands that do connect (`migrate deploy`, etc.)
    // still fail if it's unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
