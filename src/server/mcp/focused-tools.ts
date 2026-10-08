import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { getOverlay, updateOverlay } from "@/server/resources/overlays";
import { getGalleryForPrincipal, updateGalleryForPrincipal, getOverlayEmbed } from "@/server/resources/galleries";
import { overlayFieldGroups, galleryFieldGroups } from "./focused-fields";
import { focusedOverlaySchemas, focusedGallerySchemas, toolInputSchemas } from "./schemas";

const overlayAreas = {
	settings: "name and enabled/paused status",
	source: "clip source type and linked playlist; use list_playlists to find a playlist",
	filters: "clip duration in seconds, minimum views, Twitch category-ID and clip-creator username allow/block lists, and blocked title words; arrays replace the specified list",
	playback: "playback mode, current-category preference, clip pack size and saved volume; use control_overlay for temporary live volume changes",
	theme: "Theme Studio appearance: fonts, colors, borders in pixels, effects, visible information, positions (0–100 percent) and scales (50–250 percent)",
};
const galleryAreas = {
	settings: "gallery name",
	source: "curated playlist or live Twitch clips; use list_playlists to find a playlist",
	filters: "live clip sorting, date window, result limit, views/duration and Twitch category-ID/creator-username/title filters; arrays replace the specified list",
	layout: "grid/list/carousel layout, responsive columns/cards, navigation and visible clip metadata",
	theme: "colors, surfaces, corners, spacing, thumbnails and clip modal appearance",
};

function projectArea(value: unknown, kind: "overlay" | "gallery", group: string, fields: readonly string[], capabilities?: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("SERVICE_UNAVAILABLE");
	const row = value as Record<string, unknown>;
	return {
		[`${kind}Id`]: row.id,
		creatorId: row.creatorId,
		configurationRevision: row.configurationRevision,
		[group]: Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]])),
		...(capabilities === undefined ? {} : { capabilities }),
	};
}

/** Narrow MCP façades reuse backend authorization, locking, plan and revision checks. */
export function focusedTools(principal: TrustedCreatorPrincipal) {
	const overlays = (Object.keys(focusedOverlaySchemas) as (keyof typeof focusedOverlaySchemas)[]).map((name) => {
		const group = name.replace(/^(get|update)_overlay_/, "") as keyof typeof overlayFieldGroups;
		const read = name.startsWith("get_");
		const schema = focusedOverlaySchemas[name];
		return {
			name,
			schema,
			description: `${read ? "Read" : "Change only"} overlay ${overlayAreas[group]}. ${read ? "Returns the saved settings and current configurationRevision; excludes unrelated fields and private links." : "Send a nonempty partial patch and expectedRevision from the latest read. Omitted fields stay unchanged. Returns updated settings and revision. Existing creator permissions and plan restrictions apply."}`,
			run: async (raw: unknown) => {
				const input = schema.parse(raw);
				const result = read ? await getOverlay(principal, input) : await updateOverlay(principal, input, undefined, name);
				return projectArea(result.overlay, "overlay", group, overlayFieldGroups[group]);
			},
		};
	});
	const galleries = (Object.keys(focusedGallerySchemas) as (keyof typeof focusedGallerySchemas)[]).map((name) => {
		const group = name.replace(/^(get|update)_gallery_/, "") as keyof typeof galleryFieldGroups;
		const read = name.startsWith("get_");
		const schema = focusedGallerySchemas[name];
		return {
			name,
			schema,
			description: `${read ? "Read" : "Change only"} ${galleryAreas[group]}. ${read ? "Returns saved settings, configurationRevision and current capabilities." : "Send a nonempty partial patch and expectedRevision from the latest read. Omitted fields stay unchanged. Returns updated settings and revision. Does not publish; use publish_gallery. Existing creator permissions and plan restrictions apply."}`,
			run: async (raw: unknown) => {
				const input = schema.parse(raw);
				if (read) {
					const result = await getGalleryForPrincipal(principal, input);
					return projectArea(result.gallery, "gallery", group, galleryFieldGroups[group], result.capabilities);
				}
				return projectArea(await updateGalleryForPrincipal(principal, input, undefined, name), "gallery", group, galleryFieldGroups[group]);
			},
		};
	});
	return [
		...overlays,
		...galleries,
		{
			name: "get_overlay_link" as const,
			schema: toolInputSchemas.get_overlay_link,
			description: "Get the private browser-source URL for OBS Studio, Streamlabs or another streaming application. Requires explicit overlay-secret:read permission. The URL contains a credential: do not publish it or include it in public website HTML. Use get_player_embed for public websites.",
			run: (raw: unknown) => getOverlayEmbed(principal, { ...toolInputSchemas.get_overlay_link.parse(raw), purpose: "obs_browser_source" }),
		},
	];
}
