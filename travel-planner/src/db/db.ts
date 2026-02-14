import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var __travelPlannerDbClient: ReturnType<typeof postgres> | undefined;
  var __travelPlannerDb: ReturnType<typeof drizzle> | undefined;
}

const connectionString = process.env.DATABASE_URL;
let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
if (connectionString) {
  // Disable prepare for transaction pool modes as suggested
  // Enable SSL for Supabase poolers if detected
  const sslOption = connectionString.includes('supabase.co') || connectionString.includes('supabase.com')
    ? { rejectUnauthorized: false }
    : undefined;

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev && globalThis.__travelPlannerDbClient && globalThis.__travelPlannerDb) {
    _client = globalThis.__travelPlannerDbClient;
    _db = globalThis.__travelPlannerDb;
  } else {
    _client = postgres(connectionString, {
      prepare: false,
      ssl: sslOption,
      max: 5,
      connect_timeout: 8,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
    _db = drizzle(_client, { schema });

    if (isDev) {
      globalThis.__travelPlannerDbClient = _client;
      globalThis.__travelPlannerDb = _db;
    }
  }
}

export const db = _db;
export const sqlClient = _client;

export function requireDb() {
  if (!db) throw new Error('DATABASE_URL is not set. Please set it in .env.local');
  return db;
}

export default db;
// Note: `lib/db.ts` re-exports this module for backward compatibility.
