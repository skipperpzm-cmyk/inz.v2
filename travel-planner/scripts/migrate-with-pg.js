#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Configure .env.local or set env var.');
  process.exit(1);
}

const migrationsDir = path.resolve(process.cwd(), 'drizzle');
if (!fs.existsSync(migrationsDir)) {
  console.error('Error: drizzle directory not found at', migrationsDir);
  process.exit(1);
}

async function run() {
  const files = fs.readdirSync(migrationsDir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  if (!files.length) {
    console.log('No migration files found in', migrationsDir);
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
  } catch (err) {
    console.error('Failed to connect to database:', err.message || err);
    process.exit(1);
  }

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    console.log('Applying', full);
    try {
      const sql = fs.readFileSync(full, 'utf8');
      // Execute SQL; rely on idempotent statements (IF NOT EXISTS) inside files
      await client.query(sql);
      console.log('Applied', file);
    } catch (err) {
      console.error('Migration failed for', file, err.message || err);
      await client.end().catch(() => {});
      process.exit(1);
    }
  }

  // Verification: check for background_url column
  try {
    const colRes = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='background_url'"
    );
    if (colRes.rowCount > 0) {
      console.log('Verification: background_url column exists on users table.');
    } else {
      console.warn('Verification: background_url column NOT found on users table.');
    }

    // Sample row
    const sample = await client.query('SELECT background_url FROM users LIMIT 1');
    console.log('Sample query returned', sample.rowCount, 'rows.');
    if (sample.rowCount > 0) console.dir(sample.rows[0]);
  } catch (err) {
    console.error('Verification queries failed:', err.message || err);
  }

  await client.end();
  console.log('Migrations complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
