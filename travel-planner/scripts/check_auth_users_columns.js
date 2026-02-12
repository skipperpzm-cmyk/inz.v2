const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const r = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='auth' AND table_name='users'");
    console.log('auth.users columns:', r.rows.map(x=>x.column_name));
  } catch (e) { console.error(e); process.exit(1); } finally { await client.end().catch(()=>{}); }
})();
