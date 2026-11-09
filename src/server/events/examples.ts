import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable, awardCandidatesTable, usersTable } from "@/db/schema";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { createBabblerExampleConfiguration } from "@/app/lib/eventExamples";
import { eventInputSchema } from "@/app/lib/eventConfiguration";
import { candidateInputSchema, canonicalCandidateKey, type EventCandidateContent } from "@/app/lib/eventCandidates";
import { managedEvent, presenterDigest, eventError, EventError } from "./persistence";
import { readCachedClipsByOwner } from "@/server/clip-cache-read";
export async function createAwardExample(principal: TrustedCreatorPrincipal, ownerId: string) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:create", tx);
			const [owner] = await tx.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);
			if (!owner) throw new EventError("NOT_FOUND");
			const configuration = eventInputSchema.parse(createBabblerExampleConfiguration());
			const clips = (await readCachedClipsByOwner(ownerId)).sort((a, b) => b.view_count - a.view_count).slice(0, 3);
			const [event] = await tx
				.insert(awardEventsTable)
				.values({ ownerId, configuration, presenterDigest: presenterDigest(randomBytes(32).toString("base64url")) })
				.returning();
			for (const category of configuration.categories.filter((category) => category.selection !== "data")) {
				let contents: EventCandidateContent[] = [];
				if (category.source === "clip") contents = clips.map((clip) => ({ kind: "clip", reference: clip.id, title: clip.title || clip.id, description: "Beispielnominierung aus deiner Clip-Bibliothek", creatorId: ownerId, clipperName: clip.creator_name, createdAt: clip.created_at, views: clip.view_count, duration: clip.duration, ...(clip.thumbnail_url ? { thumbnailUrl: clip.thumbnail_url } : {}) }));
				else if (category.source === "image" && clips[0]?.thumbnail_url) contents = [{ kind: "image", reference: "", title: "Beispielbild: Clip-Vorschaubild", description: "Vorschaubild aus deiner Clip-Bibliothek, kein eingereichtes Bild von Jan.", mediaUrl: clips[0].thumbnail_url }];
				else if (category.source === "choice") contents = category.options.map((title) => ({ kind: "choice", reference: title, title, description: "Beispielsorte für die Vorschau" }));
				else if (category.source === "person") contents = [{ kind: "person", reference: owner.username, title: owner.username, description: "Beispielnominierung für die Vorschau" }];
				else if (category.source === "text") contents = ["Lampe raucht ab", "Der Running Gag mit der Lampe"].map((title) => ({ kind: "text", reference: "", title, description: "Erfundene Beispielnominierung für die Vorschau" }));
				for (const [index, content] of contents.entries()) await tx.insert(awardCandidatesTable).values({ eventId: event.id, categoryId: category.id, canonicalKey: canonicalCandidateKey(content, `${event.id}:${category.id}:${index}`), content: candidateInputSchema.parse(content), nominated: false });
			}
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(event) };
		});
	} catch (error) {
		return eventError(error);
	}
}
