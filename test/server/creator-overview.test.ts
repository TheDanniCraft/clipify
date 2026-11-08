/** @jest-environment node */
import { localCreationWindow } from "@/server/creator-overview";
it("U29-U32: uses thirty local calendar days across the spring DST change", () => {
	expect(localCreationWindow("Europe/Berlin", new Date("2026-03-30T12:00:00Z"))).toEqual({ startedAt: "2026-02-28T23:00:00.000Z", endedAt: "2026-03-30T22:00:00.000Z" });
});

it("U34-U37: summarizes only window members using lifetime views and stable top-clip ties", async () => {
	const { summarizeCreatorClips } = await import("@/server/creator-overview");
	const make = (id: string, created_at: string, view_count: number) => ({ id, title: id, broadcaster_id: "owner", duration: 10, created_at, view_count });
	const summary = summarizeCreatorClips([make("Before", "2026-02-28T22:59:59Z", 1000), make("Z", "2026-03-01T00:00:00Z", 10), make("A", "2026-03-01T00:00:00Z", 10), make("After", "2026-03-30T22:00:00Z", 1000)], "Europe/Berlin", new Date("2026-03-30T12:00:00Z"));
	expect(summary).toMatchObject({ count: 2, views: 20 });
	expect(summary.topClips.map((clip) => clip.id)).toEqual(["A", "Z"]);
});

const readLibrary = jest.fn();
jest.mock("@/server/creator-library", () => ({ readCreatorLibrary: (...args: unknown[]) => readLibrary(...args) }));
it("retains authorization failures instead of inventing empty metrics", async () => {
	readLibrary.mockResolvedValue({ ok: false, code: "PERMISSION_DENIED" });
	const { readCreatorOverview } = await import("@/server/creator-overview");
	expect(await readCreatorOverview("foreign", "UTC")).toEqual({ ok: false, code: "PERMISSION_DENIED" });
});
it("reports known empty metrics with completeness and freshness", async () => {
	readLibrary.mockResolvedValue({ ok: true, clips: [], complete: false, fetchedAt: null });
	const { readCreatorOverview } = await import("@/server/creator-overview");
	expect(await readCreatorOverview("owner", "UTC")).toMatchObject({ ok: true, count: 0, views: 0, topClips: [], complete: false, fetchedAt: null, timeZone: "UTC" });
	expect(readLibrary).toHaveBeenCalledWith("owner", { timeZone: "UTC" }, true);
});
it("uses thirty local days across the autumn DST change", () => {
	expect(localCreationWindow("Europe/Berlin", new Date("2026-10-26T12:00:00Z"))).toEqual({ startedAt: "2026-09-26T22:00:00.000Z", endedAt: "2026-10-26T23:00:00.000Z" });
});
it("keeps only five top clips and treats absent views as zero", async () => {
	const { summarizeCreatorClips } = await import("@/server/creator-overview");
	const clips = Array.from({ length: 7 }, (_, i) => ({ id: String(i), title: String(i), broadcaster_id: "owner", duration: 10, created_at: "2026-11-01T00:00:00Z", ...(i ? { view_count: i } : {}) }));
	const result = summarizeCreatorClips(clips, "UTC", new Date("2026-11-03T00:00:00Z"));
	expect(result.count).toBe(7);
	expect(result.views).toBe(21);
	expect(result.topClips.map((clip) => clip.id)).toEqual(["6", "5", "4", "3", "2"]);
});
it("keeps an all-time ranking when the creator has no recent clips", async () => {
	const { summarizeCreatorClips } = await import("@/server/creator-overview");
	const old = { id: "old", title: "An old favourite", broadcaster_id: "owner", duration: 10, created_at: "2020-01-01T00:00:00Z", view_count: 123 };
	const result = summarizeCreatorClips([old], "UTC", new Date("2026-11-05T00:00:00Z"));
	expect(result).toMatchObject({ count: 0, views: 0, topClips: [] });
	expect(result.allTimeTopClips.map((clip) => clip.id)).toEqual(["old"]);
});
