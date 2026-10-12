import type { TwitchClip } from "@/app/lib/types";

export type RecentCrawlState = {
	recentScanEnd?: string;
	recentRequestMarker?: string;
	recentWindowEnd?: string;
	recentWindowSizeMs?: number;
	recentCursor?: string;
	recentWindowPages?: number;
	lastIncrementalSyncAt?: string;
};
type Page = { clips: TwitchClip[]; cursor?: string };
const WEEK = 7 * 24 * 60 * 60 * 1000;
/** A stable date range and cursor survive bounded jobs; dense windows shrink instead of skipping clips. */
export async function crawlRecentClips(state: RecentCrawlState, options: { now: number; budget: number; force: boolean; fetch: (start: string, end: string, cursor?: string) => Promise<Page>; store: (clips: TwitchClip[]) => Promise<void> }) {
	if (options.force || !state.recentScanEnd) {
		state.recentScanEnd = new Date(options.now).toISOString();
		state.recentWindowEnd = state.recentScanEnd;
		state.recentCursor = undefined;
		state.recentWindowPages = 0;
		state.recentWindowSizeMs = WEEK;
	}
	const scanEnd = Date.parse(state.recentScanEnd);
	const lowerBound = scanEnd - WEEK;
	let used = 0;
	while (used < options.budget) {
		const end = Date.parse(state.recentWindowEnd ?? state.recentScanEnd);
		if (end <= lowerBound) {
			state.lastIncrementalSyncAt = state.recentScanEnd;
			state.recentScanEnd = undefined;
			state.recentWindowEnd = undefined;
			state.recentCursor = undefined;
			state.recentWindowPages = 0;
			return { pending: false, requestsUsed: used };
		}
		const size = Math.min(WEEK, Math.max(1000, state.recentWindowSizeMs ?? WEEK));
		const start = Math.max(lowerBound, end - size);
		const page = await options.fetch(new Date(start).toISOString(), new Date(end).toISOString(), state.recentCursor);
		used += 1;
		await options.store(page.clips);
		const pages = (state.recentWindowPages ?? 0) + 1;
		if (pages >= 10 && page.clips.length === 100) {
			if (size <= 1000) throw new Error("Clip density exceeds the smallest crawl window");
			state.recentWindowSizeMs = Math.max(1000, Math.floor(size / 2));
			state.recentCursor = undefined;
			state.recentWindowPages = 0;
			continue;
		}
		if (page.cursor) {
			state.recentCursor = page.cursor;
			state.recentWindowPages = pages;
		} else {
			state.recentWindowEnd = new Date(start).toISOString();
			state.recentCursor = undefined;
			state.recentWindowPages = 0;
			if (page.clips.length < 100) state.recentWindowSizeMs = Math.min(WEEK, size * 2);
		}
	}
	// Completion after the final page does not require another provider request.
	if (Date.parse(state.recentWindowEnd ?? state.recentScanEnd) <= lowerBound) {
		state.lastIncrementalSyncAt = state.recentScanEnd;
		state.recentScanEnd = undefined;
		state.recentWindowEnd = undefined;
		state.recentCursor = undefined;
		state.recentWindowPages = 0;
		return { pending: false, requestsUsed: used };
	}
	return { pending: true, requestsUsed: used };
}
