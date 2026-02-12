const fs = require('fs');
const { Client } = require('pg');
(async function(){
  let url;
  try { const content = fs.readFileSync('.env.local','utf8'); const m = content.match(/^DATABASE_URL=(.*)$/m); url = m ? m[1].trim() : process.env.DATABASE_URL; } catch (e) { url = process.env.DATABASE_URL; }
  if (!url) { console.error('No DATABASE_URL'); process.exit(2); }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "background_url";');
    console.log('DROP COLUMN applied');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('DROP error:', err);
    try { await client.end(); } catch(e) {}
    process.exit(1);
  }
})();
