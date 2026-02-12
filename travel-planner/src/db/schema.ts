import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const boardItemStatus = pgEnum('board_item_status', ['todo', 'doing', 'done']);

/*
  Note: `background_url` is stored on the `users` table as a nullable text column.
  Access pattern:
  - The application always fetches `background_url` together with the user row (by user id).
  - We do NOT query or filter by `background_url` independently.

  Rationale:
  - Do NOT add a standalone index on `background_url` to avoid unnecessary storage
    and write overhead. The primary key index on `id` is sufficient for lookups by user.
  - Consider adding an index only if you introduce queries that filter or sort by
    `background_url` (e.g., find users using a specific background), and after
    measuring query performance and cardinality.
*/
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // Legacy single `username` column kept for compatibility during migration.
  username: text('username').notNull(),
  // New explicit fields for case-preserving display and canonical slug.
  usernameDisplay: text('username_display'),
  // `username_slug` deprecated — slug routing removed. Keep `username_display` only.
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  backgroundUrl: text('background_url'),
  publicId: text('public_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: text('username').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  usernameDisplay: text('username_display'),
  usernameSlug: text('username_slug'),
  publicId: text('public_id').notNull(),
  online: boolean('online').notNull().default(false),
  lastOnlineAt: timestamp('last_online_at', { withTimezone: true }),
});

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    country: text('country').notNull(),
    city: text('city'),
    tripType: text('trip_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    durationDays: integer('duration_days').notNull(),
    status: text('status').notNull().default('planned'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('trips_user_id_idx').on(table.userId),
    startDateIdx: index('trips_start_date_idx').on(table.startDate),
    userStartDateIdx: index('trips_user_id_start_date_idx').on(table.userId, table.startDate),
  })
);

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const boardItems = pgTable('board_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: boardItemStatus('status').notNull().default('todo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: text('session_token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const magicLinks = pgTable(
  'magic_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    emailIdx: index('magic_links_email_idx').on(table.email),
    userIdIdx: index('magic_links_user_id_idx').on(table.userId),
    expiresAtIdx: index('magic_links_expires_at_idx').on(table.expiresAt),
  })
);

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: uuid('receiver_id').references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id'),
  content: text('content'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('sent'),
  type: text('type').notNull().default('text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const friendInvites = pgTable('friend_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromUserId: uuid('from_user_id').notNull(),
  toUserId: uuid('to_user_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userFriends = pgTable('user_friends', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  friendId: uuid('friend_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const addFriendLogs = pgTable(
  'add_friend_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_add_friend_logs_user').on(table.userId),
    createdAtIdx: index('idx_add_friend_logs_created_at').on(table.createdAt),
  })
);

export type UserRow = typeof users.$inferSelect;
export type InsertUserRow = typeof users.$inferInsert;
export type TripRow = typeof trips.$inferSelect;
export type InsertTripRow = typeof trips.$inferInsert;
export type BoardRow = typeof boards.$inferSelect;
export type InsertBoardRow = typeof boards.$inferInsert;
export type BoardItemRow = typeof boardItems.$inferSelect;
export type InsertBoardItemRow = typeof boardItems.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type InsertSessionRow = typeof sessions.$inferInsert;
export type MagicLinkRow = typeof magicLinks.$inferSelect;
export type InsertMagicLinkRow = typeof magicLinks.$inferInsert;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type InsertChatMessageRow = typeof chatMessages.$inferInsert;
export type ProfileRow = typeof profiles.$inferSelect;
export type InsertProfileRow = typeof profiles.$inferInsert;
export type FriendInviteRow = typeof friendInvites.$inferSelect;
export type InsertFriendInviteRow = typeof friendInvites.$inferInsert;
export type UserFriendRow = typeof userFriends.$inferSelect;
export type InsertUserFriendRow = typeof userFriends.$inferInsert;
export type AddFriendLogRow = typeof addFriendLogs.$inferSelect;
export type InsertAddFriendLogRow = typeof addFriendLogs.$inferInsert;
