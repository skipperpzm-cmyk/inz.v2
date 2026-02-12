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
    const idx = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='users'");
    console.log('\nusers indexes:');
    idx.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
