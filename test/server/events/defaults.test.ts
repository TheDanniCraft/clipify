import { createAwardConfiguration } from "@/app/lib/eventDefaults";
import { eventInputSchema } from "@/app/lib/eventConfiguration";
it("creates a valid local-timezone award draft with editable category and future phases", () => {
	const now = new Date("2026-11-09T18:00:00Z");
	const draft = createAwardConfiguration("Babbler Awards", "Europe/Berlin", now);
	expect(eventInputSchema.safeParse(draft).success).toBe(true);
	expect(draft.title).toBe("Babbler Awards");
	expect(draft.schedule.timezone).toBe("Europe/Berlin");
	expect(Date.parse(draft.schedule.submissionsStart)).toBeGreaterThan(now.getTime());
	expect(draft.visibility).toBe("unlisted");
	expect(draft.whiteLabel).toBe(false);
});
