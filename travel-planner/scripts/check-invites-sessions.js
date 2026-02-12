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
  const repoRoot = path.join(__dirname, '..');
  const env = loadEnv(path.join(repoRoot, '.env.local'));
  const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) { console.error('No DATABASE_URL'); process.exit(2); }
  const sslOption = connectionString.includes('supabase.co') || connectionString.includes('supabase.com') ? { rejectUnauthorized:false } : undefined;
  const sql = postgres(connectionString, { prepare:false, ssl: sslOption });

  console.log('Sessions:');
  const sessions = await sql`SELECT session_token, user_id, expires_at FROM public.sessions ORDER BY expires_at DESC LIMIT 20`;
  console.table(sessions.map(s=>({token:s.session_token, userId:s.user_id, expiresAt:s.expires_at})));

  console.log('\nProfiles:');
  const profiles = await sql`SELECT id, public_id, username_display, full_name FROM public.profiles ORDER BY created_at DESC LIMIT 20`;
  console.table(profiles.map(p=>({id:p.id, publicId:p.public_id, display:p.username_display, fullName:p.full_name})));

  console.log('\nPending invites:');
  const invites = await sql`SELECT fi.id, fi.from_user_id, fi.to_user_id, fi.status, fi.created_at, p_from.username_display as from_name, p_to.username_display as to_name
    FROM public.friend_invites fi
    LEFT JOIN public.profiles p_from ON p_from.id = fi.from_user_id
    LEFT JOIN public.profiles p_to ON p_to.id = fi.to_user_id
    ORDER BY fi.created_at DESC LIMIT 50`;
  console.table(invites.map(i=>({id:i.id, from:i.from_name||i.from_user_id, to:i.to_name||i.to_user_id, status:i.status, created:i.created_at})));

  await sql.end({ timeout: 10 });
}

main().catch(e=>{console.error(e);process.exit(1)});
