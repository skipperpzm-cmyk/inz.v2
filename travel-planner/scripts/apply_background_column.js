const fs = require('fs');
const { Client } = require('pg');
(async function(){
  let url;
  try { const content = fs.readFileSync('.env.local','utf8'); const m = content.match(/^DATABASE_URL=(.*)$/m); url = m ? m[1].trim() : process.env.DATABASE_URL; } catch (e) { url = process.env.DATABASE_URL; }
  if (!url) { console.error('No DATABASE_URL'); process.exit(2); }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "background_url" text;');
    console.log('ALTER TABLE applied');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('ALTER error:', err);
    process.exit(1);
  }
})();
