#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local first, then fallback to any .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('Error: DATABASE_URL is not set.');
  console.error('Set DATABASE_URL in your environment or in .env.local (copy .env.example -> .env.local).');
  process.exit(1);
}

// Run all numeric migrations in drizzle/ in ascending order (idempotent SQL files expected)
(async () => {
  const migrationsDir = path.resolve(process.cwd(), 'drizzle');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Error: drizzle directory not found:', migrationsDir);
    process.exit(1);
  }

  const files = (await fs.promises.readdir(migrationsDir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  if (files.length === 0) {
    console.log('No SQL migrations found in', migrationsDir);
    process.exit(0);
  }

  console.log('Running SQL migrations from:', migrationsDir);
  console.log(`Using DATABASE_URL: ${dbUrl.startsWith('postgres') ? dbUrl.split('@')[0] + '@...' : dbUrl}`);

  // Sequentially run each migration file with psql
  for (const file of files) {
    const sqlFile = path.join(migrationsDir, file);
    console.log('Applying:', sqlFile);
    if (!fs.existsSync(sqlFile)) {
      console.error('Migration file missing:', sqlFile);
      process.exit(1);
    }
    // spawn psql synchronously-style by awaiting a promise
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('psql', ['-d', dbUrl, '-f', sqlFile], { stdio: 'inherit' });
        child.on('error', (err) => reject(err));
        child.on('exit', (code) => (code === 0 ? resolve(null) : reject(new Error(`psql exited with ${code}`))));
      });
    } catch (err) {
      console.error('Failed to apply migration:', file, err.message || err);
      process.exit(1);
    }
  }

  console.log('All migrations applied (or already present).');
  process.exit(0);
})();
