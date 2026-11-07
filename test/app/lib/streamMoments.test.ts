import { groupStreamMoments } from "@lib/streamMoments";
const clip = (id: string, offset: number | null, duration = 20, views = 1) => ({ id, vodOffsetSeconds: offset, duration, views, createdAt: "2026-11-01T00:00:00Z" });
it("groups substantially overlapping clips and leads with the most viewed without changing input", () => {
	const input = [clip("late", 120), clip("first", 10, 20, 2), clip("popular", 12, 20, 50)];
	const snapshot = JSON.stringify(input);
	const result = groupStreamMoments(input);
	expect(result.map((group) => group.clips.map((item) => item.id))).toEqual([["popular", "first"], ["late"]]);
	expect(result[0].offsetSeconds).toBe(10);
	expect(JSON.stringify(input)).toBe(snapshot);
});
it("keeps adjacent clips, unknown positions and long overlapping chains separate", () => {
	const result = groupStreamMoments([clip("a", 0, 100), clip("b", 50, 100), clip("c", 100, 100), clip("unknown", null)]);
	expect(result.map((group) => group.clips.map((item) => item.id))).toEqual([["a", "b"], ["c"], ["unknown"]]);
	expect(groupStreamMoments([clip("a", 0, 10), clip("b", 10, 10)])).toHaveLength(2);
	expect(groupStreamMoments([clip("a", null), clip("b", null)])).toHaveLength(2);
});
it("uses stable clip IDs to break view ties and does not merge zero-duration clips", () => {
	expect(groupStreamMoments([clip("b", 5), clip("a", 5)])[0].clips.map((c) => c.id)).toEqual(["a", "b"]);
	expect(groupStreamMoments([clip("a", 5, 0), clip("b", 5, 0)])).toHaveLength(2);
	expect(groupStreamMoments([])).toEqual([]);
});
