const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const k = trimmed.substring(0, idx).trim();
    const v = trimmed.substring(idx + 1).trim();
    out[k] = v.replace(/^"|"$/g, '');
  }
  return out;
}

async function main() {
  try {
    const repoRoot = path.join(__dirname, '..');
    const env = loadEnv(path.join(repoRoot, '.env.local'));
    const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('DATABASE_URL not found in .env.local or environment');
      process.exit(2);
    }

    const sslOption = connectionString.includes('supabase.co') || connectionString.includes('supabase.com')
      ? { rejectUnauthorized: false }
      : undefined;

    const sql = postgres(connectionString, { prepare: false, ssl: sslOption });

    console.log('Connected to DB, selecting two profiles with public_id...');
    const profiles = await sql`SELECT id, public_id, username_display, full_name FROM public.profiles WHERE public_id IS NOT NULL LIMIT 2`;
    if (!Array.isArray(profiles) || profiles.length < 2) {
      console.error('Need at least two profiles with public_id to test. Found:', profiles.length);
      process.exit(3);
    }

    const from = profiles[0].id;
    const to = profiles[1].id;
    console.log('Using from:', profiles[0].public_id, profiles[0].username_display || profiles[0].full_name);
    console.log('Using to:', profiles[1].public_id, profiles[1].username_display || profiles[1].full_name);

    try {
      const inserted = await sql`INSERT INTO public.friend_invites (from_user_id, to_user_id) VALUES (${from}, ${to}) RETURNING id, from_user_id, to_user_id, status, created_at`;
      console.log('Insert result:', inserted);
    } catch (err) {
      console.error('Insert error:', err && err.message ? err.message : String(err));
    }

    const pending = await sql`SELECT fi.id, fi.from_user_id, p.full_name as from_name, fi.status, fi.created_at
                              FROM public.friend_invites fi
                              LEFT JOIN public.profiles p ON p.id = fi.from_user_id
                              WHERE fi.to_user_id = ${to} AND fi.status = 'pending' ORDER BY fi.created_at DESC`;
    console.log('Pending invites for recipient:', pending);

    await sql.end({ timeout: 10 });
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

main();
