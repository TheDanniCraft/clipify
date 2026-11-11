import type { PublicAwardEvent } from "./eventPublicView";
import type { EventConfiguration } from "./eventConfiguration";
type Slide = EventConfiguration["slides"][number];
type Category = PublicAwardEvent["categories"][number];
export type AwardPresenterStep = { id: string; type: "welcome" | "text" | "statistics-title" | "statistics" | "closing-title" | "closing"; slide: Slide } | { id: string; type: "category-title" | "data-intro" | "data-result"; slide: Slide; categoryId: string } | { id: string; type: "nominee"; slide: Slide; categoryId: string; position: number } | { id: string; type: "reveal"; slide: Slide; categoryId: string; place: number } | { id: string; type: "publish" };

export function rankAwardNominees(category: Category) {
	const entries = category.candidates.flatMap((candidate) => {
		const result = category.results?.find((entry) => entry.id === candidate.id);
		return result && "votes" in result ? [{ candidate, result }] : [];
	});
	entries.sort((a, b) => b.result.votes - a.result.votes || Number(b.result.winner) - Number(a.result.winner));
	return entries.map((entry) => {
		const firstEqual = entries.findIndex(({ result }) => result.votes === entry.result.votes && result.winner === entry.result.winner);
		return { ...entry, place: entry.result.votes === 0 ? null : firstEqual + 1 };
	});
}
export function buildAwardPresenterSteps(event: PublicAwardEvent): AwardPresenterStep[] {
	const empty = { text: "", statistics: [] };
	const slides: Slide[] = event.slides?.length ? event.slides : [{ ...empty, id: "welcome", type: "welcome", title: event.title, text: event.description || "" }, ...event.categories.map((category) => ({ ...empty, id: `category:${category.id}`, type: "category" as const, title: category.title, categoryId: category.id })), { ...empty, id: "closing", type: "closing", title: "Thank you!" }];
	const steps: AwardPresenterStep[] = [];
	for (const slide of slides) {
		if (slide.type !== "category") {
			if (slide.type === "statistics" || slide.type === "closing") {
				steps.push({ id: `${slide.id}:title`, type: slide.type === "statistics" ? "statistics-title" : "closing-title", slide });
			}
			steps.push({ id: slide.id, type: slide.type, slide });
			continue;
		}
		const category = event.categories.find((category) => category.id === slide.categoryId);
		if (!category) continue;
		const section = { slide, categoryId: category.id };
		steps.push({ ...section, id: `${slide.id}:title`, type: "category-title" });
		if (category.selection === "data") {
			if ((slide.presenterMode ?? category.presenterMode) === "nominees") {
				for (const [position] of category.candidates.entries()) steps.push({ ...section, id: `${slide.id}:nominee:${position}`, type: "nominee", position });
			}
			steps.push({ ...section, id: `${slide.id}:intro`, type: "data-intro" }, { ...section, id: `${slide.id}:result`, type: "data-result" });
			continue;
		}
		if ((slide.presenterMode ?? category.presenterMode) === "winner") {
			steps.push({ ...section, id: `${slide.id}:place:1`, type: "reveal", place: 1 });
			continue;
		}
		for (const [position] of category.candidates.entries()) {
			steps.push({ ...section, id: `${slide.id}:nominee:${position}`, type: "nominee", position });
		}
		steps.push({ ...section, id: `${slide.id}:reveal`, type: "reveal", place: 0 });
		const places = [...new Set(rankAwardNominees(category).flatMap(({ place }) => (place && place <= 3 ? [place] : [])))].sort((a, b) => b - a);
		if (!places.includes(1)) places.push(1);
		for (const place of places) {
			steps.push({ ...section, id: `${slide.id}:place:${place}`, type: "reveal", place });
		}
	}
	steps.push({ id: "publish", type: "publish" });
	return steps;
}

export function defaultAwardSlides(categories: ReadonlyArray<{ id: string }>): Slide[] {
	return [{ id: crypto.randomUUID(), type: "welcome", title: "", text: "", statistics: [] }, ...categories.map((category) => ({ id: crypto.randomUUID(), type: "category" as const, categoryId: category.id, title: "", text: "", statistics: [] })), { id: crypto.randomUUID(), type: "closing", title: "Thank you!", text: "", statistics: [] }];
}
export function materializeAwardDeck(configuration: EventConfiguration): EventConfiguration {
	return configuration.slides.length ? configuration : { ...configuration, slides: defaultAwardSlides(configuration.categories) };
}
