import { varchar, pgTable, check, timestamp, uuid, integer, text, uniqueIndex, primaryKey, index, pgEnum, boolean } from "drizzle-orm/pg-core";
import {
	type Role,
	type Plan,
	type StatusOptions,
	type OverlayType,
	type TwitchCacheType,
	type Entitlement,
	type EntitlementGrantSource,
	type PlaybackMode,
	type MaxDurationMode,
	Role as RoleEnumValues,
	Plan as PlanEnumValues,
	StatusOptions as StatusOptionsEnumValues,
	OverlayType as OverlayTypeEnumValues,
	TwitchCacheType as TwitchCacheTypeEnumValues,
	Entitlement as EntitlementEnumValues,
	EntitlementGrantSource as EntitlementGrantSourceEnumValues,
	PlaybackMode as PlaybackModeEnumValues,
	MaxDurationMode as MaxDurationModeEnumValues,
} from "@types";
import { sql } from "drizzle-orm";

function enumToPgEnum<T extends Record<string, unknown>>(myEnum: T): [T[keyof T], ...T[keyof T][]] {
	return Object.values(myEnum).map((value: unknown) => `${value}`) as [T[keyof T], ...T[keyof T][]];
}

export const roleEnum = pgEnum("role", enumToPgEnum(RoleEnumValues));
export const planEnum = pgEnum("plan", enumToPgEnum(PlanEnumValues));
export const statusOptionsEnum = pgEnum("status_options", enumToPgEnum(StatusOptionsEnumValues));
export const overlayTypeEnum = pgEnum("overlay_type", enumToPgEnum(OverlayTypeEnumValues));
export const playbackModeEnum = pgEnum("playback_mode", enumToPgEnum(PlaybackModeEnumValues));
export const maxDurationModeEnum = pgEnum("max_duration_mode", enumToPgEnum(MaxDurationModeEnumValues));
export const twitchCacheTypeEnum = pgEnum("twitch_cache_type", enumToPgEnum(TwitchCacheTypeEnumValues));
export const entitlementEnum = pgEnum("entitlement", enumToPgEnum(EntitlementEnumValues));
export const entitlementGrantSourceEnum = pgEnum("entitlement_grant_source", enumToPgEnum(EntitlementGrantSourceEnumValues));

export const usersTable = pgTable("users", {
	id: varchar("id").notNull().primaryKey(),
	email: varchar("email").notNull(),
	username: varchar("username").notNull(),
	avatar: varchar("avatar").notNull(),
	role: roleEnum("role").$type<Role>().notNull(),
	plan: planEnum("plan").$type<Plan>().notNull(),
	stripeCustomerId: varchar("stripe_customer_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	lastLogin: timestamp("last_login", { withTimezone: true }),
	lastEntitlementReconciledAt: timestamp("last_entitlement_reconciled_at", { withTimezone: true }),
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
	status: statusOptionsEnum("status").$type<StatusOptions>().notNull(),
	type: overlayTypeEnum("type").$type<OverlayType>().notNull(),
	rewardId: varchar("reward_id"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
	minClipDuration: integer("min_clip_duration").notNull().default(0),
	maxClipDuration: integer("max_clip_duration").notNull().default(60),
	maxDurationMode: maxDurationModeEnum("max_duration_mode").$type<MaxDurationMode>().notNull().default(MaxDurationModeEnumValues.Filter),
	minClipViews: integer("min_clip_views").notNull().default(0),
	blacklistWords: varchar("blacklist_words").array().notNull().default([]),
	playbackMode: playbackModeEnum("playback_mode").$type<PlaybackMode>().notNull().default(PlaybackModeEnumValues.Random),
	preferCurrentCategory: boolean("prefer_current_category").notNull().default(false),
	clipCreatorsOnly: varchar("clip_creators_only").array().notNull().default([]),
	clipCreatorsBlocked: varchar("clip_creators_blocked").array().notNull().default([]),
	clipPackSize: integer("clip_pack_size").notNull().default(100),
	playerVolume: integer("player_volume").notNull().default(50),
	showChannelInfo: boolean("show_channel_info").notNull().default(true),
	showClipInfo: boolean("show_clip_info").notNull().default(true),
	showTimer: boolean("show_timer").notNull().default(false),
	showProgressBar: boolean("show_progress_bar").notNull().default(false),
	overlayInfoFadeOutSeconds: integer("overlay_info_fade_out_seconds").notNull().default(6),
	themeFontFamily: varchar("theme_font_family").notNull().default("inherit"),
	themeTextColor: varchar("theme_text_color").notNull().default("#FFFFFF"),
	themeAccentColor: varchar("theme_accent_color").notNull().default("#7C3AED"),
	themeBackgroundColor: varchar("theme_background_color").notNull().default("rgba(10,10,10,0.65)"),
	progressBarStartColor: varchar("progress_bar_start_color").notNull().default("#26018E"),
	progressBarEndColor: varchar("progress_bar_end_color").notNull().default("#8D42F9"),
	borderSize: integer("border_size").notNull().default(0),
	borderRadius: integer("border_radius").notNull().default(10),
	effectScanlines: boolean("effect_scanlines").notNull().default(false),
	effectStatic: boolean("effect_static").notNull().default(false),
	effectCrt: boolean("effect_crt").notNull().default(false),
	channelInfoX: integer("channel_info_x").notNull().default(0),
	channelInfoY: integer("channel_info_y").notNull().default(0),
	clipInfoX: integer("clip_info_x").notNull().default(100),
	clipInfoY: integer("clip_info_y").notNull().default(100),
	timerX: integer("timer_x").notNull().default(100),
	timerY: integer("timer_y").notNull().default(0),
	channelScale: integer("channel_scale").notNull().default(100),
	clipScale: integer("clip_scale").notNull().default(100),
	timerScale: integer("timer_scale").notNull().default(100),
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
		type: twitchCacheTypeEnum("type").$type<TwitchCacheType>().notNull(),
		key: varchar("key").notNull(),
		value: text("value").notNull(),
		fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
	},
	(t) => [uniqueIndex("twitch_cache_type_key_unique").on(t.type, t.key), index("twitch_cache_expires_at_idx").on(t.expiresAt)],
);

export const entitlementGrantsTable = pgTable(
	"entitlement_grants",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
		entitlement: entitlementEnum("entitlement").$type<Entitlement>().notNull().default(EntitlementEnumValues.ProAccess),
		source: entitlementGrantSourceEnum("source").$type<EntitlementGrantSource>().notNull().default(EntitlementGrantSourceEnumValues.System),
		reason: varchar("reason"),
		startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("entitlement_grants_user_lookup_idx").on(t.userId, t.entitlement, t.startsAt, t.endsAt), index("entitlement_grants_global_lookup_idx").on(t.entitlement, t.startsAt, t.endsAt)],
);
