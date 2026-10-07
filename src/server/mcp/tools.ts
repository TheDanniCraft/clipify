import { workflowTools } from "./workflows/tools";
import "server-only";
import { listPlaylists, getPlaylist, createPlaylistForPrincipal, updatePlaylist, deletePlaylist, removePlaylistItems, reorderPlaylistItems, addPlaylistItems } from "@/server/resources/playlists";
import { recordMcpCallActivity } from "./activity";
import { toolFailure } from "./errors";
import { ProtocolError, ProtocolErrorCode, type McpServer } from "@modelcontextprotocol/server";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { listCreators, getCapabilities } from "./creators";
import { toolInputSchemas, type ToolName } from "./schemas";
import { toolAnnotations } from "./risk";
import { listOverlays, getOverlay, createOverlayForPrincipal, updateOverlay, deleteOverlay } from "@/server/resources/overlays";

async function readResult(operation: () => Promise<Record<string, unknown>>, principal: TrustedCreatorPrincipal, name: ToolName, input: unknown) {
	let result: Record<string, unknown>;
	try {
		result = await operation();
	} catch (cause) {
		const failure = toolFailure(cause);
		try {
			await recordMcpCallActivity(principal, { tool: name, outcome: failure.structuredContent.error.code === "SERVICE_UNAVAILABLE" ? "error" : "denied", reason: failure.structuredContent.error.code });
		} catch (error) {
			return toolFailure(error);
		}
		return failure;
	}
	if (toolAnnotations(name).readOnlyHint) {
		const selectors = input as { creatorId?: string; overlayId?: string; playlistId?: string; galleryId?: string; runnerId?: string; sessionId?: string } | undefined;
		try {
			await recordMcpCallActivity(principal, {
				tool: name,
				outcome: "success",
				creatorId: selectors?.creatorId,
				targetType: selectors?.overlayId ? "overlay" : selectors?.playlistId ? "playlist" : selectors?.galleryId ? "gallery" : selectors?.runnerId ? "runner" : selectors?.sessionId ? "stream_session" : selectors?.creatorId ? "creator" : "mcp_connection",
				targetId: selectors?.overlayId ?? selectors?.playlistId ?? selectors?.galleryId ?? selectors?.runnerId ?? selectors?.sessionId ?? selectors?.creatorId,
			});
		} catch (error) {
			return toolFailure(error);
		}
	}

	const { imageData, ...snapshotMetadata } = result;
	const metadata = name === "get_runner_snapshot" ? snapshotMetadata : result;
	const images = name === "get_runner_snapshot" && typeof imageData === "string" ? [{ type: "image" as const, data: imageData, mimeType: "image/jpeg" }] : [];
	return { content: [{ type: "text" as const, text: JSON.stringify(metadata) }, ...images], structuredContent: metadata };
}

export function registerMcpTools(server: McpServer, principal: TrustedCreatorPrincipal) {
	const tools = [
		...workflowTools(principal),
		{ name: "list_creators", description: "List approved creators you can currently access", schema: toolInputSchemas.list_creators, run: (input: unknown) => listCreators(principal, toolInputSchemas.list_creators.parse(input)) },
		{ name: "get_capabilities", description: "Read a creator’s current plan limits, usage and permitted operations", schema: toolInputSchemas.get_capabilities, run: (input: unknown) => getCapabilities(principal, toolInputSchemas.get_capabilities.parse(input).creatorId) },
		{ name: "list_overlays", description: "Read approved creator overlays without private credentials", schema: toolInputSchemas.list_overlays, run: (input: unknown) => listOverlays(principal, input) },
		{ name: "get_overlay", description: "Read one approved creator overlay without private credentials", schema: toolInputSchemas.get_overlay, run: (input: unknown) => getOverlay(principal, input) },
		{ name: "create_overlay", description: "Create an overlay within the creator’s plan limits. Reuse the same retry key for retries of this request.", schema: toolInputSchemas.create_overlay, run: (input: unknown) => createOverlayForPrincipal(principal, input) },
		{ name: "update_overlay", description: "Edit overlay configuration using the revision returned by its latest read", schema: toolInputSchemas.update_overlay, run: (input: unknown) => updateOverlay(principal, input) },
		{ name: "list_playlists", description: "List approved creator playlists and their configuration revisions", schema: toolInputSchemas.list_playlists, run: (input: unknown) => listPlaylists(principal, input) },
		{ name: "get_playlist", description: "Read approved playlist metadata and ordered safe clip references", schema: toolInputSchemas.get_playlist, run: (input: unknown) => getPlaylist(principal, input) },
		{ name: "delete_overlay", description: "Delete an overlay with explicit delete permission and its current revision", schema: toolInputSchemas.delete_overlay, run: (input: unknown) => deleteOverlay(principal, input) },
		{ name: "create_playlist", description: "Create a playlist within the creator’s plan limits. Reuse the same retry key when retrying.", schema: toolInputSchemas.create_playlist, run: (input: unknown) => createPlaylistForPrincipal(principal, input) },
		{ name: "update_playlist", description: "Rename a playlist using its current configuration revision", schema: toolInputSchemas.update_playlist, run: (input: unknown) => updatePlaylist(principal, input) },
		{ name: "delete_playlist", description: "Delete a playlist with explicit delete permission and its current revision; clear linked overlay and gallery references", schema: toolInputSchemas.delete_playlist, run: (input: unknown) => deletePlaylist(principal, input) },
		{ name: "remove_playlist_items", description: "Remove selected existing playlist items and return their remaining order using the current revision", schema: toolInputSchemas.remove_playlist_items, run: (input: unknown) => removePlaylistItems(principal, input) },
		{ name: "reorder_playlist_items", description: "Replace playlist item order with an exact permutation using its current revision", schema: toolInputSchemas.reorder_playlist_items, run: (input: unknown) => reorderPlaylistItems(principal, input) },
		{ name: "add_playlist_items", description: "Append Twitch-validated clips within the creator’s current plan limits using the playlist revision", schema: toolInputSchemas.add_playlist_items, run: (input: unknown) => addPlaylistItems(principal, input) },
	] as const;
	for (const tool of tools) server.registerTool(tool.name, { description: tool.description, inputSchema: tool.schema, annotations: toolAnnotations(tool.name) }, (input: unknown) => readResult(() => tool.run(input), principal, tool.name, input));
	// Preserve SDK protocol validation and tool discovery while giving all business
	// input failures the same safe envelope instead of SDK exception strings.
	server.server.setRequestHandler("tools/call", async (request) => {
		const tool = tools.find((tool) => tool.name === request.params.name);
		if (!tool) {
			await recordMcpCallActivity(principal, { outcome: "denied", reason: "INVALID_INPUT" });
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
