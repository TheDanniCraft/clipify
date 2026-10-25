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
] as const;
export type TaskId = (typeof journeys)[number]["tasks"][number]["id"];
const tasks = new Set<string>(journeys.flatMap((journey) => journey.tasks.map((task) => task.id)));
export const isTaskId = (value: unknown): value is TaskId => typeof value === "string" && tasks.has(value);
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export type GuideProgress = {
	version: 1;
	completed: TaskId[];
	overlayId: string | null;
	playlistId: string | null;
	copiedOverlayId: string | null;
	active: { task: TaskId; index: number; paused: boolean } | null;
	minimized: boolean;
};
export const defaultProgress = (): GuideProgress => ({ version: 1, completed: [], overlayId: null, playlistId: null, copiedOverlayId: null, active: null, minimized: true });
export const storageKey = (accountId: string) => `clipify:user-tour:v1:${accountId}`;
export function parseProgress(raw: string | null): GuideProgress {
	try {
		const data = JSON.parse(raw ?? "null");
		if (!data || Array.isArray(data) || data.version !== 1 || !Array.isArray(data.completed)) return defaultProgress();
		const progress: GuideProgress = { ...defaultProgress(), completed: [...new Set<TaskId>(data.completed.filter(isTaskId))], overlayId: validId(data.overlayId) ? data.overlayId : null, playlistId: validId(data.playlistId) ? data.playlistId : null, minimized: data.minimized !== false };
		if (validId(data.copiedOverlayId) && data.copiedOverlayId === progress.overlayId) progress.copiedOverlayId = data.copiedOverlayId;
		if (data.active && isTaskId(data.active.task) && Number.isInteger(data.active.index) && data.active.index >= 0 && data.active.index < stepsForTask(data.active.task, progress).length) progress.active = { task: data.active.task, index: data.active.index, paused: true };
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
	| { type: "start"; task: TaskId }
	| { type: "pause" | "resume" | "next" | "setup.confirmed" }
	| { type: "panel"; minimized: boolean }
	| { type: "resource.reset"; resource: "overlay" | "playlist" };

export function transition(progress: GuideProgress, event: GuideEvent, accountId: string): GuideProgress {
	if ("ownerId" in event && (event.ownerId !== accountId || !validId(event.id))) return progress;
	let next: GuideProgress = { ...progress, completed: [...progress.completed] };
	const complete = (task: TaskId) => {
		if (!next.completed.includes(task)) next.completed.push(task);
		if (next.active?.task === task) next = { ...next, active: null, minimized: false };
	};
	switch (event.type) {
		case "start":
			return { ...next, active: { task: event.task, index: 0, paused: false }, minimized: true };
		case "pause":
			return { ...next, active: next.active ? { ...next.active, paused: true } : null, minimized: false };
		case "resume":
			return { ...next, active: next.active ? { ...next.active, paused: false } : null, minimized: true };
		case "next": {
			if (!next.active) return progress;
			const steps = stepsForTask(next.active.task, next);
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
			if (event.select || !next.overlayId) {
				if (next.overlayId !== event.id) next.copiedOverlayId = null;
				next.overlayId = event.id;
			}
			break;
		case "overlay.created":
			next.overlayId = event.id;
			if (next.active) next.active = { ...next.active, index: 0 };
			next.copiedOverlayId = null;
			break;
		case "overlay.saved":
			next.overlayId = event.id;
			if (event.named) complete("overlay.name");
			if (event.source) complete("overlay.source");
			if (event.playlistId && event.playlistId === next.playlistId) complete("playlist.use");
			break;
		case "overlay.previewed":
			if (event.id === next.overlayId && event.count > 0) complete("overlay.preview");
			break;
		case "overlay.copied":
			if (event.id !== next.overlayId) return progress;
			next.copiedOverlayId = event.id;
			break;
		case "setup.confirmed":
			if (next.overlayId && next.copiedOverlayId === next.overlayId) complete("overlay.setup");
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
	if (task === "playlist.use" && !progress.playlistId) return "/dashboard";
	if (task === "playlist.name" || task === "playlist.clips") return progress.playlistId ? `/dashboard/playlist/${progress.playlistId}` : "/dashboard";
	if (!progress.overlayId) return "/dashboard";
	return `/dashboard/overlay/${progress.overlayId}${task === "appearance.style" ? "/theme" : ""}`;
}
export type GuideStep = { target: string; title: string; description: string; next?: boolean };
export function stepsForTask(task: TaskId, progress: GuideProgress): GuideStep[] {
	if (task === "playlist.use" && !progress.playlistId) return stepsForTask("playlist.name", progress);
	const createOverlay: GuideStep = { target: "create-overlay", title: "Create your first overlay", description: "Click Add Overlay. Your overlay will use your channel’s clips. Already have one? Open it from the dashboard, then resume this guide." };
	if (task.startsWith("overlay.") || task === "appearance.style" || task === "playlist.use") {
		if (!progress.overlayId) return [createOverlay];
	}
	switch (task) {
		case "overlay.name":
			return [
				{ target: "overlay-name", title: "Give it a name", description: "Choose a name you’ll recognize, such as BRB clips. Then continue to save it.", next: true },
				{ target: "overlay-save", title: "Save your overlay", description: "Click Save to keep your name and clip settings. The checklist updates after the save succeeds." },
			];
		case "overlay.source":
			return [
				{ target: "overlay-source", title: "Choose which clips play", description: "Choose a time range, such as Top Clips — Last 30 Days. Keep advanced filters for later. If no clips match, try a broader range.", next: true },
				{ target: "overlay-save", title: "Save your clip settings", description: "Save your changes. If you kept the current settings, choose another range and save, or continue exploring." },
			];
		case "overlay.preview":
			return [{ target: "overlay-preview", title: "Check your clips", description: "Open Preview Clips. If no clips match, choose a broader time range or check crawl status in Settings. A nonempty preview completes this task." }];
		case "overlay.setup":
			return [{ target: "overlay-url", title: "Copy your private overlay URL", description: "Use the copy button. In OBS or Streamlabs: Sources → + → Browser, paste the URL, set width 1920 and height 1080. Keep the URL private. Return here to confirm when clips appear." }];
		case "appearance.style":
			return [
				{ target: "theme-controls", title: "Make it yours", description: "Change a visible setting and check the live preview. You can keep the default look and pause this optional guide.", next: true },
				{ target: "theme-save", title: "Save your look", description: "Click Save Style to keep your changes. Keeping the defaults? Use Pause instead." },
			];
		case "playlist.name":
			return progress.playlistId
				? [
						{ target: "playlist-name", title: "Name your playlist", description: "Give this collection a useful name, such as Favorite moments.", next: true },
						{ target: "playlist-save", title: "Save your playlist", description: "Click Save Playlist, or keep the saved playlist if you are replaying this guide." },
					]
				: [
						{ target: "playlists-tab", title: "Open Playlists", description: "Switch to Playlists to create your clip collection.", next: true },
						{ target: "create-playlist", title: "Create a playlist", description: "Click Add Playlist. If you already have one, open it and resume this guide." },
					];
		case "playlist.clips":
			return progress.playlistId
				? [
						{ target: "playlist-add", title: "Choose your clips", description: "Click Add Clips, select clips and add them to your playlist. Close the selector when you’re ready, then continue.", next: true },
						{ target: "playlist-order", title: "Arrange your clips", description: "Drag clips into your preferred order, or keep the current order. Changes are saved in the next step.", next: true },
						{ target: "playlist-save", title: "Save the clips and order", description: "Click Save Playlist to keep the selected clips in this order, or keep the saved playlist if you made no changes." },
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
