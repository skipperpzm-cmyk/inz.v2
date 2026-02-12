const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Configure .env.local or set env var.');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const nulls = await client.query("SELECT count(*) AS cnt FROM public.profiles WHERE public_id IS NULL");
    console.log('profiles with NULL public_id:', nulls.rows[0].cnt);

    const dup = await client.query("SELECT public_id, count(*) FROM public.profiles GROUP BY public_id HAVING count(*) > 1");
    if (dup.rows.length === 0) {
      console.log('No duplicate public_id values found.');
    } else {
      console.warn('Duplicate public_id values:');
      console.table(dup.rows);
    }

    // Test insert to verify trigger assigns a unique public_id
    const testId = randomUUID();
    console.log('Attempting test insert with id', testId);
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        `INSERT INTO public.profiles (id, username, username_display, username_slug, created_at) VALUES ($1,$2,$3,$4,now()) RETURNING public_id`,
        [testId, 'test_public_user', 'test_public_user', 'test_public_user']
      );
      const assigned = insertRes.rows[0]?.public_id;
      console.log('Assigned public_id for test row:', assigned);
      if (!assigned || !/^[0-9]{8}$/.test(assigned)) {
        console.error('Trigger did not assign a valid 8-digit public_id:', assigned);
      } else {
        console.log('Trigger assigned a valid 8-digit public_id.');
      }
      // Rollback the test insert so we don't persist test data
      await client.query('ROLLBACK');
      console.log('Rolled back test insert.');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Test insert failed:', err.message || err);
    }
  } catch (err) {
    console.error('Check failed:', err.message || err);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
