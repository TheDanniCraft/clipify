import { trackMcpToolResult } from "./journey";
import { emptyResourceGuidance, clipGuidance } from "./entry-guidance";
import { getClipCrawlerStatus } from "@/server/resources/clip-cache";
import { registerMcpPrompts } from "./prompts";
import { focusedTools } from "./focused-tools";
import { workflowTools } from "./workflows/tools";
import "server-only";
import { listPlaylists, getPlaylist, createPlaylistForPrincipal, updatePlaylist, deletePlaylist, removePlaylistItems, reorderPlaylistItems, addPlaylistItems } from "@/server/resources/playlists";
import { recordMcpCallActivity } from "./activity";
import { toolFailure } from "./errors";
import { isResourceFailure } from "@/server/resources/errors";
import { ProtocolError, ProtocolErrorCode, type McpServer } from "@modelcontextprotocol/server";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { listCreators, getCapabilities } from "./creators";
import { toolInputSchemas, type ToolName } from "./schemas";
import { toolAnnotations } from "./risk";
import { toolTitle } from "./titles";
import { listOverlays, getOverlay, createOverlayForPrincipal, deleteOverlay } from "@/server/resources/overlays";

import { reportMcpToolOutcome } from "./metrics-dispatch";

function measuredFailure(cause: unknown) {
	const failure = toolFailure(cause);
	reportMcpToolOutcome(failure.structuredContent.error.code === "SERVICE_UNAVAILABLE" ? "error" : "denied", failure.structuredContent.error.code);
	return failure;
}

function readActivityTarget(input: unknown) {
	const selectors = input as { creatorId?: string; overlayId?: string; playlistId?: string; galleryId?: string; runnerId?: string; sessionId?: string } | undefined;
	const targetFields = [
		["overlayId", "overlay"],
		["playlistId", "playlist"],
		["galleryId", "gallery"],
		["runnerId", "runner"],
		["sessionId", "stream_session"],
		["creatorId", "creator"],
	] as const;
	const targets = targetFields.map(([field, type]) => ({ id: selectors?.[field], type }));
	return { creatorId: selectors?.creatorId, targetType: targets.find((target) => !!target.id)?.type ?? "mcp_connection", targetId: targets.find((target) => target.id !== undefined && target.id !== null)?.id };
}
function readResultContent(name: ToolName, result: Record<string, unknown>) {
	const { imageData, ...snapshotMetadata } = result;
	const metadata = name === "get_runner_snapshot" ? snapshotMetadata : result;
	const images = name === "get_runner_snapshot" && typeof imageData === "string" ? [{ type: "image" as const, data: imageData, mimeType: "image/jpeg" }] : [];
	return { content: [{ type: "text" as const, text: JSON.stringify(metadata) }, ...images], structuredContent: metadata };
}

async function readResult(operation: () => Promise<Record<string, unknown>>, principal: TrustedCreatorPrincipal, name: ToolName, input: unknown) {
	let result: Record<string, unknown>;
	try {
		result = await operation();
	} catch (cause) {
		const failure = toolFailure(cause);
		try {
			await recordMcpCallActivity(principal, { tool: name, outcome: failure.structuredContent.error.code === "SERVICE_UNAVAILABLE" ? "error" : "denied", reason: failure.structuredContent.error.code });
		} catch (error) {
			return measuredFailure(error);
		}
		return measuredFailure(cause);
	}
	if (isResourceFailure(result)) {
		try {
			await recordMcpCallActivity(principal, { tool: name, outcome: "denied", reason: result.error.code });
		} catch (error) {
			return measuredFailure(error);
		}
		reportMcpToolOutcome("denied", result.error.code);
		return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(result.error) }], structuredContent: { error: result.error } };
	}
	// Add recovery only after the resource read has passed authorization.
	const selectors = input as { creatorId?: string; cursor?: string } | undefined;
	if ((name === "list_overlays" || name === "list_playlists") && Array.isArray(result.items) && result.items.length === 0 && !selectors?.cursor) {
		result = { ...result, guidance: emptyResourceGuidance(name) };
	}
	if (name === "search_clips" && selectors?.creatorId && Array.isArray(result.items)) {
		try {
			const status = await getClipCrawlerStatus(principal, { creatorId: selectors.creatorId });
			if (typeof status.collectionState === "string") {
				result = { ...result, complete: status.inventoryReady === true && result.complete === true, collection: status, ...(!result.items.length ? { guidance: clipGuidance(status.collectionState as Parameters<typeof clipGuidance>[0], status.canRefresh === true, Number(status.cachedClipCount)) } : {}) };
			}
		} catch {
			// A status outage must not discard otherwise usable search results.
			result = { ...result, complete: false, guidance: { reason: "status_unavailable", message: "Collection status is unavailable. Do not infer that this channel has no clips; retry get_clip_crawler_status.", nextStep: { tool: "get_clip_crawler_status" } } };
		}
	}
	if (toolAnnotations(name).readOnlyHint) {
		try {
			await recordMcpCallActivity(principal, {
				tool: name,
				outcome: "success",
				...readActivityTarget(input),
				resultState: result.guidance && typeof result.guidance === "object" && "reason" in result.guidance ? String(result.guidance.reason) : Array.isArray(result.items) ? (result.items.length ? "items_returned" : "empty_page") : undefined,
			});
		} catch (error) {
			return measuredFailure(error);
		}
	}

	if (!toolAnnotations(name).readOnlyHint) trackMcpToolResult(principal, { tool: name, outcome: "success" });
	reportMcpToolOutcome("success");
	return readResultContent(name, result);
}

export function registerMcpTools(server: McpServer, principal: TrustedCreatorPrincipal) {
	registerMcpPrompts(server);
	const tools = [
		...workflowTools(principal),
		...focusedTools(principal),
		{ name: "list_creators", description: "Lists the Twitch creators this connection is approved to access, with each creator's ID, name and stored Twitch avatarUrl (a default Twitch avatar counts as stored; null when unavailable). Every other Clipify tool needs one of these creator IDs, so use this first.", schema: toolInputSchemas.list_creators, run: (input: unknown) => listCreators(principal, toolInputSchemas.list_creators.parse(input)) },
		{ name: "get_capabilities", description: "Returns a creator's current plan limits, usage and the operations this connection is allowed to perform. Use it before creating resources, or to explain why an action was denied for plan or permission reasons.", schema: toolInputSchemas.get_capabilities, run: (input: unknown) => getCapabilities(principal, toolInputSchemas.get_capabilities.parse(input).creatorId) },
		{ name: "list_overlays", description: "Lists a creator's overlays with their saved configuration and configurationRevision. Private OBS browser-source links are not included.", schema: toolInputSchemas.list_overlays, run: (input: unknown) => listOverlays(principal, input) },
		{ name: "get_overlay", description: "Returns one overlay's full saved configuration and configurationRevision. The private OBS browser-source link is not included.", schema: toolInputSchemas.get_overlay, run: (input: unknown) => getOverlay(principal, input) },
		{ name: "create_overlay", description: "Creates a new overlay for a creator, within the number of overlays the creator's plan allows. Returns the new overlay and its configurationRevision.", schema: toolInputSchemas.create_overlay, run: (input: unknown) => createOverlayForPrincipal(principal, input) },
		{ name: "list_playlists", description: "Lists a creator's playlists with their names and configurationRevision.", schema: toolInputSchemas.list_playlists, run: (input: unknown) => listPlaylists(principal, input) },
		{ name: "get_playlist", description: "Returns a playlist's name, configurationRevision and its clips in order. Each clip includes its stored title, duration, attribution and real Twitch thumbnailUrl (null when unavailable); older entries may have incomplete metadata.", schema: toolInputSchemas.get_playlist, run: (input: unknown) => getPlaylist(principal, input) },
		{ name: "delete_overlay", description: "Deletes an overlay. Requires the overlay delete permission and the overlay's current revision.", schema: toolInputSchemas.delete_overlay, run: (input: unknown) => deleteOverlay(principal, input) },
		{ name: "create_playlist", description: "Creates a new, empty playlist for a creator, within the number of playlists the creator's plan allows. Returns the new playlist and its configurationRevision.", schema: toolInputSchemas.create_playlist, run: (input: unknown) => createPlaylistForPrincipal(principal, input) },
		{ name: "update_playlist", description: "Renames a playlist. Requires the playlist's current revision.", schema: toolInputSchemas.update_playlist, run: (input: unknown) => updatePlaylist(principal, input) },
		{ name: "delete_playlist", description: "Deletes a playlist. Overlays and galleries that used it lose their playlist link. Requires the playlist delete permission and the playlist's current revision.", schema: toolInputSchemas.delete_playlist, run: (input: unknown) => deletePlaylist(principal, input) },
		{ name: "remove_playlist_items", description: "Removes the given items from a playlist and returns the remaining items in order. Requires the playlist's current revision.", schema: toolInputSchemas.remove_playlist_items, run: (input: unknown) => removePlaylistItems(principal, input) },
		{ name: "reorder_playlist_items", description: "Sets a new order for a playlist. itemIds must contain every current item exactly once, in the new order. Requires the playlist's current revision.", schema: toolInputSchemas.reorder_playlist_items, run: (input: unknown) => reorderPlaylistItems(principal, input) },
		{ name: "add_playlist_items", description: "Appends Twitch clips to the end of a playlist. Each clip is validated with Twitch, and the playlist size limit of the creator's plan applies. Requires the playlist's current revision.", schema: toolInputSchemas.add_playlist_items, run: (input: unknown) => addPlaylistItems(principal, input) },
	] as const;
	for (const tool of tools) server.registerTool(tool.name, { title: toolTitle(tool.name), description: tool.description, inputSchema: tool.schema, annotations: { title: toolTitle(tool.name), ...toolAnnotations(tool.name) } }, (input: unknown) => readResult(() => tool.run(input), principal, tool.name, input));
	// Preserve SDK protocol validation and tool discovery while giving all business
	// input failures the same safe envelope instead of SDK exception strings.
	server.server.setRequestHandler("tools/call", async (request) => {
		const tool = tools.find((tool) => tool.name === request.params.name);
		if (!tool) {
			await recordMcpCallActivity(principal, { outcome: "denied", reason: "INVALID_INPUT" });
			reportMcpToolOutcome("denied", "INVALID_INPUT");
			throw new ProtocolError(ProtocolErrorCode.InvalidParams, "This tool is unavailable");
		}
		const input = tool.schema.safeParse(request.params.arguments ?? {});
		const result = await readResult(
			async () => {
				if (!input.success) throw new Error("INVALID_INPUT");
				return tool.run(input.data);
			},
			principal,
			tool.name,
			input.success ? input.data : undefined,
		);
		return server.server.projectCallToolResult(result, undefined);
	});
}
