import type { PublicAwardEvent } from "./eventPublicView";
import type { EventConfiguration } from "./eventConfiguration";
type Slide = EventConfiguration["slides"][number];
export type AwardPresenterStep = { id: string; type: "welcome" | "text" | "statistics" | "closing"; slide: Slide } | { id: string; type: "nominees" | "distribution" | "results"; slide: Slide; categoryId: string; candidateIds: string[]; page: number; pages: number } | { id: string; type: "data-intro" | "data-result"; slide: Slide; categoryId: string } | { id: string; type: "publish" };
export function buildAwardPresenterSteps(event: PublicAwardEvent): AwardPresenterStep[] {
	const empty = { text: "", statistics: [] };
	const slides: Slide[] = event.slides?.length ? event.slides : [{ ...empty, id: "welcome", type: "welcome", title: event.title, text: event.description || "" }, ...event.categories.map((category) => ({ ...empty, id: `category:${category.id}`, type: "category" as const, title: category.title, categoryId: category.id })), { ...empty, id: "closing", type: "closing", title: "Thank you!" }];
	const steps: AwardPresenterStep[] = [];
	for (const slide of slides) {
		if (slide.type !== "category") {
			steps.push({ id: slide.id, type: slide.type, slide });
			continue;
		}
		const category = event.categories.find((category) => category.id === slide.categoryId);
		if (!category) continue;
		if (category.selection === "data") {
			steps.push({ id: `${slide.id}:intro`, type: "data-intro", slide, categoryId: category.id }, { id: `${slide.id}:result`, type: "data-result", slide, categoryId: category.id });
			continue;
		}
		const pages = Math.max(1, Math.ceil(category.candidates.length / 6));
		const nomineeIds = category.candidates.map((candidate) => candidate.id);
		// Keep the concealed entries in the same order when their identities are revealed.
		const revealIds = [...nomineeIds].sort();
		for (let page = 0; page < pages; page++) steps.push({ id: `${slide.id}:nominees:${page}`, type: "nominees", slide, categoryId: category.id, candidateIds: nomineeIds.slice(page * 6, page * 6 + 6), page, pages });
		for (let page = 0; page < pages; page++) for (const type of ["distribution", "results"] as const) steps.push({ id: `${slide.id}:${type}:${page}`, type, slide, categoryId: category.id, candidateIds: revealIds.slice(page * 6, page * 6 + 6), page, pages });
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
