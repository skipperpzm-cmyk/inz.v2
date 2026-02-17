#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');

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

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function shortHash(value) {
  if (!value) return '';
  return String(value).slice(0, 12);
}

async function readDbMigrations(client) {
  const tableCheck = await client.query("select to_regclass('public.schema_migrations') as table_name");
  const tableExists = Boolean(tableCheck.rows?.[0]?.table_name);
  if (!tableExists) return new Map();

  const result = await client.query(`
    select file_name, checksum, status, applied_at
    from ${MIGRATION_TABLE}
    order by file_name asc
  `);

  const map = new Map();
  for (const row of result.rows || []) {
    map.set(String(row.file_name), {
      checksum: String(row.checksum || ''),
      status: String(row.status || 'applied'),
      appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
    });
  }
  return map;
}

async function run() {
  const sqlFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  const fileRows = sqlFiles.map((file) => {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      file,
      localChecksum: sha256(content),
    };
  });

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const dbMigrations = await readDbMigrations(client);

    const rows = fileRows.map((item) => {
      const dbEntry = dbMigrations.get(item.file);
      const inDb = Boolean(dbEntry);
      const checksumMatch = inDb ? dbEntry.checksum === item.localChecksum : null;

      let state = 'pending';
      if (inDb && checksumMatch) state = dbEntry.status || 'applied';
      if (inDb && checksumMatch === false) state = 'checksum-mismatch';

      return {
        file: item.file,
        state,
        appliedAt: dbEntry?.appliedAt ?? '-',
        localHash: shortHash(item.localChecksum),
        dbHash: shortHash(dbEntry?.checksum ?? ''),
      };
    });

    const fileSet = new Set(fileRows.map((row) => row.file));
    const dbOnlyRows = [];
    for (const [file, dbEntry] of dbMigrations.entries()) {
      if (fileSet.has(file)) continue;
      dbOnlyRows.push({
        file,
        state: 'db-only',
        appliedAt: dbEntry.appliedAt ?? '-',
        localHash: '',
        dbHash: shortHash(dbEntry.checksum),
      });
    }

    const allRows = [...rows, ...dbOnlyRows].sort((a, b) => a.file.localeCompare(b.file));

    const summary = allRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.state === 'pending') acc.pending += 1;
        else if (row.state === 'checksum-mismatch') acc.mismatch += 1;
        else if (row.state === 'db-only') acc.dbOnly += 1;
        else if (row.state === 'baseline') acc.baseline += 1;
        else acc.applied += 1;
        return acc;
      },
      { total: 0, applied: 0, baseline: 0, pending: 0, mismatch: 0, dbOnly: 0 }
    );

    console.log('Migration status summary:');
    console.log(
      `total=${summary.total}, applied=${summary.applied}, baseline=${summary.baseline}, pending=${summary.pending}, checksumMismatch=${summary.mismatch}, dbOnly=${summary.dbOnly}`
    );
    console.log('');
    console.table(allRows);

    if (summary.mismatch > 0) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Failed to read migration status:', err?.message || err);
  process.exit(1);
});
