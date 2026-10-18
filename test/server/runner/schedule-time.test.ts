/** @jest-environment node */
import fc from "fast-check";
import { scheduleOccurrenceKey } from "@/server/runner/schedule-time";

test("TDD-US3-DEC004 U234: occurrence identity depends on event and immutable anchor across arbitrary revisions", () => {
	fc.assert(
		fc.property(fc.uuid(), fc.uuid(), fc.integer({ min: 1, max: 2_147_483_646 }), fc.integer({ min: 1, max: 2_147_483_646 }), (eventId, anchor, before, after) => {
			const first = scheduleOccurrenceKey({ eventId, recurrenceAnchor: anchor, configurationRevision: before });
			const second = scheduleOccurrenceKey({ eventId, recurrenceAnchor: anchor, configurationRevision: after });
			expect(first).toEqual(expect.any(String));
			expect(first.length).toBeGreaterThan(0);
			expect(second).toBe(first);
			expect(scheduleOccurrenceKey({ eventId: eventId + "other", recurrenceAnchor: anchor, configurationRevision: after })).not.toBe(first);
			expect(scheduleOccurrenceKey({ eventId, recurrenceAnchor: anchor + "other", configurationRevision: after })).not.toBe(first);
		}),
		{ numRuns: 100 },
	);
});
