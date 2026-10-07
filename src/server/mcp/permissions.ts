import { workflowPermissions } from "./workflows/catalogue";
import type { Permission } from "@/auth/permissions";
import type { ToolName } from "./schemas";
export const toolPermissions = {
	...workflowPermissions,
	list_creators: "creator:read",
	get_capabilities: "creator:read",
	list_overlays: "overlay:read",
	get_overlay: "overlay:read",
	create_overlay: "overlay:create",
	update_overlay: "overlay:update",
	delete_overlay: "overlay:delete",
	list_playlists: "playlist:read",
	get_playlist: "playlist:read",
	create_playlist: "playlist:create",
	update_playlist: "playlist:update",
	delete_playlist: "playlist:delete",
	add_playlist_items: "playlist-items:manage",
	remove_playlist_items: "playlist-items:manage",
	reorder_playlist_items: "playlist-items:manage",
} as const satisfies Record<ToolName, Permission>;
