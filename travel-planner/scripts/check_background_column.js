const fs = require('fs');
const { Client } = require('pg');
(async function(){
  let url;
  try {
    const content = fs.readFileSync('.env.local','utf8');
    const m = content.match(/^DATABASE_URL=(.*)$/m);
    url = m ? m[1].trim() : process.env.DATABASE_URL;
  } catch (e) {
    url = process.env.DATABASE_URL;
  }
  if (!url) {
    console.error('No DATABASE_URL');
    process.exit(2);
  }
  const c = new Client({ connectionString: url });
  try {
    await c.connect();
    const res = await c.query("select column_name from information_schema.columns where table_name='users' and column_name='background_url'");
    console.log(res.rows);
    await c.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
