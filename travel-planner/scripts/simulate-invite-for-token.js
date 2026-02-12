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

async function main(){
  const token = process.argv[2];
  if (!token) { console.error('Usage: node simulate-invite-for-token.js <session-token>'); process.exit(2); }
  const repoRoot = path.join(__dirname, '..');
  const env = loadEnv(path.join(repoRoot, '.env.local'));
  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) { console.error('No DATABASE_URL'); process.exit(2); }
  const sslOption = connectionString.includes('supabase.co') || connectionString.includes('supabase.com') ? { rejectUnauthorized:false } : undefined;
  const sql = postgres(connectionString, { prepare:false, ssl: sslOption });

  const row = await sql`SELECT user_id FROM public.sessions WHERE session_token = ${token} LIMIT 1`;
  if (!row || row.length === 0) { console.error('Session not found'); process.exit(3); }
  const userId = row[0].user_id;
  console.log('Session maps to userId', userId);

  const invites = await sql`SELECT fi.id, fi.from_user_id, p.full_name as from_name, fi.status, fi.created_at
    FROM public.friend_invites fi
    LEFT JOIN public.profiles p ON p.id = fi.from_user_id
    WHERE fi.to_user_id = ${userId} AND fi.status = 'pending' ORDER BY fi.created_at DESC`;

  console.log('Invites for user:', invites);
  await sql.end({ timeout: 10 });
}

main().catch(e=>{ console.error(e); process.exit(1); });
