export const tourModalSelector = '[data-slot="modal-dialog"], dialog[open], [role="dialog"][aria-modal="true"]:not(.driver-popover):not([data-slot$="-popover"])';
export const tourPopoverSelector = '[data-slot="select-popover"], [data-slot="color-picker-popover"], [data-slot="popover-dialog"], [data-slot="dropdown-popover"]';

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
	{
		id: "appearance",
		title: "Make your overlay yours",
		optional: true,
		tasks: [{ id: "appearance.style", title: "Customize your look" }],
	},
	{
		id: "playlist",
		title: "Build a playlist",
		optional: true,
		tasks: [
			{ id: "playlist.name", title: "Create and name a playlist" },
			{ id: "playlist.clips", title: "Add and arrange clips" },
			{ id: "playlist.use", title: "Use your playlist in an overlay" },
		],
	},
	{
		id: "explore",
		title: "Explore Clipify",
		optional: true,
		tasks: [
			{ id: "explore.galleries", title: "Discover clip galleries" },
			{ id: "explore.runners", title: "Discover runners" },
			{ id: "explore.settings", title: "Find your settings" },
			{ id: "explore.ai", title: "Discover AI connections" },
			{ id: "explore.editors", title: "Find your editors and team" },
			{ id: "explore.tools", title: "Add Clipify to your website" },
			{ id: "explore.support", title: "Find help and report a problem" },
		],
	},
] as const;
export type JourneyId = (typeof journeys)[number]["id"];
export type TaskId = (typeof journeys)[number]["tasks"][number]["id"];
const taskIds = new Set<string>(journeys.flatMap((journey) => journey.tasks.map((task) => task.id)));
export const isTaskId = (value: unknown): value is TaskId => typeof value === "string" && taskIds.has(value);
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export type GuideLocation = "dashboard" | "overlay" | "theme" | "playlist" | "tools" | "settings" | "team" | "other";
export type NavigationTarget = "home" | "overlays" | "overlay" | "playlists" | "playlist" | "profile" | "tools" | "theme" | "settings" | "clip-picker" | "close-picker" | "account-settings" | "core-settings" | "settings-panel" | "team";
export type GuideProgress = {
	version: 2;
	playlistClipsVersion?: 2;
	playlistSource?: boolean;
	welcomeSeen?: boolean;
	expertAwardedAt?: string;
	expertAwardVersion?: 2;
	journeyId?: JourneyId;
	completed: TaskId[];
	skipped: TaskId[];
	overlayId: string | null;
	playlistId: string | null;
	copiedOverlayId: string | null;
	active: { task: TaskId; index: number; paused: boolean; navigation?: NavigationTarget[]; navigationTotal?: number; done?: boolean } | null;
	minimized: boolean;
};
export const defaultProgress = (): GuideProgress => ({ version: 2, playlistClipsVersion: 2, playlistSource: false, journeyId: "overlay", completed: [], skipped: [], overlayId: null, playlistId: null, copiedOverlayId: null, active: null, minimized: false });
/** Legacy browser cache, read once when importing an account's old guide progress. */
export const storageKey = (accountId: string) => `clipify:user-tour:v1:${accountId}`;
export const guideContentKey = "clipify-user-tour:v2";
const navigationIds = new Set<string>(["home", "overlays", "overlay", "playlists", "playlist", "profile", "tools", "theme", "settings", "clip-picker", "close-picker", "account-settings", "core-settings", "settings-panel", "team"]);
const locations = new Set<string>(["dashboard", "overlay", "theme", "playlist", "tools", "settings", "team", "other"]);
const migrateTask = (id: unknown) => (id === "website.embed" ? "explore.tools" : id);
export function parseProgress(raw: string | null, restorePaused = true): GuideProgress {
	try {
		const data = JSON.parse(raw ?? "null");
		if (!data || Array.isArray(data) || ![1, 2].includes(data.version) || !Array.isArray(data.completed)) return defaultProgress();
		const completed = [...new Set<TaskId>(data.completed.map((id: unknown) => (id === "appearance.filters" ? "overlay.source" : migrateTask(id))).filter(isTaskId))];
		const progress: GuideProgress = { ...defaultProgress(), completed, playlistSource: data.playlistSource === true && validId(data.overlayId), skipped: Array.isArray(data.skipped) ? [...new Set<TaskId>(data.skipped.map(migrateTask).filter(isTaskId))].filter((id) => !completed.includes(id)) : [], overlayId: validId(data.overlayId) ? data.overlayId : null, playlistId: validId(data.playlistId) ? data.playlistId : null, minimized: data.minimized !== false };
		progress.welcomeSeen = data.welcomeSeen === true || Boolean(data.active) || completed.length > 0 || progress.skipped.length > 0;
		if (data.expertAwardVersion === 2 && typeof data.expertAwardedAt === "string" && Number.isFinite(Date.parse(data.expertAwardedAt))) {
			progress.expertAwardedAt = new Date(data.expertAwardedAt).toISOString();
			progress.expertAwardVersion = 2;
		}
		if (validId(data.copiedOverlayId) && data.copiedOverlayId === progress.overlayId) progress.copiedOverlayId = data.copiedOverlayId;
		// Retired duplicate filter guidance resumes at its canonical core-task checkpoint.
		let active = data.active?.task === "appearance.filters" ? { ...data.active, task: "overlay.source", index: [0, 1].includes(data.active.index) ? data.active.index + 1 : -1 } : data.active;
		if (active?.task === "playlist.clips" && data.playlistClipsVersion !== 2) active = { ...active, index: [0, 1, 2].includes(active.index) ? [0, 4, 5][active.index] : -1 };
		if (data.version === 2 && active && isTaskId(active.task) && Number.isInteger(active.index) && active.index >= 0 && active.index < stepsForTask(active.task, progress).length) {
			const navigation: NavigationTarget[] = Array.isArray(active.navigation) ? active.navigation.filter((id: unknown): id is NavigationTarget => typeof id === "string" && navigationIds.has(id)).slice(0, 5) : [];
			progress.active = { task: active.task, index: active.index, paused: restorePaused || active.paused !== false, navigation, navigationTotal: Math.max(navigation.length, Math.min(5, Number.isInteger(active.navigationTotal) ? active.navigationTotal : navigation.length)) };
		}
		progress.journeyId = journeys.find((journey) => journey.id === (progress.active?.task.split(".")[0] ?? data.journeyId ?? [...progress.completed, ...progress.skipped].at(-1)?.split(".")[0]))?.id ?? "overlay";
		return progress;
	} catch {
		return defaultProgress();
	}
}
export function hasCompletedAllGuides(progress: GuideProgress): boolean {
	return journeys.every((journey) => journey.tasks.every((task) => progress.completed.includes(task.id)));
}
export function shouldOfferGuideWelcome(progress: GuideProgress): boolean {
	return !progress.welcomeSeen && !progress.active && !journeys[0].tasks.every((task) => progress.completed.includes(task.id) || progress.skipped.includes(task.id));
}
export function guideLocation(pathname: string): GuideLocation {
	if (pathname === "/dashboard") return "dashboard";
	if (pathname === "/dashboard/settings") return "settings";
	if (pathname === "/dashboard/settings/team") return "team";
	if (/^\/dashboard\/overlay\/[a-zA-Z0-9_-]+\/theme$/.test(pathname)) return "theme";
	if (/^\/dashboard\/overlay\/[a-zA-Z0-9_-]+$/.test(pathname)) return "overlay";
	if (/^\/dashboard\/playlist\/[a-zA-Z0-9_-]+$/.test(pathname)) return "playlist";
	return pathname === "/dashboard/tools" ? "tools" : "other";
}
export function navigationForTask(task: TaskId, location: GuideLocation, progress: GuideProgress, index = 0): NavigationTarget[] {
	if (task === "explore.support") return [];
	if (["explore.settings", "explore.ai", "explore.editors"].includes(task)) {
		if (task === "explore.editors" && location === "team") return [];
		const settings: NavigationTarget[] = location === "settings" ? (index > 0 ? ["settings-panel"] : []) : location === "team" ? ["core-settings"] : ["profile", "account-settings"];
		return task === "explore.editors" ? [...settings, "team"] : settings;
	}
	if (task === "explore.tools") return location === "tools" ? [] : ["profile", "tools"];
	const home: NavigationTarget[] = location === "dashboard" ? [] : ["home"];
	if (task === "explore.galleries" || task === "explore.runners") return home;
	if (task === "playlist.name") return [...home, "playlists"];
	if (task === "playlist.clips") return location === "playlist" && progress.playlistId ? [] : [...home, "playlists", ...(progress.playlistId ? ["playlist" as const] : [])];
	if (task === "playlist.use" && !progress.playlistId) return [...home, "playlists"];
	if (task === "overlay.name") return [...home, "overlays"];
	if (task === "appearance.style" && location === "theme" && progress.overlayId) return index === 0 ? ["settings"] : [];
	if (task === "appearance.style" && index > 0 && progress.overlayId) return [...navigationForTask("overlay.source", location, progress), "theme"];
	if (location === "overlay" && progress.overlayId) return [];
	return [...home, "overlays", ...(progress.overlayId ? ["overlay" as const] : [])];
}
export type GuideStep = { target: string; title: string; description: string; next?: boolean; nextDisabled?: boolean; action?: boolean; finish?: boolean; nextLabel?: string; allowDialog?: boolean; inDialog?: boolean; dialogClosed?: boolean; destination?: GuideLocation; preserveFocus?: boolean; reveals?: string; pauseOnInteract?: boolean };
const navigationSteps: Record<NavigationTarget, GuideStep> = {
	"settings-panel": { target: "settings-core-tab", title: "Choose Settings", description: "Choose Settings to return to this guide.", action: true, next: true, reveals: "settings-overview" },
	"account-settings": { target: "nav-settings", title: "Open Settings", description: "Choose My Settings.", destination: "settings", preserveFocus: true },
	"core-settings": { target: "settings-core-tab", title: "Open Settings", description: "Choose Settings to return to your account preferences.", destination: "settings" },
	team: { target: "settings-team-tab", title: "Open Team", description: "Choose Team to find editors and account members.", destination: "team" },
	"close-picker": { target: "playlist-clip-cancel", title: "Return to Add Clips", description: "Click Cancel to return to the playlist and its Add Clips button.", action: true, next: true, inDialog: true, dialogClosed: true },
	"clip-picker": { target: "playlist-add", title: "Open the clip picker", description: "Click Add Clips to return to your clip selection.", action: true, next: true, reveals: "playlist-clip-search", allowDialog: true },
	settings: { target: "theme-back", title: "Return to overlay settings", description: "Use the back button to return to your overlay settings.", destination: "overlay" },
	theme: { target: "overlay-customize", title: "Open Theme Studio", description: "Click Customize Overlay Style to return to your look.", destination: "theme" },
	home: { target: "dashboard-home", title: "Open your Dashboard", description: "Click the Clipify logo to find your overlays and playlists.", destination: "dashboard" },
	overlays: { target: "overlays-tab", title: "Open Overlays", description: "Choose the Overlays tab.", action: true, next: true },
	overlay: { target: "open-overlay", title: "Open your overlay", description: "Click your overlay's row to open its settings.", destination: "overlay" },
	playlists: { target: "playlists-tab", title: "Open Playlists", description: "Choose the Playlists tab.", action: true, next: true },
	playlist: { target: "open-playlist", title: "Open your playlist", description: "Click your playlist's row to edit its clips.", destination: "playlist" },
	profile: { target: "nav-menu", reveals: "nav-tools", title: "Open the app menu", description: "Click your avatar.", action: true, next: true },
	tools: { target: "nav-tools", title: "Open Tools", description: "Choose Tools for website players and galleries.", destination: "tools", preserveFocus: true },
};
export function currentGuideStep(progress: GuideProgress): GuideStep | undefined {
	if (!progress.active) return;
	const navigation = progress.active.navigation?.[0];
	return navigation ? navigationSteps[navigation] : stepsForTask(progress.active.task, progress)[progress.active.index];
}
export function activeGuidePercent(progress: GuideProgress) {
	if (!progress.active) return 0;
	const total = (progress.active.navigationTotal ?? 0) + stepsForTask(progress.active.task, progress).length;
	return Math.round((((progress.active.navigationTotal ?? 0) - (progress.active.navigation?.length ?? 0) + progress.active.index) / total) * 100);
}
/** Equal task weights, with partial credit for an active task until it is saved/confirmed. */
export function journeyGuidePercent(progress: GuideProgress) {
	const journey = journeys.find((item) => item.id === (progress.active?.task.split(".")[0] ?? progress.journeyId)) ?? journeys[0];
	const finished = new Set([...progress.completed, ...progress.skipped]);
	const completed = journey.tasks.filter((task) => finished.has(task.id)).length;
	const partial = progress.active && !finished.has(progress.active.task) ? Math.min(0.95, 0.5 + activeGuidePercent(progress) / 200) : 0;
	return Math.round(((completed + partial) / journey.tasks.length) * 100);
}

type Owned = { ownerId: string; id: string; select?: boolean };
export type GuideEvent =
	| ({ type: "overlay.ready" | "overlay.created" | "overlay.copied" | "website.copied" } & Owned)
	| ({ type: "overlay.saved"; named: boolean; source: boolean; playlistId?: string | null } & Owned)
	| ({ type: "overlay.previewed"; count: number } & Owned)
	| ({ type: "overlay.type-selected"; playlist: boolean } & Owned)
	| ({ type: "overlay.playlist-selected"; playlistId: string } & Owned)
	| ({ type: "theme.saved"; changed: boolean } & Owned)
	| ({ type: "playlist.ready" | "playlist.created" } & Owned)
	| ({ type: "playlist.saved"; named: boolean; count: number } & Owned)
	| ({ type: "playlist.clips-added"; count: number } & Owned)
	| { type: "welcome.start"; location?: GuideLocation }
	| { type: "welcome.dismiss" }
	| { type: "start"; task: TaskId; location?: GuideLocation; pickerOpen?: boolean }
	| { type: "task.skip" | "task.restore"; task: TaskId }
	| { type: "resume" | "previous"; location?: GuideLocation; pickerOpen?: boolean }
	| { type: "location"; location: GuideLocation }
	| { type: "pause" | "next" | "setup.confirmed" }
	| { type: "panel"; minimized: boolean }
	| { type: "resource.reset"; resource: "overlay" | "playlist" }
	| { type: "legacy.import"; completed: TaskId[]; skipped: TaskId[] };
export function isGuideEvent(value: unknown): value is GuideEvent {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const event = value as Record<string, unknown>;
	if ("ownerId" in event && (!validId(event.ownerId) || !validId(event.id))) return false;
	if ("pickerOpen" in event && typeof event.pickerOpen !== "boolean") return false;
	if ("location" in event && (typeof event.location !== "string" || !locations.has(event.location))) return false;
	switch (event.type) {
		case "overlay.ready":
		case "overlay.created":
		case "overlay.copied":
		case "website.copied":
		case "playlist.ready":
		case "playlist.created":
			return "ownerId" in event && (event.select === undefined || typeof event.select === "boolean");
		case "overlay.saved":
			return "ownerId" in event && typeof event.named === "boolean" && typeof event.source === "boolean" && (event.playlistId == null || validId(event.playlistId));
		case "playlist.saved":
			return "ownerId" in event && typeof event.named === "boolean" && Number.isInteger(event.count) && Number(event.count) >= 0 && Number(event.count) <= 1000000;
		case "playlist.clips-added":
		case "overlay.previewed":
			return "ownerId" in event && Number.isInteger(event.count) && Number(event.count) >= 0 && Number(event.count) <= 1000000;
		case "overlay.playlist-selected":
			return "ownerId" in event && validId(event.playlistId);
		case "overlay.type-selected":
			return "ownerId" in event && typeof event.playlist === "boolean";
		case "theme.saved":
			return "ownerId" in event && typeof event.changed === "boolean";
		case "start":
		case "task.skip":
		case "task.restore":
			return isTaskId(event.task);
		case "pause":
		case "previous":
		case "next":
		case "setup.confirmed":
		case "resume":
			return true;
		case "welcome.start":
		case "welcome.dismiss":
			return true;
		case "location":
			return typeof event.location === "string" && locations.has(event.location);
		case "panel":
			return typeof event.minimized === "boolean";
		case "resource.reset":
			return event.resource === "overlay" || event.resource === "playlist";
		case "legacy.import":
			return [event.completed, event.skipped].every((ids) => Array.isArray(ids) && ids.length <= 20 && ids.every(isTaskId));
		default:
			return false;
	}
}
export function transition(progress: GuideProgress, event: GuideEvent, accountId: string): GuideProgress {
	if (!isGuideEvent(event) || ("ownerId" in event && event.ownerId !== accountId)) return progress;
	const next: GuideProgress = { ...progress, completed: [...progress.completed], skipped: [...progress.skipped] };
	const begin = (task: TaskId, location: GuideLocation, index = 0, startInPlace = true, pickerOpen = false) => {
		if (task === "playlist.use" && location === "overlay" && next.playlistId && !next.playlistSource) index = 0;
		if (startInPlace && task === "playlist.use" && index === 0 && location === "overlay" && next.playlistId && next.playlistSource) index = 1;
		if (startInPlace && task === "appearance.style" && location === "theme" && next.overlayId) index = Math.max(1, index);
		if (startInPlace && task === "playlist.clips" && index === 0 && pickerOpen && next.playlistId) index = 1;
		next.journeyId = journeys.find((journey) => journey.tasks.some((item) => item.id === task))!.id;
		const navigationTask = index > 0 && task === "overlay.name" ? "overlay.source" : index > 0 && task === "playlist.name" ? "playlist.clips" : task;
		const navigation = navigationForTask(navigationTask, location, next, index);
		if (task === "playlist.clips" && index === 0 && pickerOpen && next.playlistId) navigation.push("close-picker");
		if (task === "playlist.clips" && index > 0 && index < 4 && !pickerOpen && next.playlistId) navigation.push("clip-picker");
		next.active = { task, index, paused: false, navigation, navigationTotal: navigation.length };
		next.minimized = true;
	};
	const finish = (task: TaskId, skipped = false) => {
		if (skipped) {
			if (!next.completed.includes(task) && !next.skipped.includes(task)) next.skipped.push(task);
		} else {
			if (!next.completed.includes(task)) next.completed.push(task);
			next.skipped = next.skipped.filter((id) => id !== task);
		}
		if (next.active?.task !== task) return;
		const sequence = task.startsWith("overlay.") ? journeys[0].tasks : task.startsWith("playlist.") ? journeys[2].tasks : task.startsWith("appearance.") ? journeys[1].tasks : [];
		const following = sequence.slice(sequence.findIndex((item) => item.id === task) + 1).find((item) => !next.completed.includes(item.id) && !next.skipped.includes(item.id));
		if (following && !next.active.paused) begin(following.id, task.startsWith("playlist.") && task !== "playlist.use" ? "playlist" : "overlay");
		else {
			next.active = null;
			next.minimized = journeys[0].tasks.every((item) => next.completed.includes(item.id) || next.skipped.includes(item.id));
		}
	};
	const startedTask = progress.active?.task;
	switch (event.type) {
		case "welcome.dismiss":
			return { ...next, welcomeSeen: true, minimized: true };
		case "welcome.start": {
			next.welcomeSeen = true;
			const task = journeys[0].tasks.find((item) => !next.completed.includes(item.id) && !next.skipped.includes(item.id));
			if (task) begin(task.id, event.location ?? "dashboard");
			return next;
		}
		case "start":
			next.welcomeSeen = true;
			begin(event.task, event.location ?? "dashboard", 0, true, event.pickerOpen);
			return next;
		case "resume":
			if (next.active) begin(next.active.task, event.location ?? "dashboard", next.active.index, true, event.pickerOpen);
			return next;
		case "pause":
			return { ...next, active: next.active ? { ...next.active, paused: true } : null, minimized: false };
		case "panel":
			return { ...next, minimized: event.minimized };
		case "task.skip":
			if (!next.completed.includes(event.task) && !next.skipped.includes(event.task)) next.skipped.push(event.task);
			return { ...next, active: next.active?.task === event.task ? null : next.active, minimized: false };
		case "task.restore":
			return { ...next, active: next.active?.task === event.task && next.active.done ? null : next.active, completed: next.completed.filter((id) => id !== event.task), skipped: next.skipped.filter((id) => id !== event.task) };
		case "legacy.import":
			next.completed = [...new Set([...next.completed, ...event.completed])];
			next.skipped = [...new Set([...next.skipped, ...event.skipped])].filter((id) => !next.completed.includes(id));
			return next;
		case "previous":
			if (!next.active || next.active.paused || next.active.index < 1) return progress;
			begin(next.active.task, event.location ?? guideLocation(routeForTask(next.active.task, next)), next.active.index - 1, false, event.pickerOpen);
			return next;
		case "next": {
			if (!next.active || next.active.paused) return progress;
			const step = currentGuideStep(next);
			if (!step?.next || step.nextDisabled) return progress;
			if (next.active.navigation?.length) return { ...next, active: { ...next.active, navigation: next.active.navigation.slice(1) } };
			if (step.finish) {
				finish(next.active.task);
				return next;
			}
			return { ...next, active: { ...next.active, index: next.active.index + 1 } };
		}
		case "location": {
			if (!next.active) return { ...next, minimized: true };
			if (next.active.paused) return progress;
			const step = currentGuideStep(next);
			if (step?.destination === event.location) {
				next.active = next.active.navigation?.length ? { ...next.active, navigation: next.active.navigation.slice(1) } : { ...next.active, index: next.active.index + 1 };
				if (next.active.task === "playlist.use" && !next.active.navigation?.length && event.location === "overlay" && next.playlistId) next.active = { ...next.active, index: next.playlistSource ? Math.max(1, next.active.index) : 0 };
				return next;
			}
			if (next.active.task !== "explore.support" && event.location !== guideLocation(routeForTask(next.active.task, next))) {
				return { ...next, active: { ...next.active, paused: true }, minimized: false };
			}
			return next;
		}
		case "resource.reset":
			if (event.resource === "overlay") {
				next.overlayId = null;
				next.playlistSource = false;
				next.copiedOverlayId = null;
			} else next.playlistId = null;
			return { ...next, active: next.active ? { ...next.active, index: 0, paused: true } : null };
		case "overlay.ready":
			if (event.select || !next.overlayId) {
				if (event.id !== next.overlayId) {
					next.copiedOverlayId = null;
					next.playlistSource = false;
				}
				next.overlayId = event.id;
			}
			break;
		case "overlay.created":
			next.overlayId = event.id;
			next.playlistSource = false;
			next.copiedOverlayId = null;
			if (next.active) next.active = { ...next.active, index: next.active.task === "overlay.name" ? 1 : 0, navigation: [] };
			break;
		case "overlay.type-selected":
			if (event.id !== next.overlayId) return progress;
			next.playlistSource = event.playlist;
			if (next.active?.task === "playlist.use" && !next.active.navigation?.length && next.playlistId) {
				if (!event.playlist) next.active = { ...next.active, index: 0 };
				else if (next.active.index === 0) next.active = { ...next.active, index: 1 };
			}
			break;
		case "overlay.playlist-selected":
			if (event.id !== next.overlayId) return progress;
			if (next.active?.task === "playlist.use" && !next.active.navigation?.length) {
				next.playlistId = event.playlistId;
				if (next.active.index === 1) next.active = { ...next.active, index: 2 };
			}
			break;
		case "overlay.saved": {
			const playlistMatches = startedTask === "playlist.use" ? event.id === progress.overlayId : event.playlistId === next.playlistId;
			next.overlayId = event.id;
			if (event.playlistId !== undefined) next.playlistSource = Boolean(event.playlistId);
			if (event.named) finish("overlay.name");
			if (event.source && (!startedTask || startedTask === "overlay.source")) finish("overlay.source");
			if (event.playlistId && playlistMatches) {
				next.playlistId = event.playlistId;
				finish("playlist.use");
			}
			break;
		}
		case "overlay.previewed":
			if (event.id === next.overlayId && event.count > 0) finish("overlay.preview");
			break;
		case "overlay.copied":
			if (event.id !== next.overlayId) return progress;
			next.copiedOverlayId = event.id;
			if (next.active?.task === "overlay.setup") next.active = { ...next.active, index: 1 };
			break;
		case "setup.confirmed":
			if (next.overlayId && next.copiedOverlayId === next.overlayId) finish("overlay.setup");
			break;
		case "theme.saved":
			if (event.changed && event.id === next.overlayId) finish("appearance.style");
			break;
		case "playlist.ready":
			if (event.select || !next.playlistId) next.playlistId = event.id;
			break;
		case "playlist.created":
			next.playlistId = event.id;
			if (next.active) next.active = { ...next.active, index: next.active.task === "playlist.name" ? 1 : 0, navigation: [] };
			break;
		case "playlist.clips-added":
			if (event.id === next.playlistId && event.count > 0 && next.active?.task === "playlist.clips" && next.active.index < 4) next.active = { ...next.active, index: 4, navigation: [] };
			break;
		case "playlist.saved":
			next.playlistId = event.id;
			if (event.named) finish("playlist.name");
			if (event.count > 0 && (!startedTask || startedTask === "playlist.clips")) finish("playlist.clips");
			break;
		case "website.copied":
			if (next.active?.task === "explore.tools" && next.active.index === 1) next.active = { ...next.active, index: 2 };
			break;
	}
	return next;
}
/** Expected page only, never a command to navigate. */
export function routeForTask(task: TaskId, progress: GuideProgress): string {
	if (task === "playlist.use" && !progress.playlistId) return "/dashboard";
	const nav = progress.active?.task === task ? progress.active.navigation?.[0] : undefined;
	if (nav === "home" || nav === "overlays" || nav === "overlay" || nav === "playlists" || nav === "playlist") return "/dashboard";
	if (task === "explore.tools") return "/dashboard/tools";
	if (task === "explore.settings" || task === "explore.ai") return "/dashboard/settings";
	if (task === "explore.editors") return "/dashboard/settings/team";
	if (task.startsWith("explore.")) return "/dashboard";
	if (task === "playlist.name" || task === "playlist.clips") return progress.playlistId ? `/dashboard/playlist/${progress.playlistId}` : "/dashboard";
	if (!progress.overlayId || (task === "overlay.name" && !progress.active?.index)) return "/dashboard";
	return `/dashboard/overlay/${progress.overlayId}${task === "appearance.style" && (progress.active?.index ?? 0) > 0 ? "/theme" : ""}`;
}
const createOverlay: GuideStep = { target: "create-overlay", title: "Create an overlay", description: "Click Add Overlay to create one. This opens its settings." };
export function stepsForTask(task: TaskId, progress: GuideProgress): GuideStep[] {
	if (task === "playlist.use" && !progress.playlistId) return stepsForTask("playlist.name", progress);
	if ((task.startsWith("overlay.") || task.startsWith("appearance.") || task === "playlist.use") && task !== "overlay.name" && !progress.overlayId) return [createOverlay];
	switch (task) {
		case "overlay.name":
			return [createOverlay, { target: "overlay-name", title: "Give it a name", description: "Choose a name you'll recognize.", next: true }, { target: "overlay-save", title: "Save your overlay", description: "Click Save to keep the name, or continue with the current settings.", next: true, finish: true, nextLabel: "Use current settings" }];
		case "overlay.source":
			return [
				{ target: "overlay-source", title: "Choose your clips", description: "Choose the clip source or time range you want to play.", next: true },
				{ target: "overlay-filters", title: "Adjust the filters", description: "Review duration, games and creators. Advanced filters require Pro. You can keep the defaults.", next: true },
				{ target: "overlay-save", title: "Save your clip settings", description: "Save your changes, or continue with the current settings.", next: true, finish: true, nextLabel: "Use current settings" },
			];
		case "overlay.preview":
			return [{ target: "overlay-preview", title: "Preview your overlay", description: "Open Preview Clips to check what will play. If it's empty, broaden the time range or filters.", allowDialog: true }];
		case "overlay.setup":
			return [
				{ target: "overlay-copy", title: "Copy the overlay URL", description: "Click Copy for your private OBS or Streamlabs browser source URL.", allowDialog: true },
				{ target: "overlay-copy", title: "Add a Browser Source", description: "In OBS or Streamlabs, add a Browser Source, paste the URL and set 1920 by 1080. Check that the source is visible and playing clips.", next: true, finish: true, nextLabel: "Finish guide", allowDialog: true },
			];
		case "appearance.style":
			return [
				{ target: "overlay-customize", title: "Open Theme Studio", description: "Click Customize Overlay Style.", destination: "theme" },
				{ target: "theme-controls", title: "Make it yours", description: "Make this look like your stream. Change text and background colors, the progress gradient and fonts. Enable components, adjust visual effects and use the live preview to check your changes. You can keep the defaults.", next: true },
				{ target: "theme-save", title: "Save your look", description: "Click Save Style, or keep the default look.", next: true, finish: true, nextLabel: "Keep default look" },
			];
		case "playlist.name":
			return [
				{ target: "create-playlist", title: "Create a playlist", description: "Click Add Playlist to create a collection." },
				{ target: "playlist-name", title: "Name your playlist", description: "Give your collection a useful name.", next: true },
				{ target: "playlist-save", title: "Save your playlist", description: "Click Save Playlist after naming it.", next: true, finish: true, nextLabel: "Keep current name" },
			];
		case "playlist.clips":
			return progress.playlistId
				? [
						{ target: "playlist-add", title: "Choose your clips", description: "Click Add Clips to open your cached clips.", action: true, next: true, reveals: "playlist-clip-search", allowDialog: true },
						{ target: "playlist-clip-search", title: "Find your clips", description: "Search by title or creator, or continue to browse all clips.", next: true, inDialog: true },
						{ target: "playlist-clip-selection", title: "Select clips", description: "Select the clips you want. You can use Select all and move between pages; your selection stays available.", next: true, inDialog: true },
						{ target: "playlist-clip-confirm", title: "Add selected clips", description: "Click Add selected clips to add your selection. Use Back if you want to change it.", inDialog: true },
						{ target: "playlist-order", title: "Arrange your clips", description: "Drag the clips into the order you want.", next: true, allowDialog: true },
						{ target: "playlist-save", title: "Save your playlist", description: "Click Save Playlist to keep the clips and order.", next: true, finish: true, nextLabel: "Keep current playlist" },
					]
				: stepsForTask("playlist.name", progress);
		case "playlist.use":
			return [
				{ target: "overlay-source", title: "Use a playlist", description: "Select Playlist as the overlay type.", next: true, nextDisabled: !progress.playlistSource },
				{ target: "overlay-playlist", title: "Select your playlist", description: "Choose your saved playlist.", next: true },
				{ target: "overlay-save", title: "Save the overlay", description: "Click Save to use this playlist, or continue with the current settings.", next: true, finish: true, nextLabel: "Use current settings" },
			];
		case "explore.galleries":
			return [
				{ target: "galleries-tab", title: "Open Galleries", description: "Choose Galleries to see your clip collections.", next: true, action: true },
				{ target: "gallery-list", title: "Discover galleries", description: "Open a gallery or use Add Gallery to build a browsable clip collection for your website.", next: true, finish: true, nextLabel: "Done" },
			];
		case "explore.runners":
			return [
				{ target: "runners-tab", title: "Open Runners", description: "Choose Runners to find your streaming devices.", action: true, next: true },
				{ target: "runner-list", title: "Discover runners", description: "Manage the computers that broadcast your Clipify streams here. Open a runner to see its setup and broadcast controls. You can finish this guide without setting one up.", next: true, finish: true, nextLabel: "Done" },
			];
		case "explore.settings":
			return [
				{ target: "settings-core-tab", title: "Choose Settings", description: "Open the Settings tab for your account preferences.", action: true, next: true, reveals: "settings-overview" },
				{ target: "settings-overview", title: "Your account settings", description: "Find your profile, plan and preferences here. The tabs above also lead to your creator page, billing and team.", next: true },
				{ target: "account-security", title: "Sign-in and security", description: "Manage your sign-in email and passkeys here. You can review these options without changing anything.", next: true, finish: true, nextLabel: "Done" },
			];
		case "explore.ai":
			return [
				{ target: "settings-core-tab", title: "Choose Settings", description: "Open Settings to find your connected AI apps.", action: true, next: true, reveals: "connected-ai-apps" },
				{ target: "connected-ai-apps", title: "Connected AI apps", description: "Review the AI apps you have authorized, their permissions and recent activity. Connecting an app is optional.", next: true },
				{ target: "ai-connection-help", title: "Connect an AI app", description: "Open this setup guide when you are ready to connect an AI app. You choose which permissions to approve; this tour does not connect one for you.", next: true, finish: true, nextLabel: "Done" },
			];
		case "explore.editors":
			return [{ target: "team-overview", title: "Your editors and team", description: "Editors are managed as team members. Account owners can invite people and choose what they can manage. You can explore this page without sending an invitation.", next: true, finish: true, nextLabel: "Done" }];
		case "explore.tools":
			return [
				{ target: "tools-player", title: "Choose a player", description: "Choose the overlay you want on your website. Create an overlay first if the list is empty.", next: true },
				{ target: "website-copy", title: "Copy the embed code", description: "Copy this public iframe code for your website. Keep your private OBS URL separate." },
				{ target: "website-code", title: "Install on your website", description: "Paste the code into a Custom HTML or Embed block, publish the page and check playback. Autoplay may require muted playback.", next: true, finish: true, nextLabel: "Finish guide" },
			];
		case "explore.support":
			return [
				{ target: "support-report", pauseOnInteract: true, title: "Report a problem", description: "Use this button to send a bug report.", next: true },
				{ target: "support-chat", pauseOnInteract: true, title: "Get help", description: "Use chat for questions. You can also visit the <a href='https://help.clipify.us/' target='_blank' rel='noopener noreferrer'>help center</a>.", next: true, finish: true, nextLabel: "Done" },
			];
	}
}
