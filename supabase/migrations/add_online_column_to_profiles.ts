import { pgTable, boolean } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/node-postgres';

// Define the migration
export async function up(db: any) {
  await db.schema.alterTable('profiles', (table) => {
    table.addColumn('online', boolean().default(false).notNull());
  });
}

export async function down(db: any) {
  await db.schema.alterTable('profiles', (table) => {
    table.dropColumn('online');
  });
}
