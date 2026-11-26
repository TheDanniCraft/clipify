import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { getOverlay, updateOverlay } from "@/server/resources/overlays";
import { getGalleryForPrincipal, updateGalleryForPrincipal, getOverlayEmbed } from "@/server/resources/galleries";
import { overlayFieldGroups, galleryFieldGroups } from "./focused-fields";
import { focusedOverlaySchemas, focusedGallerySchemas, toolInputSchemas } from "./schemas";

const overlayAreas = {
	settings: "name and enabled/paused status",
	source: "clip source: which clips it plays and the linked playlist ID, if any",
	filters: "clip filters: duration limits in seconds, minimum views, allowed and blocked Twitch category IDs and clip-creator usernames, and blocked title words (a list in patch replaces that whole list)",
	playback: "playback settings: playback mode, current-category preference, clip pack size and saved default volume (live volume changes on a running player are separate and not saved)",
	theme: "Theme Studio appearance: fonts, colors, borders in pixels, effects, which clip information is visible, element positions (0–100 percent) and scales (50–250 percent)",
};
const galleryAreas = {
	settings: "name",
	source: "clip source: a curated playlist (by playlist ID) or live Twitch clips",
	filters: "live-clip filters: sort order, date window, result limit, minimum views, duration limits, included and excluded Twitch category IDs, allowed and blocked clip-creator usernames, and blocked title words (a list in patch replaces that whole list)",
	layout: "layout: grid, list or carousel, columns or cards per screen size, carousel navigation and which clip details are shown",
	theme: "appearance: light/dark theme, colors, background, card corners, spacing, thumbnail fit and clip pop-up styling",
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
			description: read
				? `Returns an overlay's ${overlayAreas[group]}, with its configurationRevision. Other overlay settings and the private OBS link are not included. Use before changing this area, since updates require the current revision.`
				: `Changes an overlay's ${overlayAreas[group]}. patch holds only the fields to change; omitted fields stay unchanged. expectedRevision must be the configurationRevision from the latest read, and the update fails with a conflict if the overlay changed since. Returns the updated settings and the new revision. The creator's permissions and plan limits apply.`,
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
			description: read
				? `Returns a gallery's ${galleryAreas[group]}, with its configurationRevision and the gallery features the creator's plan allows. Use before changing this area, since updates require the current revision.`
				: `Changes a gallery's ${galleryAreas[group]}. patch holds only the fields to change; omitted fields stay unchanged. expectedRevision must be the configurationRevision from the latest read, and the update fails with a conflict if the gallery changed since. Returns the updated settings and the new revision. Saving does not publish the gallery; publishing is a separate action. The creator's permissions and plan limits apply.`,
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
			description: "Returns the private browser-source URL for adding an overlay to OBS Studio, Streamlabs or other streaming software. Requires the overlay-secret:read permission. The URL contains a credential that grants access to the overlay, so it is only for the creator's own streaming software. Website embeds use the separate public player embed, which contains no credential.",
			run: (raw: unknown) => getOverlayEmbed(principal, { ...toolInputSchemas.get_overlay_link.parse(raw), purpose: "obs_browser_source" }),
		},
	];
}
