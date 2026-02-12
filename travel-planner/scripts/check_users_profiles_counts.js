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
    const u = await client.query('SELECT count(*) FROM public.users');
    const p = await client.query('SELECT count(*) FROM public.profiles');
    console.log('users:', u.rows[0].count, 'profiles:', p.rows[0].count);
    const pairs = await client.query('SELECT count(*) FROM public.users u JOIN public.profiles p ON p.id = u.id');
    console.log('joined user-profile pairs:', pairs.rows[0].count);
  } catch (err) {
    console.error(err.message || err);
  } finally {
    await client.end().catch(()=>{});
  }
})();
