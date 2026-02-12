const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();

    console.log('verify_username_display_slug.js deprecated — slug checks removed.');
    console.log('This script previously validated username_display/username_slug; it is now a no-op.');
    process.exitCode = 0;
  } catch (err) {
    console.error('Verification script failed:', err.message || err);
    process.exitCode = 3;
  } finally {
    await client.end().catch(() => {});
  }

}

run();

