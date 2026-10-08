import { z } from "zod";
const creatorId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/);
const id = z.uuid();
const revision = z.number().int().positive().max(2_147_483_647);
const name = z.string().trim().min(1).max(120);
const page = { limit: z.number().int().min(1).max(100).default(25), cursor: z.string().min(1).max(2048).optional() };
const target = { creatorId };
const overlay = { ...target, overlayId: id };
const playlist = { ...target, playlistId: id };
const gallery = { ...target, galleryId: id };
const runner = { ...target, runnerId: id };
const session = { ...target, sessionId: id };
const strings = z.array(z.string().trim().min(1).max(128)).max(100);
const color = z.string().min(1).max(100);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
export const discoveryFilters = z
	.object({
		startedAt: z.iso.datetime({ offset: true }).optional(),
		endedAt: z.iso.datetime({ offset: true }).optional(),
		timezone: z.string().max(100).default("UTC"),
		category: z.string().trim().min(1).max(200).optional(),
		title: z.string().trim().min(1).max(200).optional(),
		minViews: int(0, 2_147_483_647).optional(),
		minDuration: int(0, 600).optional(),
		maxDuration: int(0, 600).optional(),
		sort: z.enum(["newest", "most_viewed"]).default("newest"),
	})
	.strict()
	.refine((v) => !v.startedAt || !v.endedAt || Date.parse(v.startedAt) < Date.parse(v.endedAt), "Invalid date interval")
	.refine((v) => v.minDuration === undefined || v.maxDuration === undefined || v.minDuration <= v.maxDuration, "Invalid duration interval")
	.refine((v) => {
		try {
			new Intl.DateTimeFormat("en", { timeZone: v.timezone });
			return true;
		} catch {
			return false;
		}
	}, "Invalid timezone");
export const galleryFields = {
	name: name.optional(),
	source: z.enum(["curated", "live"]).optional(),
	playlistId: id.nullable().optional(),
	layout: z.enum(["grid", "list", "carousel"]).optional(),
	gridAuto: z.boolean().optional(),
	gridMobileColumns: int(1, 2).optional(),
	gridTabletColumns: int(2, 4).optional(),
	gridDesktopColumns: int(2, 6).optional(),
	listDensity: z.enum(["compact", "comfortable"]).optional(),
	carouselMobileCards: int(1, 2).optional(),
	carouselTabletCards: int(1, 4).optional(),
	carouselDesktopCards: int(1, 6).optional(),
	carouselShowNavigation: z.boolean().optional(),
	carouselShowIndicators: z.boolean().optional(),
	showTitle: z.boolean().optional(),
	showCreator: z.boolean().optional(),
	showViews: z.boolean().optional(),
	showDuration: z.boolean().optional(),
	showCreatedAt: z.boolean().optional(),
	liveSort: z.enum(["newest", "most_viewed", "stable_random"]).optional(),
	liveTimeWindow: z.enum(["today", "7d", "30d", "all", "custom"]).optional(),
	liveCustomStart: z.iso.datetime({ offset: true }).nullable().optional(),
	liveCustomEnd: z.iso.datetime({ offset: true }).nullable().optional(),
	liveResultLimit: int(1, 100).optional(),
	includeCategories: strings.optional(),
	excludeCategories: strings.optional(),
	minimumViews: int(0, 1_000_000_000).optional(),
	minimumDuration: int(0, 3600).optional(),
	maximumDuration: int(0, 3600).optional(),
	titleBlacklist: strings.optional(),
	creatorAllowlist: strings.optional(),
	creatorBlocklist: strings.optional(),
	theme: z.enum(["light", "dark", "system"]).optional(),
	accentColor: color.optional(),
	backgroundMode: z.enum(["transparent", "solid"]).optional(),
	backgroundColor: color.optional(),
	cardSurfaceColor: color.optional(),
	textColor: color.optional(),
	cardRadius: int(0, 32).optional(),
	gap: int(4, 48).optional(),
	thumbnailTreatment: z.enum(["cover", "contain"]).optional(),
	modalBackdrop: color.optional(),
	desktopModalWidth: int(640, 1440).optional(),
};
const nonempty = <T extends z.ZodRawShape>(fields: T) =>
	z
		.object(fields)
		.strict()
		.refine((value) => Object.keys(value).length > 0, "Empty patch");
export const creatorPageFields = { creatorPageVisibility: z.enum(["discoverable", "unlisted"]).optional(), creatorPageShowBio: z.boolean().optional(), creatorPageSocialTitle: z.string().trim().max(120).nullable().optional(), creatorPageSocialDescription: z.string().trim().max(240).nullable().optional() };
export const workflowInputSchemas = {
	get_overlay_runtime: z.object(overlay).strict(),
	get_overlay_queues: z.object({ ...overlay, ...page }).strict(),
	control_overlay: z
		.object({ ...overlay, command: z.enum(["play", "pause", "skip", "hide", "show", "volume", "mute", "unmute", "toggle_mute"]), volume: int(0, 100).optional() })
		.strict()
		.refine((v) => (v.command === "volume" ? v.volume !== undefined : v.volume === undefined), "Volume is only valid for the volume command"),
	enqueue_overlay_clip: z.object({ ...overlay, clip: z.string().trim().min(1).max(2048), retryKey: z.string().min(1).max(128) }).strict(),
	clear_overlay_queue: z.object({ ...overlay, queue: z.enum(["moderator", "viewer", "all"]) }).strict(),
	search_clips: z.object({ ...target, filters: discoveryFilters.default(() => discoveryFilters.parse({})), ...page }).strict(),
	resolve_clip: z.object({ ...target, reference: z.string().trim().min(1).max(2048) }).strict(),
	preview_playlist_import: z
		.object({ ...playlist, expectedRevision: revision, filters: discoveryFilters.optional(), clips: z.array(z.string().trim().min(1).max(2048)).min(1).max(500).optional() })
		.strict()
		.refine((v) => Boolean(v.filters) !== Boolean(v.clips), "Choose filters or clip references"),
	commit_playlist_import: z.object({ ...playlist, previewToken: z.string().min(1).max(100_000), confirmed: z.literal(true), retryKey: z.string().min(1).max(128) }).strict(),
	list_galleries: z.object({ ...target, ...page }).strict(),
	get_gallery: z.object(gallery).strict(),
	create_gallery: z.object({ ...target, name, retryKey: z.string().min(1).max(128) }).strict(),
	update_gallery: z.object({ ...gallery, expectedRevision: revision, patch: nonempty(galleryFields) }).strict(),
	delete_gallery: z.object({ ...gallery, expectedRevision: revision }).strict(),
	publish_gallery: z.object({ ...gallery, expectedRevision: revision, published: z.boolean() }).strict(),
	get_gallery_embed: z.object(gallery).strict(),
	get_gallery_preview: z.object({ ...gallery, ...page }).strict(),
	get_overlay_embed: z.object({ ...overlay, purpose: z.literal("obs_browser_source") }).strict(),
	get_player_embed: z.object({ ...overlay, format: z.enum(["elements", "iframe"]).default("elements"), muted: z.boolean().default(false), autoplay: z.boolean().default(false), showBanner: z.boolean().default(false), showOverlay: z.boolean().default(false) }).strict(),
	get_creator_page: z.object(target).strict(),
	update_creator_page: z.object({ ...target, expectedRevision: revision, patch: nonempty(creatorPageFields) }).strict(),
	publish_creator_page: z.object({ ...target, expectedRevision: revision, enabled: z.boolean() }).strict(),
	get_runner_setup: z.object({ ...target, platform: z.enum(["windows", "linux", "linux-arm64", "macos", "macos-arm64"]) }).strict(),
	list_runners: z.object({ ...target, ...page }).strict(),
	get_runner: z.object(runner).strict(),
	create_runner: z.object({ ...target, name, retryKey: z.string().min(1).max(128) }).strict(),
	update_runner: z.object({ ...runner, expectedRevision: revision, name }).strict(),
	delete_runner: z.object({ ...runner, expectedRevision: revision }).strict(),
	unlink_runner: z.object({ ...runner, expectedRevision: revision }).strict(),
	list_stream_sessions: z.object({ ...target, ...page }).strict(),
	get_stream_session: z.object(session).strict(),
	configure_stream_session: z
		.object({ ...target, sessionId: id.optional(), expectedRevision: revision.optional(), runnerId: id, overlayId: id, mode: z.enum(["24/7", "failsafe"]), resolution: z.enum(["720p", "1080p"]).default("1080p"), fps: z.union([z.literal(30), z.literal(60)]).default(60), destination: z.enum(["twitch", "youtube"]).optional(), retryKey: z.string().min(1).max(128).optional() })
		.strict()
		.refine((v) => (v.sessionId ? Boolean(v.expectedRevision) : Boolean(v.retryKey)), "Existing sessions need a revision; new sessions need a retry key"),
	control_stream_session: z.object({ ...session, expectedRevision: revision, state: z.enum(["running", "stopped"]) }).strict(),
	get_runner_snapshot: z.object(runner).strict(),
	submit_feedback: z.object({ ...target, kind: z.enum(["bug", "suggestion"]), message: z.string().trim().min(1).max(2000), confirmed: z.literal(true), retryKey: z.string().min(1).max(128) }).strict(),
};
export type WorkflowToolName = keyof typeof workflowInputSchemas;
