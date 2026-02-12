const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');
(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) process.exit(1);
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE n.nspname = 'public' AND t.relname = 'profiles';");
    console.log(res.rows);
  } catch (err) { console.error(err); } finally { await client.end(); }
})();
