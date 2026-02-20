import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    sessionStart: timestamp('session_start', { withTimezone: true }).notNull().defaultNow(),
    sessionEnd: timestamp('session_end', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer('duration_seconds'),
    source: text('source').notNull().default('heartbeat'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_user_sessions_user_id').on(table.userId),
    sessionStartIdx: index('idx_user_sessions_session_start').on(table.sessionStart),
    userStartIdx: index('idx_user_sessions_user_start').on(table.userId, table.sessionStart),
  })
);

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

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    isPrivate: boolean('is_private').notNull().default(false),
    createdBy: uuid('created_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('idx_groups_slug').on(table.slug),
    createdByIdx: index('idx_groups_created_by').on(table.createdBy),
  })
);

export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    groupUserUnique: uniqueIndex('idx_group_members_group_user').on(table.groupId, table.userId),
    groupIdIdx: index('idx_group_members_group_id').on(table.groupId),
  })
);

export const groupInvites = pgTable(
  'group_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    toUserIdx: index('idx_group_invites_to_user_id').on(table.toUserId),
    statusIdx: index('idx_group_invites_status').on(table.status),
  })
);

export const boardInvites = pgTable(
  'board_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull(),
    fromUserId: uuid('from_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    toUserId: uuid('to_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => ({
    boardIdIdx: index('idx_board_invites_board_id').on(table.boardId),
    toUserStatusIdx: index('idx_board_invites_to_user_status').on(table.toUserId, table.status),
  })
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index('idx_notifications_user_created_at').on(table.userId, table.createdAt),
    userReadAtIdx: index('idx_notifications_user_read_at').on(table.userId, table.readAt),
    typeIdx: index('idx_notifications_type').on(table.type),
  })
);

export const groupBoards = pgTable('group_boards', {
  groupId: uuid('group_id').primaryKey().references(() => groups.id, { onDelete: 'cascade' }),
  boardName: text('board_name'),
  location: text('location'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  description: text('description'),
  budget: numeric('budget', { precision: 12, scale: 2 }),
  checklist: jsonb('checklist').notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groupPosts = pgTable(
  'group_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    attachments: jsonb('attachments').notNull().default(sql`'[]'::jsonb`),
    locationName: text('location_name'),
    locationLat: numeric('location_lat', { precision: 9, scale: 6 }),
    locationLng: numeric('location_lng', { precision: 9, scale: 6 }),
    mapEmbedUrl: text('map_embed_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    boardCreatedAtIdx: index('idx_group_posts_board_id_created_at').on(table.boardId, table.createdAt),
    groupCreatedAtIdx: index('idx_group_posts_group_id_created_at').on(table.groupId, table.createdAt),
  })
);

export const groupComments = pgTable(
  'group_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').notNull().references(() => groupPosts.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postCreatedAtIdx: index('idx_group_comments_post_id_created_at').on(table.postId, table.createdAt),
    boardIdx: index('idx_group_comments_board_id').on(table.boardId),
    postIdx: index('idx_group_comments_post_id').on(table.postId),
    groupCreatedAtIdx: index('idx_group_comments_group_id_created_at').on(table.groupId, table.createdAt),
  })
);

export const groupPostMentions = pgTable(
  'group_post_mentions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id').notNull().references(() => groupPosts.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    mentionedUserId: uuid('mentioned_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index('idx_group_post_mentions_post_id').on(table.postId),
    boardIdx: index('idx_group_post_mentions_board_id').on(table.boardId),
    mentionedUserIdx: index('idx_group_post_mentions_mentioned_user_id').on(table.mentionedUserId),
  })
);

export const boardTripDays = pgTable(
  'board_trip_days',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    title: text('title'),
    date: date('date'),
    location: text('location'),
    description: text('description'),
    accommodation: text('accommodation'),
    estimatedBudget: numeric('estimated_budget', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    boardDayIdx: index('idx_board_trip_days_board_day').on(table.boardId, table.dayNumber),
  })
);

export const boardTripActivities = pgTable(
  'board_trip_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dayId: uuid('day_id').notNull().references(() => boardTripDays.id, { onDelete: 'cascade' }),
    time: text('time'),
    title: text('title').notNull(),
    description: text('description'),
    cost: numeric('cost', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dayCreatedAtIdx: index('idx_board_trip_activities_day_created_at').on(table.dayId, table.createdAt),
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
export type UserSessionRow = typeof userSessions.$inferSelect;
export type InsertUserSessionRow = typeof userSessions.$inferInsert;
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
export type GroupRow = typeof groups.$inferSelect;
export type InsertGroupRow = typeof groups.$inferInsert;
export type GroupMemberRow = typeof groupMembers.$inferSelect;
export type InsertGroupMemberRow = typeof groupMembers.$inferInsert;
export type GroupInviteRow = typeof groupInvites.$inferSelect;
export type InsertGroupInviteRow = typeof groupInvites.$inferInsert;
export type BoardInviteRow = typeof boardInvites.$inferSelect;
export type InsertBoardInviteRow = typeof boardInvites.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;
export type InsertNotificationRow = typeof notifications.$inferInsert;
export type GroupBoardRow = typeof groupBoards.$inferSelect;
export type InsertGroupBoardRow = typeof groupBoards.$inferInsert;
export type GroupPostRow = typeof groupPosts.$inferSelect;
export type InsertGroupPostRow = typeof groupPosts.$inferInsert;
export type GroupCommentRow = typeof groupComments.$inferSelect;
export type InsertGroupCommentRow = typeof groupComments.$inferInsert;
export type GroupPostMentionRow = typeof groupPostMentions.$inferSelect;
export type InsertGroupPostMentionRow = typeof groupPostMentions.$inferInsert;
export type BoardTripDayRow = typeof boardTripDays.$inferSelect;
export type InsertBoardTripDayRow = typeof boardTripDays.$inferInsert;
export type BoardTripActivityRow = typeof boardTripActivities.$inferSelect;
export type InsertBoardTripActivityRow = typeof boardTripActivities.$inferInsert;
