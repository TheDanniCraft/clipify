import { varchar, pgTable, primaryKey, check } from "drizzle-orm/pg-core";
import type { Role, Plan, StatusOptions, OverlayType } from "@types";
import { uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable("users", {
	id: varchar("id").notNull().primaryKey(),
	email: varchar("email").notNull(),
	username: varchar("username").notNull(),
	avatar: varchar("avatar").notNull(),
	role: varchar("role").$type<Role>().notNull(),
	plan: varchar("plan").$type<Plan>().notNull(),
	stripeCustomerId: varchar("stripe_customer_id"),
});

export const editorsTable = pgTable(
	"editors",
	{
		userId: varchar("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),

		editorId: varchar("editor_id").notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.editorId] }), check("editors_no_self", sql`${t.userId} <> ${t.editorId}`)]
);

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
	rewardId: varchar("reward_id"),
});

export const queueTable = pgTable("clipQueue", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	overlayId: uuid("overlay_id")
		.notNull()
		.references(() => overlaysTable.id, { onDelete: "cascade" }),
	clipId: varchar("clip_id").notNull(),
});

export const modQueueTable = pgTable("modQueue", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	broadcasterId: varchar("broadcaster_id").notNull(),
	clipId: varchar("clip_id").notNull(),
});

export const settingsTable = pgTable("userSettings", {
	id: varchar("id")
		.notNull()
		.primaryKey()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	prefix: varchar("prefix").notNull().default("!"),
});
