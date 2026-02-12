import { pgTable, uuid, timestamp, foreignKey, text, unique, index, date, integer, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const boardItemStatus = pgEnum("board_item_status", ['todo', 'doing', 'done'])


export const userFriends = pgTable("user_friends", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	friendId: uuid("friend_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const boards = pgTable("boards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tripId: uuid("trip_id").notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tripId],
			foreignColumns: [trips.id],
			name: "boards_trip_id_trips_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	sessionToken: text("session_token").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("sessions_session_token_unique").on(table.sessionToken),
]);

export const boardItems = pgTable("board_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	boardId: uuid("board_id").notNull(),
	title: text().notNull(),
	description: text(),
	status: boardItemStatus().default('todo').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.boardId],
			foreignColumns: [boards.id],
			name: "board_items_board_id_boards_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	usernameDisplay: text("username_display"),
	backgroundUrl: text("background_url"),
	publicId: text("public_id"),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const trips = pgTable("trips", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	description: text(),
	country: text().notNull(),
	city: text(),
	tripType: text("trip_type").notNull(),
	durationDays: integer("duration_days").notNull(),
	status: text().default('planned').notNull(),
	isFavorite: boolean("is_favorite").default(false).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("trips_start_date_idx").using("btree", table.startDate.asc().nullsLast().op("date_ops")),
	index("trips_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("trips_user_id_start_date_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.startDate.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "trips_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const friendInvites = pgTable("friend_invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fromUserId: uuid("from_user_id").notNull(),
	toUserId: uuid("to_user_id").notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	username: text().notNull(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	bio: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	usernameDisplay: text("username_display"),
	usernameSlug: text("username_slug"),
	publicId: text("public_id").notNull(),
	online: boolean().default(false).notNull(),
	lastOnlineAt: timestamp("last_online_at", { withTimezone: true, mode: 'string' }),
});
