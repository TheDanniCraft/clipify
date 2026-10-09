import { registerMcpPrompts } from "./prompts";
import { focusedTools } from "./focused-tools";
import { workflowTools } from "./workflows/tools";
import "server-only";
import { listPlaylists, getPlaylist, createPlaylistForPrincipal, updatePlaylist, deletePlaylist, removePlaylistItems, reorderPlaylistItems, addPlaylistItems } from "@/server/resources/playlists";
import { recordMcpCallActivity } from "./activity";
import { toolFailure } from "./errors";
import { ProtocolError, ProtocolErrorCode, type McpServer } from "@modelcontextprotocol/server";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { listCreators, getCapabilities } from "./creators";
import { toolInputSchemas, publicToolNames, type ToolName } from "./schemas";
import { toolAnnotations } from "./risk";
import { mcpToolCatalogue } from "./catalogue";
import { listOverlays, getOverlay, createOverlayForPrincipal, deleteOverlay } from "@/server/resources/overlays";

import { reportMcpToolOutcome } from "./metrics-dispatch";

function measuredFailure(cause: unknown) {
	const failure = toolFailure(cause);
	reportMcpToolOutcome(failure.structuredContent.error.code === "SERVICE_UNAVAILABLE" ? "error" : "denied", failure.structuredContent.error.code);
	return failure;
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
			return measuredFailure(error);
		}
	}

	reportMcpToolOutcome("success");
	const { imageData, ...snapshotMetadata } = result;
	const metadata = name === "get_runner_snapshot" ? snapshotMetadata : result;
	const images = name === "get_runner_snapshot" && typeof imageData === "string" ? [{ type: "image" as const, data: imageData, mimeType: "image/jpeg" }] : [];
	return { content: [{ type: "text" as const, text: JSON.stringify(metadata) }, ...images], structuredContent: metadata };
}

export function registerMcpTools(server: McpServer, principal: TrustedCreatorPrincipal) {
	registerMcpPrompts(server);
	const tools = [
		...workflowTools(principal),
		...focusedTools(principal),
		{ name: "list_creators", run: (input: unknown) => listCreators(principal, toolInputSchemas.list_creators.parse(input)) },
		{ name: "get_capabilities", run: (input: unknown) => getCapabilities(principal, toolInputSchemas.get_capabilities.parse(input).creatorId) },
		{ name: "list_overlays", run: (input: unknown) => listOverlays(principal, input) },
		{ name: "get_overlay", run: (input: unknown) => getOverlay(principal, input) },
		{ name: "create_overlay", run: (input: unknown) => createOverlayForPrincipal(principal, input) },
		{ name: "list_playlists", run: (input: unknown) => listPlaylists(principal, input) },
		{ name: "get_playlist", run: (input: unknown) => getPlaylist(principal, input) },
		{ name: "delete_overlay", run: (input: unknown) => deleteOverlay(principal, input) },
		{ name: "create_playlist", run: (input: unknown) => createPlaylistForPrincipal(principal, input) },
		{ name: "update_playlist", run: (input: unknown) => updatePlaylist(principal, input) },
		{ name: "delete_playlist", run: (input: unknown) => deletePlaylist(principal, input) },
		{ name: "remove_playlist_items", run: (input: unknown) => removePlaylistItems(principal, input) },
		{ name: "reorder_playlist_items", run: (input: unknown) => reorderPlaylistItems(principal, input) },
		{ name: "add_playlist_items", run: (input: unknown) => addPlaylistItems(principal, input) },
	] as const;
	const handlers = new Map<ToolName, (input: unknown) => Promise<Record<string, unknown>>>(tools.map((tool) => [tool.name, tool.run]));
	const registeredTools = publicToolNames.map((name) => {
		const run = handlers.get(name);
		if (!run) throw new Error(`Missing MCP handler: ${name}`);
		return { name, run };
	});
	for (const tool of registeredTools) {
		const definition = mcpToolCatalogue[tool.name];
		server.registerTool(tool.name, { title: definition.title, description: definition.description, inputSchema: toolInputSchemas[tool.name], annotations: definition.annotations }, (input: unknown) => readResult(() => tool.run(input), principal, tool.name, input));
	}
	// Preserve SDK protocol validation and tool discovery while giving all business
	// input failures the same safe envelope instead of SDK exception strings.
	server.server.setRequestHandler("tools/call", async (request) => {
		const tool = registeredTools.find((tool) => tool.name === request.params.name);
		if (!tool) {
			await recordMcpCallActivity(principal, { outcome: "denied", reason: "INVALID_INPUT" });
			reportMcpToolOutcome("denied", "INVALID_INPUT");
			throw new ProtocolError(ProtocolErrorCode.InvalidParams, "This tool is unavailable");
		}
		const input = toolInputSchemas[tool.name].safeParse(request.params.arguments ?? {});
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
