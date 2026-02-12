import { relations } from "drizzle-orm/relations";
import { trips, boards, users, sessions, boardItems } from "./schema";

export const boardsRelations = relations(boards, ({one, many}) => ({
	trip: one(trips, {
		fields: [boards.tripId],
		references: [trips.id]
	}),
	boardItems: many(boardItems),
}));

export const tripsRelations = relations(trips, ({one, many}) => ({
	boards: many(boards),
	user: one(users, {
		fields: [trips.userId],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	sessions: many(sessions),
	trips: many(trips),
}));

export const boardItemsRelations = relations(boardItems, ({one}) => ({
	board: one(boards, {
		fields: [boardItems.boardId],
		references: [boards.id]
	}),
}));