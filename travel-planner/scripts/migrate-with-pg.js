#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const crypto = require('crypto');

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

const MIGRATION_TABLE = 'public.schema_migrations';

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isDuplicateSchemaError(err) {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('already exists') ||
    message.includes('duplicate key value violates unique constraint') ||
    message.includes('relation') && message.includes('already exists') ||
    message.includes('column') && message.includes('already exists') ||
    message.includes('policy') && message.includes('already exists')
  );
}

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists ${MIGRATION_TABLE} (
      id bigserial primary key,
      file_name text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now(),
      status text not null default 'applied'
    )
  `);
}

async function loadAppliedMigrations(client) {
  const result = await client.query(`select file_name, checksum, status from ${MIGRATION_TABLE}`);
  const map = new Map();
  for (const row of result.rows || []) {
    map.set(String(row.file_name), {
      checksum: String(row.checksum || ''),
      status: String(row.status || 'applied'),
    });
  }
  return map;
}

async function markMigration(client, fileName, hash, status = 'applied') {
  await client.query(
    `
      insert into ${MIGRATION_TABLE} (file_name, checksum, status)
      values ($1, $2, $3)
      on conflict (file_name)
      do update set checksum = excluded.checksum, status = excluded.status, applied_at = now()
    `,
    [fileName, hash, status]
  );
}

async function executeMigrationSql(client, sqlText) {
  const concurrentIndexRegex = /^\s*create\s+(?:unique\s+)?index\s+concurrently[\s\S]*?;/gim;
  const matches = [...sqlText.matchAll(concurrentIndexRegex)];

  if (matches.length === 0) {
    await client.query(sqlText);
    return;
  }

  let cursor = 0;
  for (const match of matches) {
    const index = typeof match.index === 'number' ? match.index : -1;
    if (index < 0) continue;

    const before = sqlText.slice(cursor, index).trim();
    if (before) {
      await client.query(before);
    }

    const statement = match[0].trim();
    if (statement) {
      await client.query(statement);
    }

    cursor = index + match[0].length;
  }

  const tail = sqlText.slice(cursor).trim();
  if (tail) {
    await client.query(tail);
  }
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

  await ensureMigrationTable(client);
  const applied = await loadAppliedMigrations(client);

  for (const file of files) {
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    const hash = checksum(sql);

    const existing = applied.get(file);
    if (existing) {
      if (existing.checksum !== hash) {
        console.warn(
          `Skipping ${file} (already recorded with different checksum). ` +
          'Review migration history before forcing a rerun.'
        );
      } else {
        console.log('Skipping already applied', file);
      }
      continue;
    }

    console.log('Applying', full);
    try {
      await executeMigrationSql(client, sql);
      await markMigration(client, file, hash, 'applied');
      console.log('Applied', file);
    } catch (err) {
      if (isDuplicateSchemaError(err)) {
        console.warn('Migration has existing objects, marking as baseline-applied:', file);
        await markMigration(client, file, hash, 'baseline');
        continue;
      }
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
