const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { Client } = require('pg');

async function run() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log('Checking pg_policies for public.profiles, public.groups, public.group_members...');
    const policies = await client.query(
      `SELECT schemaname, tablename, policyname, cmd, qual, with_check
       FROM pg_catalog.pg_policies
       WHERE schemaname = 'public' AND tablename IN ('profiles','groups','group_members')
       ORDER BY tablename, policyname`
    );
    if (policies.rowCount === 0) {
      console.log('No policies found for the target tables.');
    } else {
      console.log('Found policies:');
      for (const row of policies.rows) {
        console.log(`- table=${row.tablename} policy=${row.policyname} cmd=${row.cmd}`);
        console.log(`  qual=${row.qual}`);
        console.log(`  with_check=${row.with_check}`);
      }
    }

    console.log('\nChecking triggers on public.profiles, public.groups, public.group_members...');
    const triggers = await client.query(
      `SELECT tg.tgname AS trigger_name, c.relname AS table_name, pg_get_triggerdef(tg.oid) AS definition
       FROM pg_trigger tg
       JOIN pg_class c ON tg.tgrelid = c.oid
       JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND c.relname IN ('profiles','groups','group_members') AND NOT tg.tgisinternal
       ORDER BY c.relname, tg.tgname`
    );

    if (triggers.rowCount === 0) {
      console.log('No non-internal triggers found on those tables.');
    } else {
      console.log('Found triggers:');
      for (const row of triggers.rows) {
        console.log(`- table=${row.table_name} trigger=${row.trigger_name}`);
        console.log(`  def=${row.definition}`);
      }
    }

    console.log('\nChecking trigger functions by name...');
    const fnames = ['create_profile_after_auth_insert','add_group_creator_as_admin'];
    const funcs = await client.query(
      `SELECT n.nspname AS schema, p.proname AS name, pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE p.proname = ANY($1)
       ORDER BY p.proname`,
      [fnames]
    );

    if (funcs.rowCount === 0) {
      console.log('No matching trigger functions found by exact name.');
    } else {
      console.log('Found trigger functions:');
      for (const row of funcs.rows) {
        console.log(`- ${row.schema}.${row.name}`);
        console.log(row.definition.split('\n').slice(0,8).join('\n'));
        console.log('  ...');
      }
    }

  } catch (err) {
    console.error('Check failed:', err.message || err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
