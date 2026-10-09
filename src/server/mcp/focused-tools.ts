import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { getOverlay, updateOverlay } from "@/server/resources/overlays";
import { getGalleryForPrincipal, updateGalleryForPrincipal, getOverlayEmbed } from "@/server/resources/galleries";
import { mcpToolCatalogue } from "./catalogue";
import { overlayFieldGroups, galleryFieldGroups } from "./focused-fields";
import { focusedOverlaySchemas, focusedGallerySchemas, toolInputSchemas } from "./schemas";

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
			description: mcpToolCatalogue[name].description,
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
			description: mcpToolCatalogue[name].description,
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
			description: mcpToolCatalogue.get_overlay_link.description,
			run: (raw: unknown) => getOverlayEmbed(principal, { ...toolInputSchemas.get_overlay_link.parse(raw), purpose: "obs_browser_source" }),
		},
	];
}
