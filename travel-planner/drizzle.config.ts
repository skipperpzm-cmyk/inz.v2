import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql'
};