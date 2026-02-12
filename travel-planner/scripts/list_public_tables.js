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
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Public tables in DB:');
    console.log(res.rows.map(r => r.table_name).join('\n'));
  } catch (err) {
    console.error('Failed to list tables:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
