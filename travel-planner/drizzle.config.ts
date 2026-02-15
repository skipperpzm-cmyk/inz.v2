import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env.local');
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  url: DATABASE_URL,
};