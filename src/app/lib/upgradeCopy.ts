const upgradeCopy: Record<string, { title: string; description: string }> = {
	creator_social_preview: { title: "Make every share yours with Pro", description: "Choose the title and description people see when they share your Creator Page." },
	creator_analytics: { title: "Understand your audience with Pro", description: "See how people discover and use your Creator Page, and export the results for your reports." },
	playlist_import: { title: "Build playlists faster with Pro", description: "Import clips with advanced filters instead of adding each clip by hand." },
	trial_active: { title: "Keep your Pro features", description: "Continue using your Pro tools after your trial ends with a Pro subscription." },
	runner_scheduling: { title: "Schedule your broadcasts with Pro", description: "Plan when your clips go live and let your Runner follow the schedule." },
	multi_overlay: { title: "Create more overlays with Pro", description: "Give each scene its own overlay, with no limit on how many you create." },
	multi_playlist: { title: "Build more playlists with Pro", description: "Keep separate clip collections for different games, shows, and stream moments." },
	multi_gallery: { title: "Publish more galleries with Pro", description: "Create separate clip galleries for your website, events, and communities." },
	advanced_filters: { title: "Choose the right clips with Pro", description: "Refine your clip selection with advanced filters and take control of playback." },
	theme_studio: { title: "Design your overlay with Pro", description: "Make your overlay fit your stream with custom layouts, colors, typography, and effects." },
	gallery_filters: { title: "Refine your gallery with Pro", description: "Choose which clips appear using category, views, duration, title, and creator filters." },
};

export function getUpgradeCopy(feature: string) {
	return Object.hasOwn(upgradeCopy, feature) ? upgradeCopy[feature] : undefined;
}
