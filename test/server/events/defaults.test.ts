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

it("can represent all nineteen supplied Babbler categories without hard-coded product types", async () => {
	const { babblerAwardPilot } = await import("../../support/events/pilot");
	const configuration = babblerAwardPilot(crypto.randomUUID());
	expect(eventInputSchema.safeParse(configuration).success).toBe(true);
	expect(configuration.categories).toHaveLength(19);
	expect(configuration.categories.filter((category) => category.selection === "data")).toHaveLength(4);
	expect(new Set(configuration.categories.map((category) => category.source))).toEqual(new Set(["image", "clip", "choice", "person", "text", "game", "youtube"]));
});
