import { createAwardConfiguration } from "./eventDefaults";
import { defaultAwardSlides } from "./eventPresenter";
import type { EventSource, EventCategory } from "./eventConfiguration";
/** The user-requested example stays a private draft with clearly labelled sample content. */
export function createBabblerExampleConfiguration(timezone = "Europe/Berlin", now = new Date()) {
	const configuration = createAwardConfiguration("Babbler Awards", timezone, now),
		base = configuration.categories[0];
	configuration.description = "Demo für die Babbler Awards. Beispielnominierungen und Beispielergebnisse dienen nur der Vorschau. Clips werden aus allen Jahren berücksichtigt.";
	const category = (title: string, group: string, source: EventSource, selection: EventCategory["selection"] = "audience"): EventCategory => ({ ...base, id: crypto.randomUUID(), title, group, source, selection, options: source === "choice" ? ["Beispielsorte A", "Beispielsorte B"] : [] });
	configuration.categories = [
		...[
			["Bestes YouTube Thumbnail", "image"],
			["Größter Technischer Fail", "clip"],
			["Bester Play des Jahres von Jan", "clip"],
			["Dümmstes Zitat von Jan", "clip"],
			["Bester Erschrecker des Jahres", "clip"],
			["Bester Holy des Jahres", "choice"],
		].map(([title, source]) => category(title, "Jan Deluxe", source as EventSource, source === "choice" ? "team" : "audience")),
		...[
			["Größter Troll des Jahres", "clip"],
			["Bester Fail des Jahres", "clip"],
			["Bester Play des Jahres", "clip"],
			["Lustigstes Bild von Jan", "image"],
			["Größter Ragebaiter/Trashtalker", "person"],
			["Insider des Jahres", "text"],
			["Größter Lachflash des Jahres", "clip"],
			["Bestes Side-Game", "game"],
			["Überraschungskategorie", "text"],
		].map(([title, source]) => category(title, "Community", source as EventSource)),
		...[
			["Clip des Jahres", "clip"],
			["Video des Jahres", "youtube"],
			["Top Watchtime", "text"],
			["Babbler Team des Jahres", "text"],
		].map(([title, source]) => category(title, "Datenbasierte Kategorien", source as EventSource, "data")),
	];
	configuration.slides = defaultAwardSlides(configuration.categories);
	configuration.slides.splice(1, 0, {
		id: crypto.randomUUID(),
		type: "statistics",
		title: "Die Show in Zahlen",
		text: "Vorschau mit Beispieldaten",
		statistics: [
			{ label: "Kategorien", source: "categories" },
			{ label: "Nominierte", source: "nominees" },
			{ label: "Clips in deiner Bibliothek", source: "clips" },
		],
	});
	for (const category of configuration.categories.filter((category) => category.selection === "data")) category.manualResult = { title: `Demo: ${category.title}`, description: "Beispielergebnis für die Vorschau. Vor der echten Show ersetzen." };
	return configuration;
}
