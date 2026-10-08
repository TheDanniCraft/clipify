import type { McpServer } from "@modelcontextprotocol/server";

export const MCP_INSTRUCTIONS =
	"Manage only creators approved for this connection. Begin with list_creators and get_capabilities. Use focused overlay/gallery source, filters, playback/layout and theme tools for configuration changes; omitted fields stay unchanged. Read the relevant settings first and pass their configurationRevision as expectedRevision; reread on CONFLICT instead of overwriting newer changes. Saved playback settings differ from ephemeral control_overlay commands. For bulk playlist imports, present preview_playlist_import results and obtain user confirmation before commit_playlist_import. get_overlay_link returns a private credential-bearing streaming browser-source URL; get_player_embed and get_gallery_embed produce public website embeds. Scope approval does not bypass creator roles or plan limits. Tool annotations are hints; consequential actions still need the host's appropriate confirmation. Optional prompts provide suggested workflows, not permission to execute them automatically.";

import { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";
export { MCP_EXAMPLE_PROMPTS } from "@lib/mcpPrompts";

export function registerMcpPrompts(server: McpServer) {
	for (const prompt of MCP_EXAMPLE_PROMPTS) {
		server.registerPrompt(prompt.name, { title: prompt.title, description: prompt.example }, () => ({
			description: prompt.title,
			messages: [{ role: "user" as const, content: { type: "text" as const, text: `${prompt.example}\n\nBegin with list_creators and get_capabilities for the selected creator; clarify ambiguous targets and respect permissions and plan limits. ${prompt.workflow}` } }],
		}));
	}
}
