const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');

(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();

    // Find an auth user that has a profile
    const q = `SELECT u.id, u.username AS before_u, p.username AS before_p
      FROM auth.users u JOIN public.profiles p ON p.id = u.id LIMIT 1`;
    const res = await client.query(q);
    if (res.rowCount === 0) {
      console.error('No auth.user/profile pairs found to test triggers');
      process.exit(2);
    }
    const row = res.rows[0];
    console.log('Selected auth user id:', row.id, 'auth.username:', row.before_u, 'profiles.username:', row.before_p);

    const newUsername = (row.before_u || 'user') + '_authtrig';
    await client.query('UPDATE auth.users SET raw_user_meta = raw_user_meta WHERE id = $1', [row.id]); // noop to ensure permissions
    await client.query('UPDATE auth.users SET username = $1 WHERE id = $2', [newUsername, row.id]);
    await new Promise(r => setTimeout(r, 500));

    const check = await client.query('SELECT username FROM public.profiles WHERE id = $1', [row.id]);
    if (check.rowCount === 0) {
      console.error('Profile not found after auth.users update');
      process.exit(3);
    }
    const pUsername = check.rows[0].username;
    console.log('profiles.username after auth.users update:', pUsername);
    if (pUsername !== newUsername) {
      console.error('Auth trigger did not sync profiles.username');
      process.exit(4);
    }

    console.log('Auth trigger verification succeeded: profiles.username updated to match auth.users.username');

    // Revert changes
    await client.query('UPDATE auth.users SET username = $1 WHERE id = $2', [row.before_u, row.id]);
    await client.query('UPDATE public.profiles SET username = $1 WHERE id = $2', [row.before_p, row.id]);
    console.log('Reverted test changes');
  } catch (err) {
    console.error('Verification error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
