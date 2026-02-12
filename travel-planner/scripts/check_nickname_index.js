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
    const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles'");
    console.log('profiles columns:');
    console.log(cols.rows.map(r => r.column_name).join(', '));

    const idx = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='profiles'");
    console.log('\nprofiles indexes:');
    idx.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
