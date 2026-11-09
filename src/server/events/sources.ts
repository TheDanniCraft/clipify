import "server-only";
import { z } from "zod";
import type { EventCategory } from "@/app/lib/eventConfiguration";
import { candidateInputSchema, candidateMatchesRules, type EventCandidateContent } from "@/app/lib/eventCandidates";
import { resolveValidatedPlaylistClips } from "@/server/resources/clip-validation";
import { parseClipReference } from "@/server/resources/clip-references";
import { fetchClipDiscovery } from "@/server/resources/clip-discovery";
import { EventError } from "./persistence";
const sourceInput = z.object({ reference: z.string().max(2048).default(""), title: z.string().max(160).optional(), description: z.string().max(5000).default("") });
function eligible(content: EventCandidateContent, ownerId: string, category: EventCategory) {
	const parsed = candidateInputSchema.safeParse(content);
	if (!parsed.success || !candidateMatchesRules(parsed.data, ownerId, category.rules)) throw new EventError("INVALID_INPUT");
	return parsed.data;
}
export async function resolveAwardSource(ownerId: string, category: EventCategory, raw: unknown): Promise<EventCandidateContent> {
	const parsed = sourceInput.safeParse(raw);
	if (!parsed.success) throw new EventError("INVALID_INPUT");
	const input = parsed.data;
	if (category.source === "clip") {
		const id = parseClipReference(input.reference);
		const [clip] = await resolveValidatedPlaylistClips(ownerId, [id]);
		if (!clip || clip.broadcaster_id !== ownerId) throw new EventError("INVALID_INPUT");
		return eligible({ kind: "clip", reference: clip.id, title: clip.title, description: "", creatorId: clip.broadcaster_id, createdAt: clip.created_at, views: clip.view_count ?? 0, duration: clip.duration, ...(clip.thumbnail_url ? { thumbnailUrl: clip.thumbnail_url } : {}) }, ownerId, category);
	}
	if (category.source === "youtube") return eligible(await (await import("./youtube")).resolveAwardYoutube(ownerId, input.reference), ownerId, category);
	if (category.source === "game") {
		if (!/^\d{1,20}$/.test(input.reference)) throw new EventError("INVALID_INPUT");
		const game = await (await import("@/app/actions/twitch")).getGameDetails(input.reference, ownerId);
		if (!game || game.id !== input.reference) throw new EventError("INVALID_INPUT");
		return eligible({ kind: "game", reference: game.id, title: game.name, description: "", thumbnailUrl: game.box_art_url.replace("{width}", "480").replace("{height}", "640") }, ownerId, category);
	}
	if (category.source === "choice") {
		if (!category.options.includes(input.reference)) throw new EventError("INVALID_INPUT");
		return eligible({ kind: "choice", reference: input.reference, title: input.reference, description: "" }, ownerId, category);
	}
	if (category.source === "text") return eligible({ kind: "text", reference: "", title: input.title ?? "", description: input.description }, ownerId, category);
	if (category.source === "person") {
		const username = input.reference.trim().replace(/^@/, "").toLowerCase();
		if (!/^[a-z0-9_]{1,25}$/.test(username)) throw new EventError("INVALID_INPUT");
		return eligible({ kind: "person", reference: username, title: username, description: input.description }, ownerId, category);
	}
	if (category.source === "link") {
		try {
			const url = new URL(input.reference);
			if (url.protocol !== "https:" || url.username || url.password) throw new Error();
			return eligible({ kind: "link", reference: url.toString(), title: input.title ?? url.hostname, description: input.description }, ownerId, category);
		} catch {
			throw new EventError("INVALID_INPUT");
		}
	}
	throw new EventError("PROVIDER_UNAVAILABLE");
}
export async function searchAwardClips(ownerId: string, category: EventCategory, query: string) {
	if (category.source !== "clip" || query.length > 2048) throw new EventError("INVALID_INPUT");
	if (/^https?:\/\//i.test(query.trim())) return [await resolveAwardSource(ownerId, category, { reference: query })];
	const rules = category.rules;
	const batch = await fetchClipDiscovery(ownerId, { startedAt: rules.startedAt, endedAt: rules.endedAt, minViews: rules.minViews, minDuration: rules.minDuration, maxDuration: rules.maxDuration, title: rules.titleIncludes });
	const search = query.trim().toLocaleLowerCase("en");
	return batch.clips
		.map((clip) => ({ kind: "clip" as const, reference: clip.id, title: clip.title, description: "", creatorId: clip.broadcaster_id, createdAt: clip.created_at, views: clip.view_count ?? 0, duration: clip.duration, ...(clip.thumbnail_url ? { thumbnailUrl: clip.thumbnail_url } : {}) }))
		.filter((clip) => candidateMatchesRules(clip, ownerId, rules) && (!search || clip.title.toLocaleLowerCase("en").includes(search) || clip.reference === query))
		.slice(0, 40);
}

import { db } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { awardPhase } from "./submissions";
async function eventSourceContext(eventId: string, categoryId: string) {
	if (!z.uuid().safeParse(eventId).success || !z.uuid().safeParse(categoryId).success) throw new EventError("INVALID_INPUT");
	const [event] = await db.select().from(awardEventsTable).where(eq(awardEventsTable.id, eventId)).limit(1);
	if (!event?.publishedAt || awardPhase(event, new Date()) !== "submissions") throw new EventError("PHASE_CLOSED");
	const category = event.configuration.categories.find((c) => c.id === categoryId);
	if (!category || category.selection !== "audience") throw new EventError("INVALID_INPUT");
	return { event, category };
}
export async function resolveEventCandidate(eventId: string, categoryId: string, raw: unknown) {
	const { event, category } = await eventSourceContext(eventId, categoryId);
	return resolveAwardSource(event.ownerId, category, raw);
}
export async function searchEventSources(eventId: string, categoryId: string, query: string) {
	const { event, category } = await eventSourceContext(eventId, categoryId);
	if (category.source === "clip") return searchAwardClips(event.ownerId, category, query);
	if (category.source === "youtube") return (await (await import("./youtube")).searchAwardYoutube(event.ownerId, query)).filter((item) => candidateMatchesRules(item, event.ownerId, category.rules));
	if (category.source === "game") {
		const games = await (await import("@/app/actions/twitch")).getTwitchGames(query, event.ownerId);
		return games.slice(0, 40).map((game) => ({ kind: "game" as const, reference: game.id, title: game.name, description: "", thumbnailUrl: game.box_art_url.replace("{width}", "480").replace("{height}", "640") }));
	}
	throw new EventError("INVALID_INPUT");
}
