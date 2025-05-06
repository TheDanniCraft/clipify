import { varchar, pgTable } from "drizzle-orm/pg-core";
import type { Role, Plan, StatusOptions, OverlayType } from "@types";
import { uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
	id: varchar("id").notNull().primaryKey(),
	email: varchar("email").notNull(),
	username: varchar("username").notNull(),
	role: varchar("role").$type<Role>().notNull(),
	plan: varchar("plan").$type<Plan>().notNull(),
});

export const tokenTable = pgTable("tokens", {
	id: varchar("id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" })
		.primaryKey(),
	accessToken: varchar("access_token").notNull(),
	refreshToken: varchar("refresh_token").notNull(),
	expiresAt: varchar("expires_at").notNull(),
	scope: varchar("scope").array().notNull(),
	tokenType: varchar("token_type").notNull(),
});

export const overlaysTable = pgTable("overlays", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	ownerId: varchar("owner_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	name: varchar("name").notNull(),
	status: varchar("status").$type<StatusOptions>().notNull(),
	type: varchar("type").$type<OverlayType>().notNull(),
});
