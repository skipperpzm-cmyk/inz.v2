const fs = require('fs');
const { Client } = require('pg');
(async function(){
  let url;
  try { const content = fs.readFileSync('.env.local','utf8'); const m = content.match(/^DATABASE_URL=(.*)$/m); url = m ? m[1].trim() : process.env.DATABASE_URL; } catch (e) { url = process.env.DATABASE_URL; }
  if (!url) { console.error('No DATABASE_URL'); process.exit(2); }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();

    console.log('1) Schema check for users.background_url');
    const colRes = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name='users' AND column_name='background_url'`
    );
    if (colRes.rows.length === 0) {
      console.log(' - background_url column: NOT FOUND');
    } else {
      const r = colRes.rows[0];
      console.log(' - column_name:', r.column_name);
      console.log(' - data_type:', r.data_type);
      console.log(' - is_nullable:', r.is_nullable);
    }

    console.log('\n2) Selecting id, email, background_url from users (up to 10 rows)');
    const sel = await client.query('SELECT id, email, background_url FROM users LIMIT 10');
    console.log(' - rows returned:', sel.rowCount);
    sel.rows.forEach((row, i) => {
      console.log(`   [${i}] id=${row.id} email=${row.email} background_url=${row.background_url}`);
    });

    console.log('\n3) Serialization test (JSON stringify)');
    try {
      sel.rows.forEach((row, i) => {
        const obj = { id: row.id, email: row.email, backgroundUrl: row.background_url };
        const json = JSON.stringify(obj);
        // Print truncated JSON for safety
        console.log(`   [${i}] jsonLen=${json.length} jsonSample=${json.slice(0,120)}${json.length>120?"...":''}`);
      });
      console.log(' - Serialization successful for returned rows');
    } catch (err) {
      console.error(' - Serialization error:', err);
    }

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error during verification:', err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
})();
