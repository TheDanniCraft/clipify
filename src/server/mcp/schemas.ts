import { overlayFieldGroups, galleryFieldGroups } from "./focused-fields";
import { workflowInputSchemas, galleryFields } from "./workflows/schemas";
import { z } from "zod";
import { OverlayType, PlaybackMode, MaxDurationMode, StatusOptions } from "@types";

const creatorId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/)
	.describe("ID of an approved creator, as returned in the list of creators this connection can access.");
const resourceId = z.uuid();
const name = z.string().trim().min(1).max(120);
const expectedRevision = z.number().int().positive().max(2_147_483_647).describe("The configurationRevision from the most recent read of this resource. The request fails with a conflict if the resource has changed since then.");
const retryKey = z.string().min(1).max(128).describe("A unique key for this request, such as a UUID. Repeating the request with the same key returns the original result instead of acting twice.");
const page = {
	limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of results to return (1-100, default 25)."),
	cursor: z.string().min(1).max(2048).optional().describe("Cursor from the previous page's response. Omit it for the first page."),
};
const boundedNames = z.array(z.string().trim().min(1).max(128)).max(100);
const color = z.string().min(1).max(100);
const percentage = z.number().int().min(0).max(100);
const scale = z.number().int().min(50).max(250);
const clipId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/);
const items = (minimum: number) =>
	z
		.array(clipId)
		.min(minimum)
		.max(500)
		.refine((ids) => new Set(ids).size === ids.length, "Duplicate item references");

const overlayFields = {
	name: name.optional(),
	status: z.enum(StatusOptions).optional(),
	type: z.enum(OverlayType).optional().describe("Which clips the overlay plays: clips from the last 1, 7, 30, 90, 180 or 365 days, Featured clips, All clips, the clip Queue, or a Playlist."),
	playlistId: resourceId.nullable().optional().describe("Playlist to play when type is Playlist, or null for none."),
	minClipDuration: z.number().int().min(0).max(600).optional(),
	maxClipDuration: z.number().int().min(0).max(600).optional(),
	maxDurationMode: z.enum(MaxDurationMode).optional().describe("How maxClipDuration is applied: filter (exclude longer clips) or cut."),
	minClipViews: z.number().int().min(0).max(2_147_483_647).optional(),
	blacklistWords: boundedNames.optional(),
	categoriesOnly: boundedNames.optional(),
	categoriesBlocked: boundedNames.optional(),
	clipCreatorsOnly: boundedNames.optional(),
	clipCreatorsBlocked: boundedNames.optional(),
	playbackMode: z.enum(PlaybackMode).optional().describe("Clip order: random, order (saved playlist order), top (most viewed first) or smart_shuffle (view-weighted shuffle that varies authors and categories)."),
	preferCurrentCategory: z.boolean().optional(),
	clipPackSize: z.number().int().min(25).max(500).optional().describe("How many clips the player loads per batch (25-500)."),
	playerVolume: percentage.optional().describe("Saved default playback volume, 0-100."),
	showChannelInfo: z.boolean().optional(),
	showClipInfo: z.boolean().optional(),
	showTimer: z.boolean().optional(),
	showProgressBar: z.boolean().optional(),
	overlayInfoFadeOutSeconds: z.number().int().min(0).max(30).optional(),
	themeFontFamily: z.string().min(1).max(100).optional(),
	themeTextColor: color.optional(),
	themeAccentColor: color.optional(),
	themeBackgroundColor: color.optional(),
	progressBarStartColor: color.optional(),
	progressBarEndColor: color.optional(),
	borderSize: z.number().int().min(0).max(32).optional(),
	borderRadius: z.number().int().min(0).max(48).optional(),
	effectScanlines: z.boolean().optional(),
	effectStatic: z.boolean().optional(),
	effectCrt: z.boolean().optional(),
	channelInfoX: percentage.optional(),
	channelInfoY: percentage.optional(),
	clipInfoX: percentage.optional(),
	clipInfoY: percentage.optional(),
	timerX: percentage.optional(),
	timerY: percentage.optional(),
	channelScale: scale.optional(),
	clipScale: scale.optional(),
	timerScale: scale.optional(),
};
export const overlayPatchSchema = z
	.object(overlayFields)
	.strict()
	.refine((patch) => Object.keys(patch).length > 0, "At least one configuration field is required");
const overlayId = resourceId.describe("ID of one of the creator's overlays.");
const playlistId = resourceId.describe("ID of one of the creator's playlists.");
const galleryId = resourceId.describe("ID of one of the creator's galleries.");
const overlayTarget = { creatorId, overlayId };
const playlistTarget = { creatorId, playlistId };
const focusedOverlayPatch = (group: keyof typeof overlayFieldGroups) =>
	z
		.object(Object.fromEntries(overlayFieldGroups[group].map((field) => [field, overlayFields[field]])))
		.strict()
		.refine((patch) => Object.keys(patch).length > 0, "At least one field is required");
const overlayAreaRead = z.object(overlayTarget).strict();
const overlayAreaUpdate = (group: keyof typeof overlayFieldGroups) => z.object({ ...overlayTarget, expectedRevision, patch: focusedOverlayPatch(group) }).strict();
export const focusedOverlaySchemas = {
	update_overlay_settings: overlayAreaUpdate("settings"),
	get_overlay_source: overlayAreaRead,
	update_overlay_source: overlayAreaUpdate("source"),
	get_overlay_filters: overlayAreaRead,
	update_overlay_filters: overlayAreaUpdate("filters"),
	get_overlay_playback: overlayAreaRead,
	update_overlay_playback: overlayAreaUpdate("playback"),
	get_overlay_theme: overlayAreaRead,
	update_overlay_theme: overlayAreaUpdate("theme"),
};
const galleryAreaRead = z.object({ creatorId, galleryId }).strict();
const galleryAreaUpdate = (group: keyof typeof galleryFieldGroups) =>
	z
		.object({
			creatorId,
			galleryId,
			expectedRevision,
			patch: z
				.object(Object.fromEntries(galleryFieldGroups[group].map((field) => [field, galleryFields[field]])))
				.strict()
				.refine((patch) => Object.keys(patch).length > 0, "At least one field is required"),
		})
		.strict();
export const focusedGallerySchemas = {
	update_gallery_settings: galleryAreaUpdate("settings"),
	get_gallery_source: galleryAreaRead,
	update_gallery_source: galleryAreaUpdate("source"),
	get_gallery_filters: galleryAreaRead,
	update_gallery_filters: galleryAreaUpdate("filters"),
	get_gallery_layout: galleryAreaRead,
	update_gallery_layout: galleryAreaUpdate("layout"),
	get_gallery_theme: galleryAreaRead,
	update_gallery_theme: galleryAreaUpdate("theme"),
};
export const toolInputSchemas = {
	...focusedGallerySchemas,
	...focusedOverlaySchemas,
	get_overlay_link: overlayAreaRead,
	...workflowInputSchemas,
	list_creators: z.object(page).strict(),
	get_capabilities: z.object({ creatorId }).strict(),
	list_overlays: z.object({ creatorId, ...page }).strict(),
	get_overlay: z.object(overlayTarget).strict(),
	create_overlay: z.object({ creatorId, retryKey, name: name.optional().describe("Name for the new overlay (optional).") }).strict(),
	update_overlay: z.object({ ...overlayTarget, expectedRevision, patch: overlayPatchSchema }).strict(),
	delete_overlay: z.object({ ...overlayTarget, expectedRevision }).strict(),
	list_playlists: z.object({ creatorId, ...page }).strict(),
	get_playlist: z.object(playlistTarget).strict(),
	create_playlist: z.object({ creatorId, retryKey, name: name.describe("Name for the new playlist.") }).strict(),
	update_playlist: z.object({ ...playlistTarget, expectedRevision, name: name.describe("New playlist name.") }).strict(),
	delete_playlist: z.object({ ...playlistTarget, expectedRevision }).strict(),
	add_playlist_items: z.object({ ...playlistTarget, expectedRevision, clipIds: items(1).describe("Twitch clip IDs to append, in order (1-500, no duplicates).") }).strict(),
	remove_playlist_items: z.object({ ...playlistTarget, expectedRevision, itemIds: items(1).describe("IDs of the playlist items to remove, as listed in the playlist.") }).strict(),
	reorder_playlist_items: z.object({ ...playlistTarget, expectedRevision, itemIds: items(0).describe("Every current playlist item ID exactly once, in the new order.") }).strict(),
};
export type ToolName = keyof typeof toolInputSchemas;
/** Broad schemas serve browser/backend callers, never public MCP aliases. */
const internalToolNames = new Set(["update_overlay", "update_gallery", "get_overlay_embed", "control_overlay"]);
export const publicToolNames = (Object.keys(toolInputSchemas) as ToolName[]).filter((name) => !internalToolNames.has(name));
const safeOverlay = z.object({ ...overlayFields, id: resourceId, ownerId: creatorId, name, status: z.enum(StatusOptions), type: z.enum(OverlayType), playlistId: resourceId.nullable(), configurationRevision: expectedRevision });
/** Explicit schema projection prevents credentials and later ORM fields escaping. */
export function overlayDto(value: unknown) {
	const { ownerId, ...configuration } = safeOverlay.parse(value);
	return { creatorId: ownerId, ...configuration };
}

const safePlaylist = z.object({ id: resourceId, ownerId: creatorId, name, configurationRevision: expectedRevision });
/** Project playlist metadata explicitly rather than returning an ORM record. */
export function playlistDto(value: unknown) {
	const { ownerId, ...metadata } = safePlaylist.parse(value);
	return { creatorId: ownerId, ...metadata };
}

const safePlaylistItem = z.object({ id: clipId, position: z.number().int().nonnegative(), title: z.string().max(1000).optional(), duration: z.number().finite().nonnegative().max(600).optional() });
export function playlistItemDto(value: unknown) {
	return safePlaylistItem.parse(value);
}
