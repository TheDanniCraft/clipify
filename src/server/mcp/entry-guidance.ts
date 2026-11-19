/** Describes persisted inventory state; visibility, elapsed time and empty searches do not prove completion. */
type Collection = { isSyncComplete: boolean; cachedClipCount: number; jobs: Array<{ status: string; failures: number; kind?: string; lastCompletedAt?: string | null }>; rateLimitedUntil: string | null; lastIncrementalSyncAt?: string | null };
export function collectionState(collection: Collection) {
	if (collection.isSyncComplete && collection.lastIncrementalSyncAt !== null && !collection.jobs.some((job) => job.kind === "recent" && job.lastCompletedAt === null)) return "ready";
	if (collection.jobs.some((job) => job.status === "running")) return "running";
	if (collection.rateLimitedUntil && Date.parse(collection.rateLimitedUntil) > Date.now()) return "rate_limited";
	if (collection.jobs.some((job) => job.failures > 0)) return "retrying";
	if (collection.jobs.some((job) => job.status === "queued" || job.status === "scheduled")) return "queued";
	return collection.cachedClipCount > 0 ? "partial" : "not_started";
}
export type CollectionState = ReturnType<typeof collectionState>;
const emptyInventoryMessage = "The Twitch clip import finished without finding any clips. If the user wants to use Twitch clips, ask them to check the connected channel or create a clip on Twitch and check back after the next sync. For highlights from uploaded gameplay, explain that Clipify does not create those. Pro does not supply missing clips.";

export function clipGuidance(state: CollectionState, canRefresh: boolean, cachedClipCount: number) {
	const reason = state === "ready" ? (cachedClipCount > 0 ? "no_matching_clips" : "empty_collection") : state;
	const messages = {
		not_started: "Clip synchronization has not started. This does not mean your Twitch channel has no clips.",
		queued: "Clip import is queued. Check progress with get_clip_crawler_status; do not start another import. Use any clips already available, or open the existing dashboard guide to prepare an overlay while waiting.",
		running: "Clip import is still running. Check progress with get_clip_crawler_status; an empty result does not mean the channel has no clips. Use any clips already available, or open the existing dashboard guide to prepare an overlay while waiting.",
		partial: "Only part of the clip inventory is available. Cached clips can already be used.",
		retrying: "Clip synchronization encountered a problem and is scheduled to retry.",
		rate_limited: "Twitch has temporarily limited synchronization. Check the returned retry deadline before checking again.",
		empty_collection: emptyInventoryMessage,
		no_matching_clips: "The inventory has clips, but none match this search. Try fewer filters.",
	};
	return {
		reason,
		message: messages[reason],
		nextStep: { tool: state === "ready" && cachedClipCount === 0 ? null : state === "not_started" && canRefresh ? "refresh_clips" : state === "ready" && cachedClipCount > 0 ? "search_clips" : "get_clip_crawler_status", action: state === "ready" && cachedClipCount === 0 ? "clarify_goal" : "check_or_use_inventory", requiresUserRequest: state === "not_started" && canRefresh },
		dashboardPath: "/dashboard",
	};
}

export function firstOverlayGuidance(collection: Collection | null, createOverlay: { allowed: boolean; reason?: string }) {
	const requiredScope = "overlay:create";
	const fallback = "Open the Clipify dashboard and choose “Get your first overlay running” to set up and preview your overlay.";
	if (!collection) return { tool: "get_clip_crawler_status", reason: "status_unavailable", requiredScope, message: "Check the Twitch clip import before assuming the channel has no clips. " + fallback };
	const state = collectionState(collection);
	if (collection.cachedClipCount === 0) {
		const guidance = clipGuidance(state, false, 0);
		return { tool: guidance.nextStep.tool, reason: guidance.reason, requiredScope, message: guidance.message };
	}
	const inventory = `${collection.cachedClipCount} Twitch clips are available${state === "ready" ? "." : " so far; the full import is not complete yet."}`;
	const message = createOverlay.allowed ? "Offer to create the first overlay if the user wants one, then point them to the existing dashboard setup to preview playback and add it to their stream." : fallback + (createOverlay.reason === "ACCESS_DENIED" ? " This ChatGPT connection cannot create overlays; the dashboard setup does not require changing its permissions." : "");
	return { tool: createOverlay.allowed ? "create_overlay" : null, reason: createOverlay.reason ?? null, requiredScope, message: `${inventory} ${message}` };
}

export function emptyResourceGuidance(tool: "list_overlays" | "list_playlists") {
	const overlay = tool === "list_overlays";
	return { reason: overlay ? "no_overlays" : "no_playlists", message: overlay ? "No overlay yet. Use get_capabilities for this creator to check clip import progress and find the next step for their first overlay." : "No playlists yet. A playlist is optional for the first Featured Clips overlay. Use get_capabilities for the first overlay, or search_clips if the user specifically wants to build a playlist.", nextStep: { tool: "get_capabilities" }, dashboardPath: "/dashboard" };
}
