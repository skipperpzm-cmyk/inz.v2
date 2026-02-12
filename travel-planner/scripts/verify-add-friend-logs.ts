import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  const match = content.match(/^DATABASE_URL=(.*)$/m);
  if (match) {
    let val = match[1].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env.DATABASE_URL = val;
  }
}

async function main() {
  ensureDatabaseUrl();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not configured. Set it before running this check.');
    process.exit(1);
  }

  const mod = await import('../src/db/db.js');
  const schema = await import('../src/db/schema.js');
  const { requireDb } = mod;
  const { addFriendLogs } = schema as typeof import('../src/db/schema.js');

  const db = requireDb();
  const rows = await db.select().from(addFriendLogs).limit(1);
  console.log('add_friend_logs ok, sample rows:', rows);
}

main().catch((err) => {
  console.error('verify-add-friend-logs failed:', err);
  process.exit(1);
});
