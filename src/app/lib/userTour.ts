export const tourModalSelector = '[data-slot="modal-dialog"], dialog[open], [role="dialog"][aria-modal="true"]:not(.driver-popover):not([data-slot$="-popover"])';
export const tourPopoverSelector = '[data-slot="select-popover"], [data-slot="color-picker-popover"], [data-slot="popover-dialog"]';

/** Instructional state only: this module never grants access or mutates resources. */
export const journeys = [
	{
		id: "overlay",
		title: "Get your first overlay running",
		optional: false,
		tasks: [
			{ id: "overlay.name", title: "Create and name your overlay" },
			{ id: "overlay.source", title: "Choose your clips" },
			{ id: "overlay.preview", title: "Preview your overlay" },
			{ id: "overlay.setup", title: "Add it to OBS or Streamlabs" },
		],
	},
	{ id: "appearance", title: "Make your overlay yours", optional: true, tasks: [{ id: "appearance.style", title: "Customize and save your look" }] },
	{
		id: "playlist",
		title: "Build a playlist",
		optional: true,
		tasks: [
			{ id: "playlist.name", title: "Create and name a playlist" },
			{ id: "playlist.clips", title: "Add, arrange and save clips" },
			{ id: "playlist.use", title: "Use your playlist in an overlay" },
		],
	},
	{ id: "website", title: "Bring Clipify to your website", optional: true, tasks: [{ id: "website.embed", title: "Install a Clip Player on your website" }] },
	{
		id: "explore",
		title: "Explore Clipify",
		optional: true,
		tasks: [
			{ id: "explore.galleries", title: "Discover clip galleries" },
			{ id: "explore.tools", title: "Explore website tools" },
			{ id: "explore.support", title: "Find help and report a problem" },
		],
	},
] as const;
export type TaskId = (typeof journeys)[number]["tasks"][number]["id"];
const tasks = new Set<string>(journeys.flatMap((journey) => journey.tasks.map((task) => task.id)));
export const isTaskId = (value: unknown): value is TaskId => typeof value === "string" && tasks.has(value);
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export type GuideProgress = {
	version: 1;
	completed: TaskId[];
	skipped: TaskId[];
	overlayId: string | null;
	playlistId: string | null;
	copiedOverlayId: string | null;
	active: { task: TaskId; index: number; paused: boolean; done?: boolean } | null;
	minimized: boolean;
};
export const defaultProgress = (): GuideProgress => ({ version: 1, completed: [], skipped: [], overlayId: null, playlistId: null, copiedOverlayId: null, active: null, minimized: false });
export const storageKey = (accountId: string) => `clipify:user-tour:v1:${accountId}`;
export function parseProgress(raw: string | null): GuideProgress {
	try {
		const data = JSON.parse(raw ?? "null");
		if (!data || Array.isArray(data) || data.version !== 1 || !Array.isArray(data.completed)) return defaultProgress();
		const progress: GuideProgress = { ...defaultProgress(), completed: [...new Set<TaskId>(data.completed.filter(isTaskId))], skipped: Array.isArray(data.skipped) ? [...new Set<TaskId>(data.skipped.filter(isTaskId))].filter((task) => !data.completed.includes(task)) : [], overlayId: validId(data.overlayId) ? data.overlayId : null, playlistId: validId(data.playlistId) ? data.playlistId : null, minimized: data.minimized !== false };
		if (validId(data.copiedOverlayId) && data.copiedOverlayId === progress.overlayId) progress.copiedOverlayId = data.copiedOverlayId;
		if (data.active && isTaskId(data.active.task) && Number.isInteger(data.active.index) && data.active.index >= 0 && data.active.index < stepsForTask(data.active.task, progress).length) progress.active = { task: data.active.task, index: data.active.index, paused: true, ...(data.active.done === true ? { done: true } : {}) };
		return progress;
	} catch {
		return defaultProgress();
	}
}

type Owned = { ownerId: string; id: string; select?: boolean };
export type GuideEvent =
	| ({ type: "overlay.ready" | "overlay.created" | "overlay.copied" } & Owned)
	| ({ type: "overlay.saved"; named: boolean; source: boolean; playlistId?: string | null } & Owned)
	| ({ type: "overlay.previewed"; count: number } & Owned)
	| ({ type: "theme.saved"; changed: boolean } & Owned)
	| ({ type: "playlist.ready" | "playlist.created" } & Owned)
	| ({ type: "playlist.saved"; named: boolean; count: number } & Owned)
	| { type: "start" | "task.skip" | "task.restore"; task: TaskId }
	| ({ type: "website.copied" } & Owned)
	| { type: "pause" | "resume" | "next" | "setup.confirmed" }
	| { type: "panel"; minimized: boolean }
	| { type: "resource.reset"; resource: "overlay" | "playlist" };

export function transition(progress: GuideProgress, event: GuideEvent, accountId: string): GuideProgress {
	if ("ownerId" in event && (event.ownerId !== accountId || !validId(event.id))) return progress;
	let next: GuideProgress = { ...progress, completed: [...progress.completed], skipped: [...progress.skipped] };
	const complete = (task: TaskId) => {
		if (!next.completed.includes(task)) next.completed.push(task);
		next.skipped = next.skipped.filter((id) => id !== task);
		if (next.active?.task === task) next = { ...next, active: { ...next.active, done: true }, minimized: false };
	};
	switch (event.type) {
		case "task.skip":
			if (!next.skipped.includes(event.task) && !next.completed.includes(event.task)) next.skipped.push(event.task);
			return { ...next, active: next.active?.task === event.task ? null : next.active, minimized: false };
		case "task.restore":
			return { ...next, completed: next.completed.filter((id) => id !== event.task), skipped: next.skipped.filter((id) => id !== event.task), active: next.active?.task === event.task && next.active.done ? null : next.active };
		case "start":
			return { ...next, active: { task: event.task, index: event.task === "overlay.name" && next.completed.includes(event.task) && next.overlayId ? 1 : 0, paused: false }, minimized: event.task !== "explore.support" };
		case "pause":
			return { ...next, active: next.active ? { ...next.active, paused: true } : null, minimized: false };
		case "resume":
			return { ...next, active: next.active ? { ...next.active, paused: false } : null, minimized: next.active?.task !== "explore.support" };
		case "next": {
			if (!next.active || next.active.done) return progress;
			const steps = stepsForTask(next.active.task, next);
			if (steps[next.active.index]?.finish) {
				if (steps[next.active.index]?.skipOnFinish) {
					if (!next.completed.includes(next.active.task) && !next.skipped.includes(next.active.task)) next.skipped.push(next.active.task);
					return { ...next, active: { ...next.active, done: true }, minimized: false };
				}
				complete(next.active.task);
				return next;
			}
			if (next.active.index >= steps.length - 1 || !steps[next.active.index]?.next) return progress;
			return { ...next, active: { ...next.active, index: next.active.index + 1 } };
		}
		case "resource.reset":
			if (event.resource === "overlay") {
				next.overlayId = null;
				next.copiedOverlayId = null;
			} else next.playlistId = null;
			return { ...next, active: next.active ? { ...next.active, index: 0, paused: true } : null, minimized: false };
		case "panel":
			return { ...next, minimized: event.minimized };
		case "overlay.ready":
			if (next.active?.task === "overlay.name" && next.active.index === 0) {
				if (!event.select) break;
				next.active = { ...next.active, index: 1 };
			}
			if (event.select || !next.overlayId) {
				if (next.overlayId !== event.id) next.copiedOverlayId = null;
				next.overlayId = event.id;
			}
			break;
		case "overlay.created":
			next.overlayId = event.id;
			if (next.active) next.active = { ...next.active, index: next.active.task === "overlay.name" ? 1 : 0 };
			next.copiedOverlayId = null;
			break;
		case "overlay.saved":
			next.overlayId = event.id;
			if (event.named) complete("overlay.name");
			if (event.source && (!next.active || next.active.task === "overlay.source")) complete("overlay.source");
			if (event.playlistId && event.playlistId === next.playlistId) complete("playlist.use");
			break;
		case "overlay.previewed":
			if (event.id === next.overlayId && event.count > 0) complete("overlay.preview");
			break;
		case "overlay.copied":
			if (event.id !== next.overlayId) return progress;
			next.copiedOverlayId = event.id;
			if (next.active?.task === "overlay.setup" && !next.active.done) next.active = { ...next.active, index: 1 };
			break;
		case "setup.confirmed":
			if (next.overlayId && next.copiedOverlayId === next.overlayId) complete("overlay.setup");
			break;
		case "website.copied":
			if (next.active?.task === "website.embed" && next.active.index === 1) next.active = { ...next.active, index: 2 };
			break;
		case "theme.saved":
			if (event.changed) complete("appearance.style");
			break;
		case "playlist.ready":
			if (event.select || !next.playlistId) next.playlistId = event.id;
			break;
		case "playlist.created":
			next.playlistId = event.id;
			if (next.active) next.active = { ...next.active, index: 0 };
			break;
		case "playlist.saved":
			next.playlistId = event.id;
			if (event.named) complete("playlist.name");
			if (event.count > 0) complete("playlist.clips");
			break;
	}
	return next;
}

export function routeForTask(task: TaskId, progress: GuideProgress): string {
	const index = progress.active?.task === task ? progress.active.index : 0;
	if (task === "overlay.name" && index === 0) return "/dashboard";
	if (task === "website.embed" || task === "explore.tools") return "/dashboard/tools";
	if (task.startsWith("explore.")) return "/dashboard";
	if (task === "playlist.use" && !progress.playlistId) return "/dashboard";
	if (task === "playlist.name" || task === "playlist.clips") return progress.playlistId ? `/dashboard/playlist/${progress.playlistId}` : "/dashboard";
	if (!progress.overlayId) return "/dashboard";
	return `/dashboard/overlay/${progress.overlayId}${task === "appearance.style" && index > 0 ? "/theme" : ""}`;
}
export type GuideStep = { target: string; title: string; description: string; next?: boolean; action?: boolean; finish?: boolean; nextLabel?: string; skipOnFinish?: boolean; allowDialog?: boolean };
export function stepsForTask(task: TaskId, progress: GuideProgress): GuideStep[] {
	if (task === "playlist.use" && !progress.playlistId) return stepsForTask("playlist.name", progress);
	const createOverlay: GuideStep = { target: "create-overlay", title: "Create your first overlay", description: "Click Add Overlay. Your overlay will use your channel’s clips. Already have one? Open it from the dashboard, then resume this guide." };
	if (task.startsWith("overlay.") || task === "appearance.style" || task === "playlist.use") {
		if (!progress.overlayId && task !== "overlay.name") return [createOverlay];
	}
	switch (task) {
		case "overlay.name":
			return [createOverlay, { target: "overlay-name", title: "Give it a name", description: "Choose a name you’ll recognize, such as BRB clips. Then continue to save it.", next: true }, { target: "overlay-save", title: "Save your overlay", description: "Click Save to keep your name and clip settings. The checklist updates after the save succeeds." }];
		case "overlay.source":
			return [
				{ target: "overlay-source", title: "Choose which clips play", description: "Choose a time range, such as Top Clips — Last 30 Days. You can fine-tune filters in the next step. If no clips match, try a broader range.", next: true },
				{ target: "overlay-filters", title: "Fine-tune your clip selection", description: "Review duration, game and creator filters here. Advanced filters require Pro. Keep the defaults if they suit you; nothing changes until you save.", next: true },
				{ target: "overlay-save", title: "Save your clip settings", next: true, finish: true, skipOnFinish: true, nextLabel: "Use current settings", description: "Save if you changed anything. Keeping the defaults? Choose Use current settings here in the guide; the app’s Save button stays unchanged." },
			];
		case "overlay.preview":
			return [{ target: "overlay-preview", allowDialog: true, title: "Check your clips", description: "Open Preview Clips. If no clips match, choose a broader time range or check crawl status in Settings. A nonempty preview completes this task." }];
		case "overlay.setup":
			return [
				{ target: "overlay-copy", title: "Copy your overlay URL", description: "Click this copy button for your private OBS / Streamlabs browser source URL. Keep this URL private." },
				{ target: "overlay-copy", title: "Add a Browser Source", description: "In OBS or Streamlabs, add Sources → + → Browser. Paste the copied URL, set width 1920 and height 1080, then save. Clips not appearing? Check that the source is visible and your overlay has matching clips. Help is available from the guide.", next: true, finish: true, nextLabel: "Finish setup guide" },
			];
		case "appearance.style":
			return [
				{ target: "overlay-customize", title: "Open Theme Studio", description: "Click Customize Overlay Style to open the editor.", next: true, action: true },
				{ target: "theme-controls", title: "Make it yours", description: "Change a visible setting and check the live preview. You can keep the default look and finish the guide without changing it.", next: true },
				{ target: "theme-save", title: "Save your look", description: "Click Save Style after making a change, or choose Keep default look here in the guide.", next: true, finish: true, skipOnFinish: true, nextLabel: "Keep default look" },
			];
		case "website.embed":
			return [
				{ target: "tools-player", title: "Choose your website player", description: "Choose an existing overlay as your player. If this list is empty, create your first overlay from the checklist first.", next: true },
				{ target: "website-copy", title: "Copy website embed code", description: "Copy the iframe code using this button. This is the public website embed, separate from your private OBS URL." },
				{ target: "website-code", title: "Install on your website", description: "Paste this code into a Custom HTML or Embed block on your website, publish the page and check playback. Browser autoplay may require muted playback. Clipify cannot verify your external website; finish when you are ready.", next: true, finish: true, nextLabel: "Finish website guide" },
			];
		case "explore.galleries":
			return [
				{ target: "galleries-tab", title: "Open Galleries", description: "Click Galleries to see your collections. Galleries display a browsable collection of clips on your website.", next: true, action: true },
				{ target: "gallery-list", title: "Your clip galleries", description: "Open an existing gallery or use Add Gallery to build one. Configure its clips and appearance, then publish it before installing it with the Clip Gallery website tool.", next: true, finish: true, nextLabel: "Finish introduction" },
			];
		case "explore.tools":
			return [{ target: "tools-tabs", title: "Website tools", description: "Clip Player embeds a playing overlay. Clip Gallery installs a browsable collection with Clipify Elements. Choose a tool, configure it and copy its installation code. The website guide walks through Clip Player installation.", next: true, finish: true, nextLabel: "Finish introduction" }];
		case "explore.support":
			return [{ target: "guide-support", title: "We are here to help", description: "Use Report a problem in the bottom-right corner for a bug, or the chat icon in the bottom-left for help. Chat may ask for functionality consent first; your choice is respected. The help center is always available below.", next: true, finish: true, nextLabel: "Got it" }];

		case "playlist.name":
			return progress.playlistId
				? [
						{ target: "playlist-name", title: "Name your playlist", description: "Give this collection a useful name, such as Favorite moments.", next: true },
						{ target: "playlist-save", title: "Save your playlist", next: true, finish: true, skipOnFinish: true, nextLabel: "Keep current playlist", description: "Click Save Playlist after changing its name. Keeping the name? Use Keep current playlist here in the guide." },
					]
				: [
						{ target: "playlists-tab", title: "Open Playlists", description: "Switch to Playlists to create your clip collection.", next: true, action: true },
						{ target: "create-playlist", title: "Create a playlist", description: "Click Add Playlist. If you already have one, open it and resume this guide." },
					];
		case "playlist.clips":
			return progress.playlistId
				? [
						{ target: "playlist-add", allowDialog: true, title: "Choose your clips", description: "Click Add Clips, select clips and add them to your playlist. Close the selector when you’re ready, then continue.", next: true },
						{ target: "playlist-order", title: "Arrange your clips", description: "Drag clips into your preferred order, or keep the current order. Changes are saved in the next step.", next: true },
						{ target: "playlist-save", title: "Save the clips and order", next: true, finish: true, skipOnFinish: true, nextLabel: "Keep current playlist", description: "Click Save Playlist to keep the selected clips in this order, Use Keep current playlist in the guide if you made no changes." },
					]
				: [
						{ target: "playlists-tab", title: "Create a playlist first", description: "Open Playlists, create or open a playlist, then resume the guide.", next: true },
						{ target: "create-playlist", title: "Create a playlist", description: "Click Add Playlist to start." },
					];
		case "playlist.use":
			return [
				{ target: "overlay-source", title: "Use a curated playlist", description: "Set Overlay Type to Playlist. Then select your saved playlist below.", next: true },
				{ target: "overlay-playlist", title: "Select your playlist", description: "Choose the playlist you just created.", next: true },
				{ target: "overlay-save", title: "Save the association", description: "Save the overlay to use this playlist. The task completes when your selected playlist is saved." },
			];
	}
}
