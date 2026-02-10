import { varchar, pgTable, check, timestamp, uuid, integer, text, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import type { Role, Plan, StatusOptions, OverlayType, TwitchCacheType } from "@types";
import { sql } from "drizzle-orm";

export const usersTable = pgTable("users", {
	id: varchar("id").notNull().primaryKey(),
	email: varchar("email").notNull(),
	username: varchar("username").notNull(),
	avatar: varchar("avatar").notNull(),
	role: varchar("role").$type<Role>().notNull(),
	plan: varchar("plan").$type<Plan>().notNull(),
	stripeCustomerId: varchar("stripe_customer_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	lastLogin: timestamp("last_login", { withTimezone: true }),
});

export const editorsTable = pgTable(
	"editors",
	{
		userId: varchar("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),

		editorId: varchar("editor_id").notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.editorId] }), check("editors_no_self", sql`${t.userId} <> ${t.editorId}`)],
);

export const tokenTable = pgTable("tokens", {
	id: varchar("id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" })
		.primaryKey(),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	scope: text("scope").array().notNull(),
	tokenType: varchar("token_type").notNull(),
});

export const overlaysTable = pgTable("overlays", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	ownerId: varchar("owner_id")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	secret: varchar("secret").notNull().default(""),
	name: varchar("name").notNull(),
	status: varchar("status").$type<StatusOptions>().notNull(),
	type: varchar("type").$type<OverlayType>().notNull(),
	rewardId: varchar("reward_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	minClipDuration: integer("min_clip_duration").notNull().default(0),
	maxClipDuration: integer("max_clip_duration").notNull().default(60),
	minClipViews: integer("min_clip_views").notNull().default(0),
	blacklistWords: varchar("blacklist_words").array().notNull().default([]),
});

export const queueTable = pgTable("clipQueue", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	overlayId: uuid("overlay_id")
		.notNull()
		.references(() => overlaysTable.id, { onDelete: "cascade" }),
	clipId: varchar("clip_id").notNull(),
	queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
});

export const modQueueTable = pgTable("modQueue", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	broadcasterId: varchar("broadcaster_id").notNull(),
	clipId: varchar("clip_id").notNull(),
	queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settingsTable = pgTable("userSettings", {
	id: varchar("id")
		.notNull()
		.primaryKey()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	prefix: varchar("prefix").notNull().default("!"),
});

export const twitchCacheTable = pgTable(
	"twitchCache",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		type: varchar("type").$type<TwitchCacheType>().notNull(),
		key: varchar("key").notNull(),
		value: text("value").notNull(),
		fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("twitch_cache_type_key_unique").on(t.type, t.key)],
);
