#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const q = `
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema IN ('public','auth')
ORDER BY table_schema, table_name, ordinal_position;
`;
    const res = await client.query(q);
    const rows = res.rows;
    const map = {};
    for (const r of rows) {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!map[key]) map[key] = [];
      map[key].push({ name: r.column_name, type: r.data_type, nullable: r.is_nullable, default: r.column_default });
    }

    const keys = Object.keys(map).sort();
    for (const k of keys) {
      console.log(k);
      for (const col of map[k]) {
        const nullable = col.nullable === 'NO' ? ' NOT NULL' : '';
        const def = col.default ? ` DEFAULT ${col.default}` : '';
        console.log(`  - ${col.name}: ${col.type}${nullable}${def}`);
      }
      console.log('');
    }
  } catch (err) {
    console.error('Failed to list schema:', err);
    process.exit(3);
  } finally {
    await client.end().catch(()=>{});
  }
})();
