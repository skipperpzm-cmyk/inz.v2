import { pgTable, boolean, text } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  online: boolean('online').default(false).notNull(),
  // ...existing columns...
});
