const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');
const { randomUUID } = require('crypto');

(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query('BEGIN');

    const id = randomUUID();
    const email = `migrate-test-${Date.now()}@example.com`;
    const usernameDisplay = `migrate_test_${Date.now()}`;
    const passwordHash = 'x'.repeat(60);

    // Insert user (do not commit)
    await client.query(
      `INSERT INTO public.users (id, email, username, username_display, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5, now())`,
      [id, email, usernameDisplay, usernameDisplay, passwordHash]
    );

    // Insert profile (include legacy username for schemas that enforce it)
    await client.query(
      `INSERT INTO public.profiles (id, username, username_display, created_at)
       VALUES ($1,$2,$3, now())`,
      [id, usernameDisplay, usernameDisplay]
    );

    // If we reached here without error, the schema accepts the fields and uniqueness hasn't triggered.
    console.log('Test insert succeeded (transaction). Rolling back.');
    await client.query('ROLLBACK');
    console.log('Rollback complete. Registration path appears functional for schema-level checks.');
    process.exit(0);
  } catch (err) {
    console.error('Test registration transaction failed:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    process.exit(3);
  } finally {
    await client.end().catch(()=>{});
  }
})();
