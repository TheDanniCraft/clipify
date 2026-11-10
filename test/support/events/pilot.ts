import { createAwardConfiguration } from "../../../src/app/lib/eventDefaults";
import type { EventSource, EventCategory } from "../../../src/app/lib/eventConfiguration";
/** Pilot acceptance data only; creators configure their own names, choices and dates. */
export function babblerAwardPilot(storageConnectionId: string) {
	const configuration = createAwardConfiguration("Babbler Awards", "Europe/Berlin"),
		base = configuration.categories[0];
	configuration.storageConnectionId = storageConnectionId;
	const category = (title: string, group: string, source: EventSource, selection: EventCategory["selection"] = "audience"): EventCategory => ({ ...base, id: crypto.randomUUID(), title, group, source, selection, options: source === "choice" ? ["Sorte A", "Sorte B"] : [] });
	configuration.categories = [
		...[
			["Bestes YouTube Thumbnail", "image"],
			["Größter Technischer Fail", "clip"],
			["Bester Play des Jahres von Jan", "clip"],
			["Dümmstes Zitat von Jan", "text"],
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
	return configuration;
}
