import { buildAwardPresenterSteps } from "@/app/lib/eventPresenter";
const category = { id: "category", title: "Best fail", selection: "audience", candidates: Array.from({ length: 13 }, (_, index) => ({ id: String(index), content: { kind: "text", title: `Candidate ${index}`, description: "", reference: "" } })) };
it("presents every nominee in bounded pages before revealing that category's results", () => {
	const steps = buildAwardPresenterSteps({ title: "Awards", categories: [category], slides: [] } as never);
	expect(steps[0].type).toBe("welcome");
	expect(steps.flatMap((s) => (s.type === "nominees" ? [s.candidateIds.length] : []))).toEqual([6, 6, 1]);
	expect(steps.flatMap((s) => (s.type === "results" ? [s.candidateIds.length] : []))).toEqual([6, 6, 1]);
	const reveals = steps.flatMap((s) => (s.type === "distribution" || s.type === "results" ? [{ type: s.type, candidateIds: s.candidateIds }] : []));
	expect(reveals.map((s) => s.type)).toEqual(["distribution", "results", "distribution", "results", "distribution", "results"]);
	for (let i = 0; i < reveals.length; i += 2) {
		expect(reveals[i]).toMatchObject({ candidateIds: reveals[i + 1].candidateIds });
	}
	expect(reveals.flatMap((s) => (s.type === "distribution" ? s.candidateIds : []))).not.toEqual(category.candidates.map((candidate) => candidate.id));
	const lastNominee = steps.findLastIndex((s) => s.type === "nominees"),
		firstResult = steps.findIndex((s) => s.type === "results");
	expect(firstResult).toBeGreaterThan(lastNominee);
	expect(steps.at(-2)?.type).toBe("closing");
	expect(steps.at(-1)?.type).toBe("publish");
});
it("keeps manually arranged statistic slides and data awards in order without inventing nominees", () => {
	const steps = buildAwardPresenterSteps({
		title: "Awards",
		categories: [{ ...category, id: "watchtime", selection: "data", candidates: [] }],
		slides: [
			{ id: "stats", type: "statistics", title: "The year", text: "", statistics: [{ label: "Hours", source: "manual", value: 321 }] },
			{ id: "watchtime-slide", type: "category", categoryId: "watchtime", title: "", text: "", statistics: [] },
		],
	} as never);
	expect(steps.map((s) => s.type)).toEqual(["statistics", "data-intro", "data-result", "publish"]);
	expect(steps[0]).toMatchObject({ slide: { statistics: [{ value: 321 }] } });
});
