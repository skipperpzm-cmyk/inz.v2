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

    console.log('check_profiles_username_constraints.js deprecated — slug/index checks removed.');
  } catch (err) {
    console.error('Verification error:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(()=>{});
  }
})();
