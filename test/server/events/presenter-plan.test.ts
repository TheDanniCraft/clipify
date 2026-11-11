import { buildAwardPresenterSteps } from "@/app/lib/eventPresenter";

const candidates = Array.from({ length: 5 }, (_, index) => ({ id: String(index), content: { kind: "text", title: `Candidate ${index}` } }));
const category = { id: "category", title: "Best fail", selection: "audience", candidates, results: candidates.map(({ id }, index) => ({ id, votes: 5 - index, winner: index === 0 })) };

it("stages every nominee separately and reveals third, second and first in order", () => {
	const steps = buildAwardPresenterSteps({ title: "Awards", categories: [category], slides: [] } as never);
	expect(steps.slice(0, 2).map(({ type }) => type)).toEqual(["welcome", "category-title"]);
	expect(steps.flatMap((step) => (step.type === "nominee" ? [step.position] : []))).toEqual([0, 1, 2, 3, 4]);
	expect(steps.flatMap((step) => (step.type === "reveal" ? [step.place] : []))).toEqual([0, 3, 2, 1]);
	expect(steps.slice(-3).map(({ type }) => type)).toEqual(["closing-title", "closing", "publish"]);
});

it("skips nonexistent ranks for ties and zero votes", () => {
	const results = [
		{ id: "0", votes: 5, winner: true },
		{ id: "1", votes: 5, winner: true },
		{ id: "2", votes: 3, winner: false },
		{ id: "3", votes: 0, winner: false },
	];
	const steps = buildAwardPresenterSteps({ title: "Awards", categories: [{ ...category, results }], slides: [] } as never);
	expect(steps.flatMap((step) => (step.type === "reveal" ? [step.place] : []))).toEqual([0, 3, 1]);
});

it("introduces statistics and data awards before displaying their contents", () => {
	const steps = buildAwardPresenterSteps({
		title: "Awards",
		categories: [{ ...category, id: "watchtime", selection: "data", candidates: [] }],
		slides: [
			{ id: "stats", type: "statistics", title: "The year", text: "", statistics: [{ label: "Hours", source: "manual", value: 321 }] },
			{ id: "watchtime-slide", type: "category", categoryId: "watchtime", title: "", text: "", statistics: [] },
		],
	} as never);
	expect(steps.map((step) => step.type)).toEqual(["statistics-title", "statistics", "category-title", "data-intro", "data-result", "publish"]);
});

it("allows a category slide to show only its winner", () => {
	const steps = buildAwardPresenterSteps({ title: "Awards", categories: [category], slides: [{ id: "slide", type: "category", categoryId: category.id, title: "", text: "", statistics: [], presenterMode: "winner" }] } as never);
	expect(steps.map((step) => step.type)).toEqual(["category-title", "reveal", "publish"]);
	expect(steps[1]).toMatchObject({ place: 1 });
});

it("presents data nominees before the data award winner when configured", () => {
	const steps = buildAwardPresenterSteps({ title: "Awards", categories: [{ ...category, selection: "data", presenterMode: "nominees" }], slides: [] } as never);
	expect(steps.filter((step) => step.type === "nominee")).toHaveLength(5);
	expect(steps.map((step) => step.type)).toContain("data-result");
	expect(steps.map((step) => step.type)).not.toContain("reveal");
});
