import { z } from "zod";
const creatorId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/)
	.describe("ID of an approved creator, as returned in the list of creators this connection can access.");
const id = z.uuid();
const revision = z.number().int().positive().max(2_147_483_647).describe("The configurationRevision from the most recent read of this resource. The request fails with a conflict if the resource has changed since then.");
const name = z.string().trim().min(1).max(120);
const retryKey = z.string().min(1).max(128).describe("A unique key for this request, such as a UUID. Repeating the request with the same key returns the original result instead of acting twice.");
const page = {
	limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of results to return (1-100, default 25)."),
	cursor: z.string().min(1).max(2048).optional().describe("Cursor from the previous page's response. Omit it for the first page."),
};
const target = { creatorId };
const overlay = { ...target, overlayId: id.describe("ID of one of the creator's overlays.") };
const playlist = { ...target, playlistId: id.describe("ID of one of the creator's playlists.") };
const gallery = { ...target, galleryId: id.describe("ID of one of the creator's galleries.") };
const runner = { ...target, runnerId: id.describe("ID of one of the creator's Runners.") };
const session = { ...target, sessionId: id.describe("ID of one of the creator's stream sessions.") };
const strings = z.array(z.string().trim().min(1).max(128)).max(100);
const color = z.string().min(1).max(100);
const int = (min: number, max: number) => z.number().int().min(min).max(max);
export const discoveryFilters = z
	.object({
		startedAt: z.iso.datetime({ offset: true }).optional().describe("Only clips created at or after this ISO 8601 date-time, including its UTC offset."),
		endedAt: z.iso.datetime({ offset: true }).optional().describe("Only clips created before this ISO 8601 date-time, including its UTC offset."),
		timezone: z.string().max(100).default("UTC").describe("IANA time zone of the user, such as Europe/Berlin, used when interpreting dates (default UTC)."),
		category: z.string().trim().min(1).max(200).optional().describe("Twitch category (game) name or numeric category ID. An ID matches exactly; a name is matched against cached category data."),
		title: z.string().trim().min(1).max(200).optional().describe("Text that must appear in the clip title."),
		minViews: int(0, 2_147_483_647).optional().describe("Minimum view count."),
		minDuration: int(0, 600).optional().describe("Minimum clip length in seconds."),
		maxDuration: int(0, 600).optional().describe("Maximum clip length in seconds."),
		sort: z.enum(["newest", "most_viewed"]).default("newest").describe("Result order (default newest)."),
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
	play_overlay: z.object({ ...overlay }).strict(),
	pause_overlay: z.object({ ...overlay }).strict(),
	skip_overlay: z.object({ ...overlay }).strict(),
	hide_overlay: z.object({ ...overlay }).strict(),
	show_overlay: z.object({ ...overlay }).strict(),
	set_overlay_volume: z.object({ ...overlay, volume: int(0, 100).describe("Live playback volume, 0-100.") }).strict(),
	mute_overlay: z.object({ ...overlay }).strict(),
	unmute_overlay: z.object({ ...overlay }).strict(),
	toggle_overlay_mute: z.object({ ...overlay }).strict(),
	control_overlay: z
		.object({ ...overlay, command: z.enum(["play", "pause", "skip", "hide", "show", "volume", "mute", "unmute", "toggle_mute"]), volume: int(0, 100).optional() })
		.strict()
		.refine((v) => (v.command === "volume" ? v.volume !== undefined : v.volume === undefined), "Volume is only valid for the volume command"),
	enqueue_overlay_clip: z.object({ ...overlay, clip: z.string().trim().min(1).max(2048).describe("Twitch clip ID or clip URL from this creator's channel."), retryKey }).strict(),
	clear_overlay_queue: z.object({ ...overlay, queue: z.enum(["moderator", "viewer", "all"]).describe("Which queue to clear: the creator-wide moderator queue, this overlay's viewer queue, or all.") }).strict(),
	get_clip_crawler_status: z.object(target).strict(),
	refresh_clips: z.object(target).strict(),
	search_clips: z.object({ ...target, filters: discoveryFilters.default(() => discoveryFilters.parse({})).describe("Search filters. All are optional and combine with AND."), ...page }).strict(),
	resolve_clip: z.object({ ...target, reference: z.string().trim().min(1).max(2048).describe("Twitch clip ID or clip URL.") }).strict(),
	preview_playlist_import: z
		.object({ ...playlist, expectedRevision: revision, filters: discoveryFilters.optional().describe("Select clips with search filters. Provide either filters or clips, not both."), clips: z.array(z.string().trim().min(1).max(2048)).min(1).max(500).optional().describe("Select specific clips by Twitch clip ID or URL (1-500). Provide either clips or filters, not both.") })
		.strict()
		.refine((v) => Boolean(v.filters) !== Boolean(v.clips), "Choose filters or clip references"),
	commit_playlist_import: z.object({ ...playlist, previewToken: z.string().min(1).max(100_000).describe("previewToken from the import preview being committed. It expires after a short time."), confirmed: z.literal(true).describe("true once the user has reviewed and confirmed the previewed clips."), retryKey }).strict(),
	list_galleries: z.object({ ...target, ...page }).strict(),
	get_gallery: z.object(gallery).strict(),
	create_gallery: z.object({ ...target, name: name.describe("Name for the new gallery."), retryKey }).strict(),
	update_gallery: z.object({ ...gallery, expectedRevision: revision, patch: nonempty(galleryFields) }).strict(),
	delete_gallery: z.object({ ...gallery, expectedRevision: revision }).strict(),
	publish_gallery: z.object({ ...gallery, expectedRevision: revision, published: z.boolean().describe("true to publish the gallery, false to unpublish it.") }).strict(),
	get_gallery_embed: z.object(gallery).strict(),
	get_gallery_preview: z.object({ ...gallery, ...page }).strict(),
	get_overlay_embed: z.object({ ...overlay, purpose: z.literal("obs_browser_source") }).strict(),
	get_player_embed: z
		.object({
			...overlay,
			format: z.enum(["elements", "iframe"]).default("elements").describe("elements returns the Clipify Elements snippet (default); iframe returns a plain iframe."),
			muted: z.boolean().default(false).describe("Start the player muted."),
			autoplay: z.boolean().default(false).describe("Start playing automatically."),
			showBanner: z.boolean().default(false).describe("Show the banner option of the player."),
			showOverlay: z.boolean().default(false).describe("Show the overlay layer of the player."),
		})
		.strict(),
	get_creator_page: z.object(target).strict(),
	update_creator_page: z.object({ ...target, expectedRevision: revision, patch: nonempty(creatorPageFields) }).strict(),
	publish_creator_page: z.object({ ...target, expectedRevision: revision, enabled: z.boolean().describe("true to turn the public Creator Page on, false to turn it off.") }).strict(),
	get_runner_setup: z.object({ ...target, platform: z.enum(["windows", "linux", "linux-arm64", "macos", "macos-arm64"]).describe("Operating system and CPU of the computer that will run Clipify Runner.") }).strict(),
	list_runners: z.object({ ...target, ...page }).strict(),
	get_runner: z.object(runner).strict(),
	create_runner: z.object({ ...target, name: name.describe("Name for the new Runner, for example the computer it runs on."), retryKey }).strict(),
	update_runner: z.object({ ...runner, expectedRevision: revision, name: name.describe("New Runner name.") }).strict(),
	delete_runner: z.object({ ...runner, expectedRevision: revision }).strict(),
	unlink_runner: z.object({ ...runner, expectedRevision: revision }).strict(),
	list_stream_sessions: z.object({ ...target, ...page }).strict(),
	get_stream_session: z.object(session).strict(),
	configure_stream_session: z
		.object({
			...target,
			sessionId: id.optional().describe("Existing stream session to update. Omit it to create a new session."),
			expectedRevision: revision.optional().describe("Required when updating an existing session: its configurationRevision from the latest read."),
			runnerId: id.describe("Runner that broadcasts this session."),
			overlayId: id.describe("Overlay this session broadcasts."),
			mode: z.enum(["24/7", "failsafe"]).describe("24/7 or failsafe (live fallback) broadcasting."),
			controlMode: z.enum(["manual", "scheduled"]).optional().describe("manual or scheduled start and stop. Scheduled control requires 24/7 mode."),
			resolution: z.enum(["720p", "1080p"]).default("1080p").describe("Output resolution (default 1080p)."),
			fps: z
				.union([z.literal(30), z.literal(60)])
				.default(60)
				.describe("Output frame rate (default 60)."),
			destination: z.enum(["twitch", "youtube"]).optional().describe("Legacy single destination preset. Provide either destination or destinationIds, not both."),
			destinationIds: z.array(z.uuid()).min(1).optional().describe("IDs of saved streaming destinations from the Clipify dashboard. Free allows one; Runner Pro allows several."),
			retryKey: retryKey.optional().describe("Required when creating a new session. Repeating the request with the same key returns the original result."),
		})
		.strict()
		.refine((v) => (v.sessionId ? Boolean(v.expectedRevision) : Boolean(v.retryKey)), "Existing sessions need a revision; new sessions need a retry key")
		.refine((v) => v.controlMode !== "scheduled" || v.mode === "24/7", "Live fallback uses Manual control")
		.refine((v) => v.destination === undefined || v.destinationIds === undefined, "Choose a saved selection or a legacy preset"),
	control_stream_session: z
		.object({ ...session, expectedRevision: revision, executionGeneration: z.uuid().optional(), occurrenceId: z.string().min(1).max(512).optional().describe("Scheduled occurrence to act on. Only for sessions with scheduled control."), state: z.enum(["running", "stopped"]).describe("running to start broadcasting, stopped to stop."), stopMode: z.enum(["graceful", "immediate"]).optional().describe("How to stop: graceful or immediate. Only valid when state is stopped.") })
		.strict()
		.refine((input) => input.state === "stopped" || input.stopMode === undefined, { message: "Stop mode applies only to stopping a broadcast" }),
	get_runner_snapshot: z.object(runner).strict(),
	submit_feedback: z.object({ ...target, kind: z.enum(["bug", "suggestion"]).describe("bug for a problem report, suggestion for an idea or request."), message: z.string().trim().min(1).max(2000).describe("The report text the user approved, up to 2000 characters."), confirmed: z.literal(true).describe("true once the user has reviewed and approved the message."), retryKey }).strict(),
};
export type WorkflowToolName = keyof typeof workflowInputSchemas;
