import type { ToolName } from "./schemas";

/** Human-readable display names shown by MCP hosts and directory listings. */
export const toolTitles = {
	// Focused gallery tools
	update_gallery_settings: "Rename Gallery",
	get_gallery_source: "Get Gallery Clip Source",
	update_gallery_source: "Update Gallery Clip Source",
	get_gallery_filters: "Get Gallery Filters",
	update_gallery_filters: "Update Gallery Filters",
	get_gallery_layout: "Get Gallery Layout",
	update_gallery_layout: "Update Gallery Layout",
	get_gallery_theme: "Get Gallery Theme",
	update_gallery_theme: "Update Gallery Theme",
	// Focused overlay tools
	update_overlay_settings: "Update Overlay Settings",
	get_overlay_source: "Get Overlay Clip Source",
	update_overlay_source: "Update Overlay Clip Source",
	get_overlay_filters: "Get Overlay Filters",
	update_overlay_filters: "Update Overlay Filters",
	get_overlay_playback: "Get Overlay Playback Settings",
	update_overlay_playback: "Update Overlay Playback Settings",
	get_overlay_theme: "Get Overlay Theme",
	update_overlay_theme: "Update Overlay Theme",
	get_overlay_link: "Get Private OBS Overlay Link",
	// Live overlay control
	get_overlay_runtime: "Get Live Overlay Status",
	get_overlay_queues: "Get Overlay Clip Queues",
	play_overlay: "Play Overlay",
	pause_overlay: "Pause Overlay",
	skip_overlay: "Skip Current Clip",
	hide_overlay: "Hide Overlay Player",
	show_overlay: "Show Overlay Player",
	set_overlay_volume: "Set Overlay Volume",
	mute_overlay: "Mute Overlay",
	unmute_overlay: "Unmute Overlay",
	toggle_overlay_mute: "Toggle Overlay Mute",
	control_overlay: "Control Overlay Playback",
	enqueue_overlay_clip: "Queue Clip for Overlay",
	clear_overlay_queue: "Clear Overlay Queue",
	// Clips
	get_clip_crawler_status: "Get Clip Sync Status",
	refresh_clips: "Refresh Clip Library",
	search_clips: "Search Clips",
	resolve_clip: "Find Clip by ID or URL",
	preview_playlist_import: "Preview Playlist Import",
	commit_playlist_import: "Import Clips into Playlist",
	// Galleries
	list_galleries: "List Galleries",
	get_gallery: "Get Gallery",
	create_gallery: "Create Gallery",
	update_gallery: "Update Gallery",
	delete_gallery: "Delete Gallery",
	publish_gallery: "Publish or Unpublish Gallery",
	get_gallery_embed: "Get Gallery Embed Code",
	get_gallery_preview: "Preview Gallery Clips",
	get_overlay_embed: "Get Overlay Browser-Source URL",
	get_player_embed: "Get Website Player Embed Code",
	// Creator Page
	get_creator_page: "Get Creator Page",
	update_creator_page: "Update Creator Page",
	publish_creator_page: "Publish or Unpublish Creator Page",
	// Runners and streams
	get_runner_setup: "Get Runner Setup Instructions",
	list_runners: "List Runners",
	get_runner: "Get Runner",
	create_runner: "Create Runner",
	update_runner: "Rename Runner",
	delete_runner: "Delete Runner",
	unlink_runner: "Disconnect Runner Device",
	list_stream_sessions: "List Stream Sessions",
	get_stream_session: "Get Stream Session",
	configure_stream_session: "Configure Stream Session",
	control_stream_session: "Start or Stop Stream",
	get_runner_snapshot: "Get Runner Preview Snapshot",
	// Feedback
	submit_feedback: "Send Feedback to Clipify",
	// Creators, overlays and playlists
	list_creators: "List Creators",
	get_capabilities: "Get Plan Limits and Permissions",
	list_overlays: "List Overlays",
	get_overlay: "Get Overlay",
	create_overlay: "Create Overlay",
	update_overlay: "Update Overlay",
	delete_overlay: "Delete Overlay",
	list_playlists: "List Playlists",
	get_playlist: "Get Playlist",
	create_playlist: "Create Playlist",
	update_playlist: "Rename Playlist",
	delete_playlist: "Delete Playlist",
	add_playlist_items: "Add Clips to Playlist",
	remove_playlist_items: "Remove Clips from Playlist",
	reorder_playlist_items: "Reorder Playlist Clips",
} as const satisfies Record<ToolName, string>;

export function toolTitle(name: ToolName): string {
	if (!Object.hasOwn(toolTitles, name)) throw new Error("INVALID_INPUT");
	return toolTitles[name];
}
