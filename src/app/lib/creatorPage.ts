import type { TwitchClip } from "@types";

export type CreatorClipSort = "most_viewed" | "newest";
export type CreatorClipQuery = { sort?: CreatorClipSort; start?: Date | null; end?: Date | null; cursor?: string | null; pageSize?: number };

export function resolveCreatorPageMetadata(username: string, socialTitle?: string | null, socialDescription?: string | null) {
	const fallbackDescription = `Watch the newest and most-viewed Twitch clips from ${username}.`;
	return {
		title: socialTitle?.trim() || `${username}'s Twitch clips | Clipify`,
		description: socialDescription?.trim() || fallbackDescription,
		openGraphTitle: socialTitle?.trim() || `${username}'s Twitch clips`,
		openGraphDescription: socialDescription?.trim() || `Watch clips from ${username} on Clipify.`,
	};
}

export function resolveCreatorPageVisibility(settings: { creatorPageVisibility?: string | null; showOnCommunityPage?: boolean | null }) {
	if (settings.creatorPageVisibility === "discoverable" || settings.creatorPageVisibility === "unlisted") return settings.creatorPageVisibility;
	return settings.showOnCommunityPage ? "discoverable" : "unlisted";
}

export function queryCreatorClips(clips: TwitchClip[], query: CreatorClipQuery) {
	const startMs = query.start?.getTime();
	const endMs = query.end?.getTime();
	const filtered = clips.filter((clip) => {
		const created = Date.parse(clip.created_at);
		if (!Number.isFinite(created)) return false;
		if (startMs !== undefined && created < startMs) return false;
		if (endMs !== undefined && created > endMs + 86_399_999) return false;
		return true;
	});
	filtered.sort((left, right) => (query.sort === "newest" ? right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id) : right.view_count - left.view_count || right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id)));
	const offset = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
	const pageSize = Math.min(48, Math.max(1, Math.floor(query.pageSize ?? 24)));
	const items = filtered.slice(offset, offset + pageSize);
	return { items, nextCursor: offset + items.length < filtered.length ? String(offset + items.length) : null, total: filtered.length };
}
