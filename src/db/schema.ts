import { varchar, pgTable, check, timestamp, uuid, integer, bigint, text, uniqueIndex, unique, primaryKey, foreignKey, index, pgEnum, boolean, jsonb, customType } from "drizzle-orm/pg-core";
import {
	type Role,
	type Plan,
	type RunnerStatus,
	type StreamMode,
	type StreamState,
	type StatusOptions,
	type OverlayType,
	type TwitchCacheType,
	type Entitlement,
	type EntitlementGrantSource,
	type BillingProduct,
	type PlaybackMode,
	type MaxDurationMode,
	type GallerySource,
	type GalleryLayout,
	type GalleryLiveSort,
	type GalleryTimeWindow,
	type GalleryTheme,
	Role as RoleEnumValues,
	Plan as PlanEnumValues,
	RunnerStatus as RunnerStatusEnumValues,
	StreamMode as StreamModeEnumValues,
	StreamState as StreamStateEnumValues,
	StatusOptions as StatusOptionsEnumValues,
	OverlayType as OverlayTypeEnumValues,
	TwitchCacheType as TwitchCacheTypeEnumValues,
	Entitlement as EntitlementEnumValues,
	EntitlementGrantSource as EntitlementGrantSourceEnumValues,
	PlaybackMode as PlaybackModeEnumValues,
	MaxDurationMode as MaxDurationModeEnumValues,
} from "@types";
import { sql } from "drizzle-orm";
import { badgeSlugs } from "@lib/badgeCatalog";
import type { StreamDetails } from "@/app/lib/runnerProviderDetails";
import type { Permission } from "@/auth/permissions";
import { organization as authOrganizationTable, user as authUserTable } from "./auth-schema";

function enumToPgEnum<T extends Record<string, unknown>>(myEnum: T): [T[keyof T], ...T[keyof T][]] {
	return Object.values(myEnum).map((value: unknown) => `${value}`) as [T[keyof T], ...T[keyof T][]];
}

export const roleEnum = pgEnum("role", enumToPgEnum(RoleEnumValues));
export const planEnum = pgEnum("plan", enumToPgEnum(PlanEnumValues));
export const runnerStatusEnum = pgEnum("runner_status", enumToPgEnum(RunnerStatusEnumValues));
export const runnerWatermarkCornerEnum = pgEnum("runner_watermark_corner", ["top_left", "top_right", "bottom_left", "bottom_right"]);
export const streamModeEnum = pgEnum("stream_mode", enumToPgEnum(StreamModeEnumValues));
export const streamControlModeEnum = pgEnum("stream_control_mode", ["manual", "scheduled"]);
export const streamStateEnum = pgEnum("stream_state", enumToPgEnum(StreamStateEnumValues));
export const statusOptionsEnum = pgEnum("status_options", enumToPgEnum(StatusOptionsEnumValues));
export const overlayTypeEnum = pgEnum("overlay_type", enumToPgEnum(OverlayTypeEnumValues));
export const playbackModeEnum = pgEnum("playback_mode", enumToPgEnum(PlaybackModeEnumValues));
export const maxDurationModeEnum = pgEnum("max_duration_mode", enumToPgEnum(MaxDurationModeEnumValues));
export const twitchCacheTypeEnum = pgEnum("twitch_cache_type", enumToPgEnum(TwitchCacheTypeEnumValues));
export const entitlementEnum = pgEnum("entitlement", enumToPgEnum(EntitlementEnumValues));
export const entitlementGrantSourceEnum = pgEnum("entitlement_grant_source", enumToPgEnum(EntitlementGrantSourceEnumValues));
export const accountDisableTypeEnum = pgEnum("account_disable_type", ["manual", "automatic"]);
export const gallerySourceEnum = pgEnum("gallery_source", ["curated", "live"]);
export const galleryLayoutEnum = pgEnum("gallery_layout", ["grid", "list", "carousel"]);
export const galleryLiveSortEnum = pgEnum("gallery_live_sort", ["newest", "most_viewed", "stable_random"]);
export const galleryTimeWindowEnum = pgEnum("gallery_time_window", ["today", "7d", "30d", "all", "custom"]);
export const galleryThemeEnum = pgEnum("gallery_theme", ["light", "dark", "system"]);
export const badgeEnum = pgEnum("badge", badgeSlugs);

export const memberNumberAllocatorTable = pgTable(
	"member_number_allocator",
	{
		id: integer("id").primaryKey(),
		legacyReservedThrough: integer("legacy_reserved_through").notNull(),
		lastAllocated: integer("last_allocated").notNull(),
	},
	(t) => [check("member_number_allocator_singleton", sql`${t.id} = 1`), check("member_number_allocator_range", sql`${t.legacyReservedThrough} >= 0 AND ${t.lastAllocated} >= ${t.legacyReservedThrough}`)],
);

export const usersTable = pgTable(
	"users",
	{
		id: varchar("id").notNull().primaryKey(),
		email: varchar("email").notNull(),
		username: varchar("username").notNull(),
		avatar: varchar("avatar").notNull(),
		role: roleEnum("role").$type<Role>().notNull(),
		plan: planEnum("plan").$type<Plan>().notNull(),
		disabled: boolean("disabled").notNull().default(false),
		disableType: accountDisableTypeEnum("disable_type"),
		disabledAt: timestamp("disabled_at", { withTimezone: true }),
		disabledReason: varchar("disabled_reason"),
		stripeCustomerId: varchar("stripe_customer_id"),
		memberNumber: integer("member_number"),
		// Set only when the Twitch account trigger creates a new creator.
		onboardingPending: boolean("onboarding_pending").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		twitchCreatedAt: timestamp("twitch_created_at", { withTimezone: true })
			.default(sql`'2016-05-01T00:00:00.000Z'::timestamptz`)
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		lastLogin: timestamp("last_login", { withTimezone: true }),
		lastEntitlementReconciledAt: timestamp("last_entitlement_reconciled_at", { withTimezone: true }),
	},
	(t) => [
		uniqueIndex("users_member_number_unique")
			.on(t.memberNumber)
			.where(sql`${t.memberNumber} > 0`),
	],
);

export const userBadgesTable = pgTable(
	"user_badges",
	{
		userId: varchar("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		badge: badgeEnum("badge").notNull(),
		awardedAt: timestamp("awarded_at", { withTimezone: true }).defaultNow().notNull(),
		awardedBy: varchar("awarded_by"),
		source: varchar("source", { length: 80 }),
	},
	(t) => [primaryKey({ columns: [t.userId, t.badge] }), index("user_badges_badge_idx").on(t.badge)],
);

export const userContentStatesTable = pgTable(
	"user_content_states",
	{
		userId: varchar("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		contentKey: varchar("content_key").notNull(),
		state: varchar("state").notNull(),
		stateUntil: timestamp("state_until", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.contentKey] })],
);

export const creatorAccountStatusEnum = pgEnum("creator_account_status", ["active", "suspension_scheduled", "suspended", "purge_eligible"]);
export const creatorIdentityLinkSourceEnum = pgEnum("creator_identity_link_source", ["migration", "twitch_onboarding", "admin_repair"]);
export const agencyAccountStatusEnum = pgEnum("agency_account_status", ["provisioned", "owner_invited", "active", "suspended", "closed"]);
export const agencyBillingStatusEnum = pgEnum("agency_billing_status", ["pending", "incomplete", "trialing", "active", "past_due", "unpaid", "paused", "canceled"]);
export const agencyBillingCollectionMethodEnum = pgEnum("agency_billing_collection_method", ["charge_automatically", "send_invoice"]);
export const agencyCreatorLinkStatusEnum = pgEnum("agency_creator_link_status", ["proposed", "accepted", "revoked"]);
export const agencyLicenseAllocationStatusEnum = pgEnum("agency_license_allocation_status", ["active", "removal_scheduled", "ended", "released_by_deletion"]);
export const agencyLicenseProductEnum = pgEnum("agency_license_product", ["creator_pro"]);
export const accountDeletionChoiceEnum = pgEnum("account_deletion_choice", ["paid_through", "immediate"]);
export const accountDeletionStatusEnum = pgEnum("account_deletion_status", ["scheduled", "suspended", "recovered", "purge_eligible", "purged", "cancelled"]);
export const auditOutcomeEnum = pgEnum("audit_outcome", ["success", "denied", "error"]);
export const rateLimitSignalEnum = pgEnum("rate_limit_signal", ["identity", "network"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "claimed", "sent", "retry", "dead"]);

export const creatorAccountsTable = pgTable("creator_accounts", {
	organizationId: text("organization_id")
		.primaryKey()
		.references(() => authOrganizationTable.id, { onDelete: "cascade" }),
	creatorId: varchar("creator_id")
		.unique("creator_accounts_creator_unique")
		.notNull()
		.references(() => usersTable.id, { onDelete: "cascade" }),
	status: creatorAccountStatusEnum("status").notNull().default("active"),
	suspensionAt: timestamp("suspension_at", { withTimezone: true }),
	purgeEligibleAt: timestamp("purge_eligible_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const creatorIdentityLinksTable = pgTable(
	"creator_identity_links",
	{
		creatorId: varchar("creator_id")
			.primaryKey()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		authUserId: text("auth_user_id")
			.notNull()
			.references(() => authUserTable.id, { onDelete: "cascade" }),
		source: creatorIdentityLinkSourceEnum("source").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("creator_identity_links_auth_user_idx").on(table.authUserId)],
);

export const agencyAccountsTable = pgTable(
	"agency_accounts",
	{
		organizationId: text("organization_id")
			.primaryKey()
			.references(() => authOrganizationTable.id, { onDelete: "cascade" }),
		status: agencyAccountStatusEnum("status").notNull().default("provisioned"),
		commercialReference: varchar("commercial_reference", { length: 160 }),
		creatorSeatLimit: integer("creator_seat_limit").notNull().default(0),
		provisionedBy: text("provisioned_by").references(() => authUserTable.id, { onDelete: "set null" }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [check("agency_accounts_seat_limit_nonnegative", sql`${table.creatorSeatLimit} >= 0`), check("agency_accounts_commercial_reference_non_secret", sql`${table.commercialReference} IS NULL OR ${table.commercialReference} !~* '(bearer[[:space:]]+|token=|password=|secret=|credential=)'`)],
);

export const agencyBillingAccountsTable = pgTable(
	"agency_billing_accounts",
	{
		organizationId: text("organization_id")
			.primaryKey()
			.references(() => agencyAccountsTable.organizationId, { onDelete: "cascade" }),
		billingEmail: varchar("billing_email", { length: 320 }).notNull(),
		status: agencyBillingStatusEnum("status").notNull().default("pending"),
		collectionMethod: agencyBillingCollectionMethodEnum("collection_method").notNull().default("charge_automatically"),
		daysUntilDue: integer("days_until_due"),
		stripeCustomerId: varchar("stripe_customer_id").unique(),
		stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
		stripeSubscriptionScheduleId: varchar("stripe_subscription_schedule_id").unique(),
		creatorSeatPriceId: varchar("creator_seat_price_id").notNull(),
		creatorSeatItemId: varchar("creator_seat_item_id"),
		creatorSeatMinimum: integer("creator_seat_minimum").notNull(),
		creatorSeatQuantity: integer("creator_seat_quantity").notNull(),
		pendingCreatorSeatQuantity: integer("pending_creator_seat_quantity"),
		currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
		currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
		latestStripeEventCreated: bigint("latest_stripe_event_created", { mode: "number" }).notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("agency_billing_status_idx").on(table.status), check("agency_billing_creator_minimum_nonnegative", sql`${table.creatorSeatMinimum} >= 0`), check("agency_billing_creator_quantity_nonnegative", sql`${table.creatorSeatQuantity} >= 0`), check("agency_billing_invoice_terms", sql`(${table.collectionMethod} = 'send_invoice' AND ${table.daysUntilDue} BETWEEN 1 AND 90) OR (${table.collectionMethod} = 'charge_automatically' AND ${table.daysUntilDue} IS NULL)`)],
);

export const agencyCreatorLinksTable = pgTable(
	"agency_creator_links",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		agencyOrganizationId: text("agency_organization_id")
			.notNull()
			.references(() => authOrganizationTable.id, { onDelete: "cascade" }),
		creatorOrganizationId: text("creator_organization_id")
			.notNull()
			.references(() => authOrganizationTable.id, { onDelete: "cascade" }),
		status: agencyCreatorLinkStatusEnum("status").notNull().default("proposed"),
		permissionCeiling: jsonb("permission_ceiling").$type<Permission[]>().notNull().default([]),
		proposedBy: text("proposed_by").references(() => authUserTable.id, { onDelete: "set null" }),
		proposedAt: timestamp("proposed_at", { withTimezone: true }).defaultNow().notNull(),
		acceptedBy: text("accepted_by").references(() => authUserTable.id, { onDelete: "set null" }),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		revokedBy: text("revoked_by").references(() => authUserTable.id, { onDelete: "set null" }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("agency_creator_links_live_pair_unique")
			.on(table.agencyOrganizationId, table.creatorOrganizationId)
			.where(sql`${table.status} <> 'revoked'`),
		index("agency_creator_links_creator_status_idx").on(table.creatorOrganizationId, table.status),
		check("agency_creator_links_distinct_accounts", sql`${table.agencyOrganizationId} <> ${table.creatorOrganizationId}`),
		check("agency_creator_links_ceiling_array", sql`jsonb_typeof(${table.permissionCeiling}) = 'array'`),
		check("agency_creator_links_acceptance_state", sql`(${table.status} <> 'accepted') OR (${table.acceptedBy} IS NOT NULL AND ${table.acceptedAt} IS NOT NULL)`),
		check("agency_creator_links_revocation_state", sql`(${table.status} <> 'revoked') OR (${table.revokedBy} IS NOT NULL AND ${table.revokedAt} IS NOT NULL)`),
	],
);

export const agencyLicenseAllocationsTable = pgTable(
	"agency_license_allocations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		linkId: uuid("link_id")
			.notNull()
			.references(() => agencyCreatorLinksTable.id, { onDelete: "cascade" }),
		creatorId: varchar("creator_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		status: agencyLicenseAllocationStatusEnum("status").notNull().default("active"),
		product: agencyLicenseProductEnum("product").notNull().default("creator_pro"),
		effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
		removalRequestedAt: timestamp("removal_requested_at", { withTimezone: true }),
		endsAt: timestamp("ends_at", { withTimezone: true }),
		sourceReference: varchar("source_reference", { length: 160 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("agency_license_allocations_live_creator_unique")
			.on(table.creatorId, table.product)
			.where(sql`${table.status} IN ('active', 'removal_scheduled')`),
		index("agency_license_allocations_link_status_idx").on(table.linkId, table.status),
		index("agency_license_allocations_due_idx").on(table.status, table.endsAt),
		check("agency_license_allocations_grace_state", sql`(${table.status} <> 'removal_scheduled') OR (${table.removalRequestedAt} IS NOT NULL AND ${table.endsAt} IS NOT NULL AND ${table.endsAt} > ${table.removalRequestedAt})`),
		check("agency_license_allocations_source_non_secret", sql`${table.sourceReference} !~* '(bearer[[:space:]]+|token=|password=|secret=|credential=)'`),
	],
);

export const accountDeletionRequestsTable = pgTable(
	"account_deletion_requests",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => authOrganizationTable.id, { onDelete: "cascade" }),
		choice: accountDeletionChoiceEnum("choice").notNull(),
		status: accountDeletionStatusEnum("status").notNull(),
		requestedBy: text("requested_by").references(() => authUserTable.id, { onDelete: "set null" }),
		requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
		suspensionAt: timestamp("suspension_at", { withTimezone: true }).notNull(),
		suspendedAt: timestamp("suspended_at", { withTimezone: true }),
		purgeEligibleAt: timestamp("purge_eligible_at", { withTimezone: true }),
		recoveredBy: text("recovered_by").references(() => authUserTable.id, { onDelete: "set null" }),
		recoveredAt: timestamp("recovered_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		purgedAt: timestamp("purged_at", { withTimezone: true }),
		stripeSnapshot: jsonb("stripe_snapshot").$type<Record<string, unknown>>().notNull().default({}),
		version: integer("version").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("account_deletion_requests_nonterminal_unique")
			.on(table.organizationId)
			.where(sql`${table.status} IN ('scheduled', 'suspended', 'purge_eligible')`),
		index("account_deletion_requests_status_time_idx").on(table.status, table.suspensionAt, table.purgeEligibleAt),
		check("account_deletion_requests_version_positive", sql`${table.version} > 0`),
		check("account_deletion_requests_purge_after_suspend", sql`${table.purgeEligibleAt} IS NULL OR (${table.suspendedAt} IS NOT NULL AND ${table.purgeEligibleAt} >= ${table.suspendedAt})`),
		check("account_deletion_requests_snapshot_object", sql`jsonb_typeof(${table.stripeSnapshot}) = 'object'`),
		check("account_deletion_requests_snapshot_redacted", sql`${table.stripeSnapshot}::text !~* '"[^"]*(secret|token|password|credential|authorization|cookie|otp|code)[^"]*"[[:space:]]*:'`),
	],
);

export const auditEventsTable = pgTable(
	"audit_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
		actorUserId: text("actor_user_id").references(() => authUserTable.id, { onDelete: "set null" }),
		actorSessionId: text("actor_session_id"),
		accountOrganizationId: text("account_organization_id").references(() => authOrganizationTable.id, { onDelete: "set null" }),
		targetType: varchar("target_type", { length: 80 }).notNull(),
		targetId: text("target_id"),
		action: varchar("action", { length: 120 }).notNull(),
		outcome: auditOutcomeEnum("outcome").notNull(),
		reason: varchar("reason", { length: 160 }),
		correlationId: varchar("correlation_id", { length: 120 }).notNull(),
		ipPrefix: varchar("ip_prefix", { length: 80 }),
		userAgentFamily: varchar("user_agent_family", { length: 120 }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
	},
	(table) => [
		index("audit_events_account_time_idx").on(table.accountOrganizationId, table.occurredAt),
		index("audit_events_actor_time_idx").on(table.actorUserId, table.occurredAt),
		index("audit_events_correlation_idx").on(table.correlationId),
		check("audit_events_metadata_object", sql`jsonb_typeof(${table.metadata}) = 'object'`),
		check("audit_events_metadata_size", sql`octet_length(${table.metadata}::text) <= 16384`),
		check("audit_events_metadata_secret_redacted", sql`${table.metadata}::text !~* '"[^\"]*(secret|token|password|credential|authorization|cookie|otp|code)[^\"]*"[[:space:]]*:'`),
	],
);

export const rateLimitCountersTable = pgTable(
	"rate_limit_counters",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		action: varchar("action", { length: 120 }).notNull(),
		signalType: rateLimitSignalEnum("signal_type").notNull(),
		signalHash: varchar("signal_hash", { length: 64 }).notNull(),
		count: integer("count").notNull().default(0),
		windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("rate_limit_counter_signal_unique").on(table.action, table.signalType, table.signalHash), index("rate_limit_counter_expiry_idx").on(table.expiresAt), check("rate_limit_counter_nonnegative", sql`${table.count} >= 0`)],
);

export const notificationOutboxTable = pgTable(
	"notification_outbox",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eventType: varchar("event_type", { length: 80 }).notNull(),
		recipient: varchar("recipient", { length: 320 }).notNull(),
		authorityOrganizationId: text("authority_organization_id").references(() => authOrganizationTable.id, { onDelete: "set null" }),
		templateVersion: varchar("template_version", { length: 40 }).notNull(),
		locale: varchar("locale", { length: 20 }).notNull().default("en"),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
		status: notificationStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		claimedBy: varchar("claimed_by", { length: 120 }),
		claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
		providerMessageId: varchar("provider_message_id", { length: 200 }),
		lastError: varchar("last_error", { length: 500 }),
		dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("notification_outbox_dedupe_unique").on(table.dedupeKey),
		index("notification_outbox_claim_idx").on(table.status, table.scheduledAt, table.claimExpiresAt),
		check("notification_outbox_attempts_nonnegative", sql`${table.attempts} >= 0`),
		check("notification_outbox_payload_object", sql`jsonb_typeof(${table.payload}) = 'object'`),
		check("notification_outbox_payload_secret_redacted", sql`${table.payload}::text !~* '"[^\"]*(secret|token|password|credential|authorization|cookie|otp|code)[^\"]*"[[:space:]]*:'`),
	],
);

export const overlaysTable = pgTable(
	"overlays",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		secret: varchar("secret").notNull().default(""),
		name: varchar("name").notNull(),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		status: statusOptionsEnum("status").$type<StatusOptions>().notNull(),
		type: overlayTypeEnum("type").$type<OverlayType>().notNull(),
		playlistId: uuid("playlist_id").references(() => playlistsTable.id, { onDelete: "set null" }),
		rewardId: varchar("reward_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		minClipDuration: integer("min_clip_duration").notNull().default(0),
		maxClipDuration: integer("max_clip_duration").notNull().default(60),
		maxDurationMode: maxDurationModeEnum("max_duration_mode").$type<MaxDurationMode>().notNull().default(MaxDurationModeEnumValues.Filter),
		minClipViews: integer("min_clip_views").notNull().default(0),
		blacklistWords: varchar("blacklist_words").array().notNull().default([]),
		categoriesOnly: varchar("categories_only").array().notNull().default([]),
		categoriesBlocked: varchar("categories_blocked").array().notNull().default([]),
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
	},
	(table) => [check("overlays_revision_positive", sql`${table.configurationRevision} > 0`)],
);

/** Durable provider intents committed with the overlay configuration. */
export const overlayEffectJobsTable = pgTable(
	"overlay_effect_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		overlayId: uuid("overlay_id")
			.notNull()
			.references(() => overlaysTable.id, { onDelete: "cascade" }),
		creatorId: varchar("creator_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		rewardId: varchar("reward_id", { length: 255 }).notNull(),
		configurationRevision: integer("configuration_revision").notNull(),
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
		claimedBy: uuid("claimed_by"),
		claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
		lastError: varchar("last_error", { length: 80 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("overlay_effect_revision_unique").on(table.overlayId, table.configurationRevision), index("overlay_effect_due_idx").on(table.status, table.scheduledAt, table.claimExpiresAt), check("overlay_effect_revision_positive", sql`${table.configurationRevision} > 0`), check("overlay_effect_attempts_nonnegative", sql`${table.attempts} >= 0`), check("overlay_effect_status_valid", sql`${table.status} IN ('pending','claimed','retry','done','obsolete')`)],
);

export const playlistsTable = pgTable(
	"playlists",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		name: varchar("name").notNull(),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [check("playlists_revision_positive", sql`${table.configurationRevision} > 0`)],
);

export const playlistClipsTable = pgTable(
	"playlist_clips",
	{
		playlistId: uuid("playlist_id")
			.notNull()
			.references(() => playlistsTable.id, { onDelete: "cascade" }),
		clipId: varchar("clip_id").notNull(),
		position: integer("position").notNull(),
		clipData: text("clip_data").notNull(),
		addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [primaryKey({ columns: [t.playlistId, t.clipId] }), index("playlist_clips_position_idx").on(t.playlistId, t.position)],
);

export const galleriesTable = pgTable(
	"galleries",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		name: varchar("name").notNull(),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		published: boolean("published").notNull().default(false),
		source: gallerySourceEnum("source").$type<GallerySource>().notNull().default("curated"),
		playlistId: uuid("playlist_id").references(() => playlistsTable.id, { onDelete: "set null" }),

		layout: galleryLayoutEnum("layout").$type<GalleryLayout>().notNull().default("grid"),
		gridAuto: boolean("grid_auto").notNull().default(true),
		gridMobileColumns: integer("grid_mobile_columns").notNull().default(1),
		gridTabletColumns: integer("grid_tablet_columns").notNull().default(3),
		gridDesktopColumns: integer("grid_desktop_columns").notNull().default(4),
		listDensity: varchar("list_density").notNull().default("comfortable"),
		carouselMobileCards: integer("carousel_mobile_cards").notNull().default(1),
		carouselTabletCards: integer("carousel_tablet_cards").notNull().default(2),
		carouselDesktopCards: integer("carousel_desktop_cards").notNull().default(3),
		carouselShowNavigation: boolean("carousel_show_navigation").notNull().default(true),
		carouselShowIndicators: boolean("carousel_show_indicators").notNull().default(true),
		showTitle: boolean("show_title").notNull().default(true),
		showCreator: boolean("show_creator").notNull().default(true),
		showViews: boolean("show_views").notNull().default(true),
		showDuration: boolean("show_duration").notNull().default(true),
		showCreatedAt: boolean("show_created_at").notNull().default(false),

		liveSort: galleryLiveSortEnum("live_sort").$type<GalleryLiveSort>().notNull().default("newest"),
		liveTimeWindow: galleryTimeWindowEnum("live_time_window").$type<GalleryTimeWindow>().notNull().default("30d"),
		liveCustomStart: timestamp("live_custom_start", { withTimezone: true }),
		liveCustomEnd: timestamp("live_custom_end", { withTimezone: true }),
		liveResultLimit: integer("live_result_limit").notNull().default(12),
		includeCategories: varchar("include_categories").array().notNull().default([]),
		excludeCategories: varchar("exclude_categories").array().notNull().default([]),
		minimumViews: integer("minimum_views").notNull().default(0),
		minimumDuration: integer("minimum_duration").notNull().default(0),
		maximumDuration: integer("maximum_duration").notNull().default(0),
		titleBlacklist: varchar("title_blacklist").array().notNull().default([]),
		creatorAllowlist: varchar("creator_allowlist").array().notNull().default([]),
		creatorBlocklist: varchar("creator_blocklist").array().notNull().default([]),

		theme: galleryThemeEnum("theme").$type<GalleryTheme>().notNull().default("system"),
		accentColor: varchar("accent_color").notNull().default("#7C3AED"),
		backgroundMode: varchar("background_mode").notNull().default("transparent"),
		backgroundColor: varchar("background_color").notNull().default("#000000"),
		cardSurfaceColor: varchar("card_surface_color").notNull().default("#18181B"),
		textColor: varchar("text_color").notNull().default("#FFFFFF"),
		cardRadius: integer("card_radius").notNull().default(16),
		gap: integer("gap").notNull().default(16),
		thumbnailTreatment: varchar("thumbnail_treatment").notNull().default("cover"),
		modalBackdrop: varchar("modal_backdrop").notNull().default("rgba(0,0,0,0.72)"),
		desktopModalWidth: integer("desktop_modal_width").notNull().default(960),

		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("galleries_owner_created_at_idx").on(t.ownerId, t.createdAt), index("galleries_playlist_idx").on(t.playlistId), check("galleries_revision_positive", sql`${t.configurationRevision} > 0`)],
);

export const queueTable = pgTable(
	"clipQueue",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		overlayId: uuid("overlay_id")
			.notNull()
			.references(() => overlaysTable.id, { onDelete: "cascade" }),
		clipId: varchar("clip_id").notNull(),
		queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("clip_queue_overlay_queued_at_idx").on(t.overlayId, t.queuedAt)],
);

export const modQueueTable = pgTable(
	"modQueue",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		broadcasterId: varchar("broadcaster_id").notNull(),
		clipId: varchar("clip_id").notNull(),
		queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("mod_queue_broadcaster_queued_at_idx").on(t.broadcasterId, t.queuedAt)],
);

export const settingsTable = pgTable(
	"userSettings",
	{
		id: varchar("id")
			.notNull()
			.primaryKey()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		prefix: varchar("prefix").notNull().default("!"),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
		marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
		marketingOptInSource: varchar("marketing_opt_in_source"),
		useSendProductUpdatesContactId: varchar("usesend_product_updates_contact_id"),
		showOnCommunityPage: boolean("show_in_community").notNull().default(false),
		creatorPageEnabled: boolean("creator_page_enabled").notNull().default(true),
		// Null preserves the old Community Page choice during rollout: true maps to
		// discoverable and false maps to unlisted. Newly-created settings explicitly
		// store "discoverable".
		creatorPageVisibility: varchar("creator_page_visibility"),
		creatorPageShowBio: boolean("creator_page_show_bio").notNull().default(true),
		creatorPageSocialTitle: varchar("creator_page_social_title"),
		creatorPageSocialDescription: varchar("creator_page_social_description"),
	},
	(table) => [check("creator_page_revision_positive", sql`${table.configurationRevision} > 0`)],
);

export const plausibleStatsCacheTable = pgTable(
	"plausible_stats_cache",
	{
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		cacheKey: varchar("cache_key").notNull(),
		value: text("value").notNull(),
		fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
	},
	(t) => [primaryKey({ columns: [t.ownerId, t.cacheKey] }), index("plausible_stats_cache_expiry_idx").on(t.expiresAt)],
);

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
	(t) => [
		uniqueIndex("twitch_cache_type_key_unique").on(t.type, t.key),
		index("twitch_cache_expires_at_idx").on(t.expiresAt),
		index("twitch_cache_clip_validation_idx")
			.on(t.fetchedAt)
			.where(sql`${t.type} = 'clip' AND ${t.key} LIKE 'clip:%' AND ${t.value}::jsonb ? 'lastValidatedAt'`),
	],
);

export const clipCrawlJobsTable = pgTable(
	"clip_crawl_jobs",
	{
		creatorId: varchar("creator_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		kind: varchar("kind").$type<"recent" | "backfill">().notNull(),
		nextRunAt: timestamp("next_run_at", { withTimezone: true }),
		requestedAt: timestamp("requested_at", { withTimezone: true }),
		leaseId: uuid("lease_id"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		attempts: integer("attempts").notNull().default(0),
		failures: integer("failures").notNull().default(0),
		lastError: text("last_error"),
		lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.creatorId, table.kind] }),
		check("clip_crawl_job_kind", sql`${table.kind} IN ('recent', 'backfill')`),
		check("clip_crawl_job_attempts", sql`${table.attempts} >= 0 AND ${table.failures} >= 0`),
		check("clip_crawl_job_lease_pair", sql`(${table.leaseId} IS NULL) = (${table.leaseExpiresAt} IS NULL)`),
		index("clip_crawl_jobs_due_idx")
			.on(table.nextRunAt, table.creatorId, table.kind)
			.where(sql`${table.nextRunAt} IS NOT NULL`),
		index("clip_crawl_jobs_manual_idx")
			.on(table.nextRunAt, table.creatorId, table.kind)
			.where(sql`${table.requestedAt} IS NOT NULL`),
	],
);

export const entitlementGrantsTable = pgTable(
	"entitlement_grants",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		userId: varchar("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
		entitlement: entitlementEnum("entitlement").$type<Entitlement>().notNull().default(EntitlementEnumValues.ProAccess),
		source: entitlementGrantSourceEnum("source").$type<EntitlementGrantSource>().notNull().default(EntitlementGrantSourceEnumValues.System),
		reason: varchar("reason"),
		externalReference: varchar("external_reference"),
		startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("entitlement_grants_user_lookup_idx").on(t.userId, t.entitlement, t.startsAt, t.endsAt), index("entitlement_grants_global_lookup_idx").on(t.entitlement, t.startsAt, t.endsAt), uniqueIndex("entitlement_grants_external_ref_unique").on(t.source, t.externalReference, t.entitlement)],
);

export const adminImpersonationSessionsTable = pgTable(
	"admin_impersonation_sessions",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		adminUserId: varchar("admin_user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		targetUserId: varchar("target_user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
		endedAt: timestamp("ended_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("admin_impersonation_sessions_admin_idx").on(t.adminUserId, t.startedAt), index("admin_impersonation_sessions_target_idx").on(t.targetUserId, t.startedAt)],
);

export const billingSubscriptionsTable = pgTable(
	"billing_subscriptions",
	{
		id: varchar("id").notNull().primaryKey(),
		userId: varchar("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		stripeCustomerId: varchar("stripe_customer_id").notNull(),
		status: varchar("status").notNull(),
		currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
		currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		canceledAt: timestamp("canceled_at", { withTimezone: true }),
		latestStripeEventCreated: bigint("latest_stripe_event_created", { mode: "number" }).notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("billing_subscriptions_user_idx").on(t.userId), index("billing_subscriptions_customer_status_idx").on(t.stripeCustomerId, t.status)],
);

export const billingSubscriptionItemsTable = pgTable(
	"billing_subscription_items",
	{
		id: varchar("id").notNull().primaryKey(),
		subscriptionId: varchar("subscription_id")
			.notNull()
			.references(() => billingSubscriptionsTable.id, { onDelete: "cascade" }),
		productKey: varchar("product_key").$type<BillingProduct>().notNull(),
		stripeProductId: varchar("stripe_product_id").notNull(),
		stripePriceId: varchar("stripe_price_id").notNull(),
		unitAmount: integer("unit_amount"),
		currency: varchar("currency").notNull(),
		billingInterval: varchar("billing_interval").notNull(),
		quantity: integer("quantity").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [uniqueIndex("billing_subscription_product_unique").on(t.subscriptionId, t.productKey), index("billing_subscription_items_product_idx").on(t.productKey)],
);

export const billingWebhookEventsTable = pgTable("billing_webhook_events", {
	id: varchar("id").notNull().primaryKey(),
	eventType: varchar("event_type").notNull(),
	status: varchar("status").notNull().default("processing"),
	lastError: text("last_error"),
	retryCount: integer("retry_count").notNull().default(0),
	receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
	processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
	processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const runnersTable = pgTable(
	"runners",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		name: varchar("name").notNull(),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		token: varchar("token").notNull().unique(),
		status: runnerStatusEnum("status").$type<RunnerStatus>().notNull().default(RunnerStatusEnumValues.Offline),
		lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
		osInfo: varchar("os_info"),
		version: varchar("version"),
		protocolVersion: integer("protocol_version").notNull().default(1),
		capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
		lastAcknowledgedConfigRevision: integer("last_acknowledged_config_revision"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [check("runners_revision_positive", sql`${table.configurationRevision} > 0`), unique("runners_owner_id_unique").on(table.ownerId, table.id)],
);

const runnerAssetBytes = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea";
	},
	toDriver(value) {
		return value;
	},
	fromDriver(value) {
		return Buffer.from(value);
	},
});
export const runnerBrandingAssetsTable = pgTable(
	"runner_branding_assets",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		kind: varchar("kind", { length: 10 }).notNull(),
		normalizedMime: varchar("normalized_mime", { length: 20 }).notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		checksum: varchar("checksum", { length: 64 }).notNull(),
		bytes: runnerAssetBytes("bytes").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique("runner_branding_assets_owner_id_unique").on(table.ownerId, table.id),
		check("runner_branding_assets_kind_valid", sql`${table.kind} IN ('logo','background')`),
		check("runner_branding_assets_mime_valid", sql`${table.normalizedMime} IN ('image/png','image/jpeg','image/webp')`),
		check("runner_branding_assets_bounds_valid", sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 2097152 AND octet_length(${table.bytes}) = ${table.sizeBytes} AND ${table.width} > 0 AND ${table.width} <= 4096 AND ${table.height} > 0 AND ${table.height} <= 4096 AND ${table.width}::bigint * ${table.height} <= 16000000`),
	],
);

export const runnerBrandingProfilesTable = pgTable(
	"runner_branding_profiles",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		runnerId: uuid("runner_id").notNull(),
		watermarkCorner: runnerWatermarkCornerEnum("watermark_corner").notNull().default("bottom_right"),
		proShowAttribution: boolean("pro_show_attribution").notNull().default(false),
		standbyBackgroundColor: varchar("standby_background_color", { length: 7 }).notNull().default("#000000"),
		backgroundAssetId: uuid("background_asset_id"),
		logoAssetId: uuid("logo_asset_id"),
		message: varchar("message", { length: 160 }).notNull().default(""),
		showNextBroadcastTime: boolean("show_next_broadcast_time").notNull().default(false),
		revision: integer("revision").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.ownerId, table.backgroundAssetId], foreignColumns: [runnerBrandingAssetsTable.ownerId, runnerBrandingAssetsTable.id] }),
		foreignKey({ columns: [table.ownerId, table.logoAssetId], foreignColumns: [runnerBrandingAssetsTable.ownerId, runnerBrandingAssetsTable.id] }),
		uniqueIndex("runner_branding_profiles_runner_unique").on(table.runnerId),
		foreignKey({ columns: [table.ownerId, table.runnerId], foreignColumns: [runnersTable.ownerId, runnersTable.id] }).onDelete("cascade"),
		check("runner_branding_profiles_revision_positive", sql`${table.revision} > 0`),
	],
);

export const runnerEnrollmentsTable = pgTable(
	"runner_enrollments",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		deviceCode: varchar("device_code").notNull().unique(),
		userCode: varchar("user_code").notNull().unique(),
		apiBase: varchar("api_base").notNull(),
		hostname: varchar("hostname"),
		osInfo: varchar("os_info"),
		version: varchar("version"),
		ownerId: varchar("owner_id").references(() => usersTable.id, { onDelete: "cascade" }),
		runnerId: uuid("runner_id").references(() => runnersTable.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => [index("runner_enrollments_device_code_idx").on(t.deviceCode), index("runner_enrollments_user_code_idx").on(t.userCode), index("runner_enrollments_expires_at_idx").on(t.expiresAt)],
);

export const streamSessionsTable = pgTable(
	"stream_sessions",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		runnerId: uuid("runner_id").references(() => runnersTable.id, { onDelete: "set null" }),
		overlayId: uuid("overlay_id")
			.notNull()
			.references(() => overlaysTable.id, { onDelete: "cascade" }),
		mode: streamModeEnum("mode").$type<StreamMode>().notNull(),
		controlMode: streamControlModeEnum("control_mode").notNull().default("manual"),
		testExpiresAt: timestamp("test_expires_at", { withTimezone: true }),
		automationPausedAt: timestamp("automation_paused_at", { withTimezone: true }),
		automationRevision: integer("automation_revision").notNull().default(0),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		encryptedStreamKey: text("encrypted_stream_key"),
		rtmpUrl: varchar("rtmp_url").notNull().default("rtmp://live.twitch.tv/app"),
		desiredState: streamStateEnum("desired_state").$type<StreamState>().notNull().default(StreamStateEnumValues.Stopped),
		actualState: streamStateEnum("actual_state").$type<StreamState>().notNull().default(StreamStateEnumValues.Stopped),
		resolution: varchar("resolution").notNull().default("1080p"),
		fps: integer("fps").notNull().default(60),
		lastError: text("last_error"),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [unique("stream_sessions_owner_identity").on(table.ownerId, table.id), check("stream_sessions_revision_positive", sql`${table.configurationRevision} > 0`), check("stream_sessions_automation_revision_nonnegative", sql`${table.automationRevision} >= 0`), check("stream_sessions_scheduled_clips_only", sql`${table.controlMode} <> 'scheduled' OR ${table.mode} = '24/7'`)],
);

export const runnerDestinationProviderEnum = pgEnum("runner_destination_provider", ["youtube", "twitch", "custom"]);
export const runnerProviderConnectionsTable = pgTable(
	"runner_provider_connections",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		provider: runnerDestinationProviderEnum("provider").notNull(),
		channelId: varchar("channel_id", { length: 128 }).notNull(),
		channelName: varchar("channel_name", { length: 120 }).notNull(),
		encryptedTokens: text("encrypted_tokens").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [unique("runner_provider_connections_owner_channel").on(table.ownerId, table.provider, table.channelId), unique("runner_provider_connections_owner_identity").on(table.ownerId, table.id), check("runner_provider_connections_supported", sql`${table.provider} IN ('twitch','youtube')`)],
);
export const runnerProviderStatesTable = pgTable(
	"runner_provider_states",
	{
		digest: varchar("digest", { length: 64 }).primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		authUserId: varchar("auth_user_id").notNull(),
		sessionId: varchar("session_id").notNull(),
		provider: runnerDestinationProviderEnum("provider").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => [index("runner_provider_states_expiry").on(table.expiresAt)],
);
export const runnerDestinationsTable = pgTable(
	"runner_destinations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 80 }).notNull(),
		provider: runnerDestinationProviderEnum("provider").notNull(),
		rtmpUrl: text("rtmp_url").notNull(),
		encryptedStreamKey: text("encrypted_stream_key"),
		connectionId: uuid("connection_id"),
		providerStreamId: varchar("provider_stream_id", { length: 128 }),
		credentialRevision: integer("credential_revision").notNull().default(1),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		foreignKey({ columns: [table.ownerId, table.connectionId], foreignColumns: [runnerProviderConnectionsTable.ownerId, runnerProviderConnectionsTable.id] }),
		unique("runner_destinations_owner_identity").on(table.ownerId, table.id),
		index("runner_destinations_owner_created").on(table.ownerId, table.createdAt),
		check("runner_destinations_name_length", sql`char_length(trim(${table.name})) BETWEEN 1 AND 80`),
		check("runner_destinations_url_length", sql`char_length(${table.rtmpUrl}) BETWEEN 1 AND 4096`),
		check("runner_destinations_revisions_positive", sql`${table.credentialRevision} > 0 AND ${table.configurationRevision} > 0`),
	],
);

export const streamSessionDestinationsTable = pgTable(
	"stream_session_destinations",
	{
		sessionId: uuid("session_id").notNull(),
		destinationId: uuid("destination_id").notNull(),
		ownerId: varchar("owner_id").notNull(),
		position: integer("position").notNull(),
	},
	(table) => [primaryKey({ columns: [table.sessionId, table.destinationId] }), foreignKey({ columns: [table.ownerId, table.sessionId], foreignColumns: [streamSessionsTable.ownerId, streamSessionsTable.id] }).onDelete("cascade"), foreignKey({ columns: [table.ownerId, table.destinationId], foreignColumns: [runnerDestinationsTable.ownerId, runnerDestinationsTable.id] }).onDelete("cascade"), check("stream_session_destinations_position_nonnegative", sql`${table.position} >= 0`)],
);

export const runnerAdmissionStateEnum = pgEnum("runner_admission_state", ["authorized", "reserved", "starting", "active", "draining", "uncertain", "stopped", "failed_before_output"]);
export const runnerScheduleRecurrenceEnum = pgEnum("runner_schedule_recurrence", ["once", "weekly"]);
export const runnerScheduleEventsTable = pgTable(
	"runner_schedule_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		runnerId: uuid("runner_id")
			.notNull()
			.references(() => runnersTable.id, { onDelete: "cascade" }),
		sessionId: uuid("session_id").notNull(),
		overlayId: uuid("overlay_id")
			.notNull()
			.references(() => overlaysTable.id, { onDelete: "cascade" }),
		title: varchar("title", { length: 80 }).notNull(),
		setStreamDetails: boolean("set_stream_details").notNull().default(false),
		streamDetails: jsonb("stream_details").$type<StreamDetails[]>().notNull().default([]),
		timezone: varchar("timezone", { length: 128 }).notNull(),
		recurrence: runnerScheduleRecurrenceEnum("recurrence").notNull(),
		recurrenceAnchor: varchar("recurrence_anchor", { length: 80 }).notNull(),
		weekdayAnchors: jsonb("weekday_anchors").$type<{ weekday: number; anchor: string }[]>().notNull().default([]),
		excludedDates: jsonb("excluded_dates").$type<string[]>().notNull().default([]),
		seriesParentId: uuid("series_parent_id"),
		originalOccurrenceDate: varchar("original_occurrence_date", { length: 10 }),
		repeatUntilDate: varchar("repeat_until_date", { length: 10 }),
		localStartDate: varchar("local_start_date", { length: 10 }).notNull(),
		localEndDate: varchar("local_end_date", { length: 10 }),
		weekdays: jsonb("weekdays").$type<number[]>().notNull().default([]),
		localStartTime: varchar("local_start_time", { length: 8 }).notNull(),
		localEndTime: varchar("local_end_time", { length: 8 }).notNull(),
		endDayOffset: integer("end_day_offset").notNull().default(0),
		enabled: boolean("enabled").notNull().default(true),
		configurationRevision: integer("configuration_revision").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		unique("runner_schedule_events_owner_identity").on(table.ownerId, table.id),
		foreignKey({ columns: [table.ownerId, table.seriesParentId], foreignColumns: [table.ownerId, table.id] }),
		index("runner_schedule_events_device").on(table.ownerId, table.runnerId),
		foreignKey({ columns: [table.ownerId, table.sessionId], foreignColumns: [streamSessionsTable.ownerId, streamSessionsTable.id] }).onDelete("cascade"),
		check("runner_schedule_events_title_bounds", sql`char_length(trim(${table.title})) BETWEEN 1 AND 80`),
		check("runner_schedule_events_revision_positive", sql`${table.configurationRevision} > 0`),
		check("runner_schedule_events_offset_bounds", sql`${table.endDayOffset} BETWEEN 0 AND 7`),
		check("runner_schedule_events_recurrence_shape", sql`(${table.recurrence}='once' AND ${table.localEndDate} IS NOT NULL) OR (${table.recurrence}='weekly' AND jsonb_typeof(${table.weekdays})='array' AND jsonb_array_length(${table.weekdays}) BETWEEN 1 AND 7)`),
	],
);
export const runnerScheduleEventDestinationsTable = pgTable(
	"runner_schedule_event_destinations",
	{
		eventId: uuid("event_id").notNull(),
		ownerId: varchar("owner_id").notNull(),
		destinationId: uuid("destination_id").notNull(),
		position: integer("position").notNull(),
	},
	(table) => [primaryKey({ columns: [table.eventId, table.destinationId] }), foreignKey({ columns: [table.ownerId, table.eventId], foreignColumns: [runnerScheduleEventsTable.ownerId, runnerScheduleEventsTable.id] }).onDelete("cascade"), foreignKey({ columns: [table.ownerId, table.destinationId], foreignColumns: [runnerDestinationsTable.ownerId, runnerDestinationsTable.id] }).onDelete("cascade"), check("runner_schedule_event_destinations_position", sql`${table.position} >= 0`)],
);

export const runnerBroadcastAdmissionsTable = pgTable(
	"runner_broadcast_admissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerId: varchar("owner_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		runnerId: uuid("runner_id").references(() => runnersTable.id, { onDelete: "set null" }),
		sessionId: uuid("session_id").references(() => streamSessionsTable.id, { onDelete: "set null" }),
		executionGeneration: uuid("execution_generation").notNull(),
		commandId: uuid("command_id").notNull().defaultRandom(),
		occurrenceId: varchar("occurrence_id"),
		continuityRootAdmissionId: uuid("continuity_root_admission_id"),
		state: runnerAdmissionStateEnum("state").notNull().default("reserved"),
		stopMode: text("stop_mode", { enum: ["graceful", "immediate"] })
			.notNull()
			.default("graceful"),
		dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
		startedAt: timestamp("started_at", { withTimezone: true }),
		lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),
		stoppedAt: timestamp("stopped_at", { withTimezone: true }),
		configurationRevision: integer("configuration_revision").notNull(),
		benefitsAtStart: jsonb("benefits_at_start").$type<Record<string, unknown>>().notNull(),
		targetIdsSnapshot: uuid("target_ids_snapshot").array(),
		encryptedTargetsSnapshot: text("encrypted_targets_snapshot"),
		outputStates: jsonb("output_states").$type<{ id: string; state: "connecting" | "streaming" | "retrying" | "failed" | "stopped" }[]>().notNull().default([]),
		scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
		transitionPolicy: jsonb("transition_policy").$type<{ generatedStop: "finish_clip"; liveStop: "immediate"; noProgressMs: number; maxDrainMs: number }>().notNull().default({ generatedStop: "finish_clip", liveStop: "immediate", noProgressMs: 60000, maxDrainMs: 300000 }),
		terminalReason: varchar("terminal_reason"),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		terminalCredentialHash: text("terminal_credential_hash"),
		leaseId: uuid("lease_id"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		protocolSupportsLease: boolean("protocol_supports_lease").notNull().default(false),
		recoveredAt: timestamp("recovered_at", { withTimezone: true }),
	},
	(table) => [
		unique("runner_admissions_owner_identity_unique").on(table.ownerId, table.id),
		foreignKey({ columns: [table.ownerId, table.continuityRootAdmissionId], foreignColumns: [table.ownerId, table.id], name: "runner_admissions_continuity_owner_fk" }),
		check("runner_admissions_continuity_not_self", sql`${table.continuityRootAdmissionId} is null or ${table.continuityRootAdmissionId} <> ${table.id}`),
		uniqueIndex("runner_admissions_generation_unique").on(table.ownerId, table.executionGeneration),
		uniqueIndex("runner_admissions_open_session_unique")
			.on(table.sessionId)
			.where(sql`${table.state} not in ('authorized','stopped','failed_before_output') and ${table.continuityRootAdmissionId} is null`),
		index("runner_admissions_owner_state_idx").on(table.ownerId, table.state),
		check("runner_admissions_revision_positive", sql`${table.configurationRevision} > 0`),
	],
);

// Generated from @c15t/backend's current FumaDB schema.
export * from "./c15t-schema";

// Clipify authority is separate from provider credentials; exact immutable IDs
// prevent previously issued tokens from adopting a later consent grant.
export const mcpConnectionGrantsTable = pgTable(
	"mcp_connection_grants",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		authUserId: text("auth_user_id")
			.notNull()
			.references(() => authUserTable.id, { onDelete: "cascade" }),
		clientId: text("client_id").notNull(),
		resource: text("resource").notNull(),
		issuer: text("issuer").notNull(),
		generation: integer("generation").notNull().default(1),
		scopes: text("scopes").array().notNull(),
		active: boolean("active").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(table) => [index("mcp_grants_actor_client_idx").on(table.authUserId, table.clientId), check("mcp_grant_generation_positive", sql`${table.generation} > 0`)],
);
export const mcpGrantCreatorsTable = pgTable(
	"mcp_grant_creators",
	{
		grantId: uuid("grant_id")
			.notNull()
			.references(() => mcpConnectionGrantsTable.id, { onDelete: "cascade" }),
		creatorId: varchar("creator_id")
			.notNull()
			.references(() => creatorAccountsTable.creatorId, { onDelete: "cascade" }),
		// NULL preserves pre-existing grants; new consent always stores explicit per-creator scopes.
		scopes: text("scopes").array(),
		agencyOrganizationId: text("agency_organization_id").references(() => authOrganizationTable.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.grantId, table.creatorId] })],
);

export const mcpMutationRetriesTable = pgTable(
	"mcp_mutation_retries",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		grantId: uuid("grant_id")
			.notNull()
			.references(() => mcpConnectionGrantsTable.id, { onDelete: "cascade" }),
		grantGeneration: integer("grant_generation").notNull(),
		authUserId: text("auth_user_id")
			.notNull()
			.references(() => authUserTable.id, { onDelete: "cascade" }),
		clientId: text("client_id").notNull(),
		creatorId: varchar("creator_id")
			.notNull()
			.references(() => creatorAccountsTable.creatorId, { onDelete: "cascade" }),
		toolName: varchar("tool_name", { length: 128 }).notNull(),
		retryKey: varchar("retry_key", { length: 128 }).notNull(),
		inputDigest: varchar("input_digest", { length: 64 }).notNull(),
		safeResponse: jsonb("safe_response").$type<Record<string, unknown>>().notNull(),
		resourceId: uuid("resource_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex("mcp_retries_context_key_unique").on(table.grantId, table.grantGeneration, table.authUserId, table.clientId, table.creatorId, table.toolName, table.retryKey),
		index("mcp_retries_expiry_idx").on(table.expiresAt),
		check("mcp_retry_generation_positive", sql`${table.grantGeneration} > 0`),
		check("mcp_retry_key_bounds", sql`length(${table.retryKey}) BETWEEN 1 AND 128`),
		check("mcp_retry_digest_format", sql`${table.inputDigest} ~ '^[a-f0-9]{64}$'`),
		check("mcp_retry_minimum_retention", sql`${table.expiresAt} >= ${table.createdAt} + interval '24 hours'`),
		check("mcp_retry_safe_response_object", sql`jsonb_typeof(${table.safeResponse}) = 'object'`),
	],
);
