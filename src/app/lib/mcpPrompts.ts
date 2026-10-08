/** Static suggestions contain no account data or credentials and never execute tools. */
export const MCP_EXAMPLE_PROMPTS = [
	{ name: "style-overlay", title: "Style an overlay", example: "Give my overlay a purple theme with rounded corners and a visible progress bar.", workflow: "Use list_overlays to select the intended overlay, get_overlay_theme to inspect Theme Studio settings, then update_overlay_theme with only requested fields and the latest expectedRevision. Preserve its filters, playback and name." },
	{
		name: "filter-overlay",
		title: "Choose overlay clips",
		example: "Show Minecraft clips with at least 100 views and exclude clips shorter than 10 seconds.",
		workflow:
			"Select the overlay with list_overlays, inspect get_overlay_source and get_overlay_filters, then update_overlay_filters with the requested rules and current expectedRevision. Category lists use Twitch category IDs, not names; search_clips with the category name can provide verified categoryId values from matching clips. If no clips verify the ID, ask for a verified ID rather than guessing. Clip-creator lists use Twitch usernames. Explain when the chosen source does not use those filters. Changing source requires a separate update_overlay_source call.",
	},
	{
		name: "import-clips",
		title: "Preview and import clips",
		example: "Show me which Minecraft clips from yesterday you would add to my playlist.",
		workflow: "Select the playlist with list_playlists and get_playlist. Clarify timezone if needed and convert yesterday into explicit absolute date bounds. Use preview_playlist_import with filters, show the exact selection, duplicates, quota and any incomplete discovery, then obtain confirmation before commit_playlist_import. For explicit single additions use resolve_clip and add_playlist_items; use search_clips for ambiguous titles.",
	},
	{
		name: "style-gallery",
		title: "Design a gallery",
		example: "Make my gallery a dark carousel and give me the website embed code.",
		workflow: "Select the gallery using list_galleries. Inspect get_gallery_layout and get_gallery_theme, then change only requested fields with update_gallery_layout and update_gallery_theme. Each change advances the shared revision; use the returned revision for the next call. Publication is a separate publish_gallery action. Return get_gallery_embed installation instructions and explain whether the gallery is published.",
	},
	{
		name: "streaming-link",
		title: "Connect a streaming browser source",
		example: "Give me the browser-source link for my streaming application.",
		workflow: "Select the overlay with list_overlays and call get_overlay_link only if this connection has explicit overlay-secret:read approval. Explain that the URL contains a private credential and belongs in the streaming application's browser source, not a public website. Never put it into public HTML. Use get_player_embed for website integration.",
	},
	{
		name: "control-live-overlay",
		title: "Control live playback",
		example: "What clip is playing? Set its volume to 40% and queue this Twitch clip next.",
		workflow: "Select the overlay using list_overlays, inspect get_overlay_runtime and report its timestamp/freshness. Use control_overlay for temporary volume, and enqueue_overlay_clip for the requested Twitch clip with a retryKey. Explain that the moderator queue is creator-wide and command acceptance is not proof of playback. Check the required Pro capability first.",
	},
] as const;
