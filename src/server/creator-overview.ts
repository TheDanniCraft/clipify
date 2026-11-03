import "server-only";
import { filterDiscoveredClips, publicClip } from "./resources/clip-discovery";
import { fromDate, toCalendarDate } from "@internationalized/date";
export function localCreationWindow(timeZone: string, now: Date) {
	const today = toCalendarDate(fromDate(now, timeZone));
	return { startedAt: today.subtract({ days: 29 }).toDate(timeZone).toISOString(), endedAt: today.add({ days: 1 }).toDate(timeZone).toISOString() };
}

export function summarizeCreatorClips(clips: import("zod").z.infer<typeof import("./resources/clip-validation").providerClipSchema>[], timeZone: string, now: Date) {
	const window = localCreationWindow(timeZone, now);
	const matches = filterDiscoveredClips(clips, { ...window, sort: "most_viewed" });
	return { ...window, count: matches.length, views: matches.reduce((sum, clip) => sum + (clip.view_count ?? 0), 0), topClips: matches.slice(0, 5).map(publicClip) };
}

export async function readCreatorOverview(creatorId: string, timeZone: string) {
	const { readCreatorLibrary } = await import("./creator-library");
	const library = await readCreatorLibrary(creatorId, { timeZone });
	if (!library.ok) return library;
	return { ok: true as const, ...summarizeCreatorClips(library.clips, timeZone, new Date()), complete: library.complete, fetchedAt: library.fetchedAt, timeZone };
}
