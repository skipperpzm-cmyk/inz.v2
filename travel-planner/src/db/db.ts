import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';


const connectionString = process.env.DATABASE_URL;
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
if (connectionString) {
  // Disable prepare for transaction pool modes as suggested
  // Enable SSL for Supabase poolers if detected
  const sslOption = connectionString.includes('supabase.co') || connectionString.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : undefined;
  _client = postgres(connectionString, { prepare: false, ssl: sslOption });
  _db = drizzle(_client, { schema });
}

export const db = _db;
export const sqlClient = _client;

export function requireDb() {
  if (!db) throw new Error('DATABASE_URL is not set. Please set it in .env.local');
  return db;
}

export default db;
// Note: `lib/db.ts` re-exports this module for backward compatibility.
