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
export function clipGuidance(state: CollectionState, canRefresh: boolean, cachedClipCount: number) {
	const reason = state === "ready" ? (cachedClipCount > 0 ? "no_matching_clips" : "empty_collection") : state;
	const messages = {
		not_started: "Clip synchronization has not started. This does not mean your Twitch channel has no clips.",
		queued: "Clip synchronization is queued. Cached clips can be used while more history is collected.",
		running: "Clip synchronization is running. The current results may not include all Twitch clips yet.",
		partial: "Only part of the clip inventory is available. Cached clips can already be used.",
		retrying: "Clip synchronization encountered a problem and is scheduled to retry.",
		rate_limited: "Twitch has temporarily limited synchronization. Check the returned retry deadline before checking again.",
		empty_collection: "Synchronization completed with no clips in the cached inventory. Ask whether the user means existing Twitch channel clips or highlights from uploaded gameplay recordings; Clipify does not create the latter. Pro does not supply missing Twitch clips.",
		no_matching_clips: "The inventory has clips, but none match this search. Try fewer filters.",
	};
	return {
		reason,
		message: messages[reason],
		nextStep: { tool: state === "ready" && cachedClipCount === 0 ? null : state === "not_started" && canRefresh ? "refresh_clips" : state === "ready" && cachedClipCount > 0 ? "search_clips" : "get_clip_crawler_status", action: state === "ready" && cachedClipCount === 0 ? "clarify_goal" : "check_or_use_inventory", requiresUserRequest: state === "not_started" && canRefresh },
		dashboardPath: "/dashboard",
	};
}
export function emptyResourceGuidance(tool: "list_overlays" | "list_playlists") {
	return { reason: tool === "list_overlays" ? "no_overlays" : "no_playlists", message: "Nothing has been created yet. Check capabilities before offering to create it. If this connection cannot write, use the existing setup guide in the dashboard or ask the user to change the connection's permissions in Settings → Connections. This is separate from their subscription.", nextStep: { tool: "get_capabilities" }, dashboardPath: "/dashboard" };
}
