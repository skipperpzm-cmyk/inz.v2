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

    // Pick a user with an existing profile
    const ures = await client.query("SELECT u.id, u.username AS before_u, p.username AS before_p FROM public.users u JOIN public.profiles p ON p.id = u.id LIMIT 1");
    if (ures.rowCount === 0) {
      console.error('No user/profile pairs found to test triggers');
      process.exit(2);
    }
    const row = ures.rows[0];
    console.log('Selected user id:', row.id, 'users.username:', row.before_u, 'profiles.username:', row.before_p);

    // Update users.username
    const newUsername = (row.before_u || 'user') + '_triggertest';
    await client.query('UPDATE public.users SET username = $1 WHERE id = $2', [newUsername, row.id]);
    // Wait a moment (triggers run synchronously, but allow small delay)
    await new Promise(r=>setTimeout(r,500));

    const check = await client.query('SELECT username FROM public.profiles WHERE id = $1', [row.id]);
    if (check.rowCount === 0) {
      console.error('Profile not found after update');
      process.exit(3);
    }
    const pUsername = check.rows[0].username;
    console.log('profiles.username after update:', pUsername);
    if (pUsername !== newUsername) {
      console.error('Trigger did not sync profiles.username');
      process.exit(4);
    }

    console.log('Trigger verification succeeded: profiles.username updated to match users.username');

    // Revert change to keep DB tidy
    await client.query('UPDATE public.users SET username = $1 WHERE id = $2', [row.before_u, row.id]);
    await client.query('UPDATE public.profiles SET username = $1 WHERE id = $2', [row.before_p, row.id]);

    console.log('Reverted test changes');
  } catch (err) {
    console.error('Verification error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
