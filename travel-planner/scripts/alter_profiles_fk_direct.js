const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');
(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) process.exit(1);
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Dropping constraint profiles_id_fkey if exists...');
    await client.query('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey');
    console.log('Adding FK profiles_public_users_id_fkey if not exists...');
    // Add constraint only if not present
    const exists = await client.query("SELECT 1 FROM pg_constraint WHERE conname = 'profiles_public_users_id_fkey'");
    if (exists.rowCount === 0) {
      await client.query("ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_users_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE");
      console.log('Added constraint.');
    } else {
      console.log('Constraint already exists.');
    }
  } catch (err) { console.error(err); } finally { await client.end(); }
})();
