import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, dbPool } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable, awardVotesTable, usersTable } from "@/db/schema";
import { account as accounts } from "@/db/auth-schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";
import { withSerializedProviderCredential } from "@/server/provider-credentials";
import { requestProviderJson } from "@/server/runner/provider-api";
import { projectAwardEvent } from "@/app/lib/eventPublicView";
import { eventInteractionFits, eventInteractionScopes, type EventInteractionType } from "@/app/lib/eventInteractions";
import { EventError, eventError, hasAwardPresenterSecret } from "./persistence";

async function linkedAccount(ownerId: string) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.providerId, "twitch"), eq(accounts.accountId, ownerId)))
		.limit(1);
	return account;
}
export async function eventTwitchConnection(principal: TrustedCreatorPrincipal, ownerId: string, kind?: EventInteractionType, eventId?: string) {
	try {
		if (kind !== undefined && kind !== "poll" && kind !== "prediction") throw new EventError("INVALID_INPUT");
		await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			authority.assertAuthorityCurrent();
		});
		const account = await linkedAccount(ownerId);
		const granted = new Set((account?.scope ?? "").split(/[ ,]+/));
		const status = { poll: granted.has(eventInteractionScopes.poll), prediction: granted.has(eventInteractionScopes.prediction), canAuthorize: account?.userId === principal.authUserId };
		if (!kind) return { ok: true as const, ...status };
		if (!status.canAuthorize || principal.kind !== "session" || !z.uuid().safeParse(eventId).success) throw new EventError("ACCESS_DENIED");
		const callback = new URL(`/dashboard/events/${eventId}?section=connections`, resolveBaseUrl().origin).toString();
		return { ok: true as const, ...status, link: { provider: "twitch" as const, scopes: [...new Set([...TWITCH_REQUIRED_SCOPES, ...granted, eventInteractionScopes[kind]])].filter(Boolean), callbackURL: callback, errorCallbackURL: callback, additionalParams: { force_verify: "true" } } };
	} catch (error) {
		return eventError(error);
	}
}
async function providerToken(ownerId: string, kind: EventInteractionType) {
	const account = await linkedAccount(ownerId);
	if (!account || !(account.scope ?? "").split(/[ ,]+/).includes(eventInteractionScopes[kind])) throw new EventError("PROVIDER_UNAVAILABLE");
	const { auth } = await import("@/auth/config");
	const token = await withSerializedProviderCredential(dbPool, account.id, () => auth.api.getAccessToken({ body: { accountId: account.id, userId: account.userId } }));
	return { Authorization: `Bearer ${token.accessToken}`, "Client-Id": process.env.TWITCH_CLIENT_ID!, "Content-Type": "application/json" };
}
const option = z.object({ id: z.string().min(1).max(128), title: z.string().max(100) });
const remote = z.object({ id: z.string().min(1).max(128), status: z.enum(["ACTIVE", "LOCKED", "COMPLETED", "RESOLVED", "CANCELED", "TERMINATED", "ARCHIVED", "MODERATED"]), choices: z.array(option).optional(), outcomes: z.array(option).optional() });
async function twitch(kind: EventInteractionType, headers: HeadersInit, method: "GET" | "POST" | "PATCH", ownerId: string, body?: Record<string, unknown>, id?: string) {
	const query = method === "GET" ? `?broadcaster_id=${encodeURIComponent(ownerId)}${id ? `&id=${encodeURIComponent(id)}` : ""}` : "";
	const payload = await requestProviderJson(`https://api.twitch.tv/helix/${kind === "poll" ? "polls" : "predictions"}${query}`, { method, headers, ...(body ? { body: JSON.stringify({ broadcaster_id: ownerId, ...body }) } : {}) });
	return z.object({ data: z.array(remote) }).parse(payload).data;
}
const trim = (text: string, max: number) => Array.from(text).slice(0, max).join("");
export async function runEventInteraction(eventId: string, secret: string, slideId: string, action: "start" | "status" | "resolve" | "skip", now = new Date()) {
	if (!z.uuid().safeParse(eventId).success || !z.uuid().safeParse(slideId).success || !["start", "status", "resolve", "skip"].includes(action)) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1).for("update");
			if (!event?.publishedAt || !hasAwardPresenterSecret(event, secret)) throw new EventError("NOT_FOUND");
			const [owner] = await tx.select({ disabled: usersTable.disabled }).from(usersTable).where(eq(usersTable.id, event.ownerId)).limit(1);
			if (!owner || owner.disabled) throw new EventError("NOT_FOUND");
			if (now < new Date(event.configuration.schedule.votingEnd)) throw new EventError("PHASE_CLOSED");
			const slide = event.configuration.slides.find((slide) => slide.id === slideId && slide.type === "category");
			if (!slide?.interaction) throw new EventError("INVALID_INPUT");
			const configuration = slide.interaction;
			// One Twitch interaction per broadcaster, even when two event shows are open.
			await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`award-twitch:${event.ownerId}`}, 0))`);
			const states = { ...(event.twitchInteractions ?? {}) };
			let state = states[slideId];
			const save = async () => {
				await tx
					.update(events)
					.set({ twitchInteractions: { ...states, [slideId]: state }, updatedAt: now })
					.where(eq(events.id, eventId));
			};
			if (state?.status === "SKIPPED") return { ok: true as const, state };
			if (action === "skip") {
				let manualCheck = false;
				if (state?.id && ["ACTIVE", "LOCKED"].includes(state.status)) {
					try {
						const headers = await providerToken(event.ownerId, state.type);
						await twitch(state.type, headers, "PATCH", event.ownerId, { id: state.id, status: state.type === "poll" ? "TERMINATED" : "CANCELED" });
					} catch {
						manualCheck = true;
					}
				}
				state = { type: configuration.type, status: "SKIPPED", endsAt: now.toISOString(), outcomes: {}, manualCheck };
				await save();
				return { ok: true as const, state };
			}
			if (state && state.type !== configuration.type) throw new EventError("CONFLICT");
			if (state && !["ACTIVE", "LOCKED"].includes(state.status)) return { ok: true as const, state };
			if (!state && action === "resolve") {
				state = { type: configuration.type, status: "SKIPPED", endsAt: now.toISOString(), outcomes: {} };
				await save();
				return { ok: true as const, state };
			}
			const headers = await providerToken(event.ownerId, configuration.type);
			if (!state && action === "status") return { ok: true as const, state: null };
			const candidates = await tx.select().from(awardCandidatesTable).where(eq(awardCandidatesTable.eventId, eventId));
			const counts = await tx
				.select({ candidateId: awardVotesTable.candidateId, votes: sql<number>`count(*)::integer` })
				.from(awardVotesTable)
				.where(eq(awardVotesTable.eventId, eventId))
				.groupBy(awardVotesTable.candidateId);
			const projected = projectAwardEvent(event, candidates, counts, true, now);
			const category = projected.categories.find((category) => category.id === slide.categoryId);
			if (!category || (slide.presenterMode ?? category.presenterMode) === "winner" || !eventInteractionFits(configuration.type, category.candidates.length)) throw new EventError("LIMIT_REACHED");
			if (!state) {
				if (action !== "start") throw new EventError("INVALID_INPUT");
				const existing = await twitch(configuration.type, headers, "GET", event.ownerId);
				if (existing.some((entry) => entry.status === "ACTIVE" || entry.status === "LOCKED")) throw new EventError("CONFLICT");
				const ordered = [...category.candidates].sort((a, b) => a.id.localeCompare(b.id));
				const labels = ordered.map((candidate, index) => `${index + 1}. ${trim(candidate.content.title, 21)}`);
				const body = { title: trim(slide.title || category.title, configuration.type === "poll" ? 60 : 45), [configuration.type === "poll" ? "choices" : "outcomes"]: labels.map((title) => ({ title })), [configuration.type === "poll" ? "duration" : "prediction_window"]: configuration.duration };
				const [created] = await twitch(configuration.type, headers, "POST", event.ownerId, body);
				const options = created?.choices ?? created?.outcomes ?? [];
				if (!created || options.length !== ordered.length || labels.some((label) => !options.some((option) => option.title === label))) throw new EventError("PROVIDER_UNAVAILABLE");
				state = { type: configuration.type, id: created.id, status: created.status, endsAt: new Date(now.getTime() + configuration.duration * 1000).toISOString(), outcomes: Object.fromEntries(ordered.map((candidate, index) => [candidate.id, options.find((option) => option.title === labels[index])!.id])) };
			} else {
				const [current] = await twitch(state.type, headers, "GET", event.ownerId, undefined, state.id);
				if (!current) throw new EventError("PROVIDER_UNAVAILABLE");
				state = { ...state, status: current.status };
			}
			if (state.type === "prediction" && state.status === "ACTIVE" && (now >= new Date(state.endsAt) || (action === "resolve" && !configuration.wait))) {
				const [locked] = await twitch(state.type, headers, "PATCH", event.ownerId, { id: state.id, status: "LOCKED" });
				if (!locked) throw new EventError("PROVIDER_UNAVAILABLE");
				state = { ...state, status: locked.status };
			}
			if (action === "resolve" && state.type === "prediction" && state.status === "LOCKED") {
				const winners = category.selection === "data" ? category.candidates.slice(0, 1) : category.candidates.filter((candidate) => category.results?.some((result) => result.id === candidate.id && result.winner));
				const winningOutcome = winners.length === 1 ? state.outcomes[winners[0].id] : undefined;
				const [resolved] = await twitch(state.type, headers, "PATCH", event.ownerId, { id: state.id, status: winningOutcome ? "RESOLVED" : "CANCELED", ...(winningOutcome ? { winning_outcome_id: winningOutcome } : {}) });
				if (!resolved) throw new EventError("PROVIDER_UNAVAILABLE");
				state = { ...state, status: resolved.status };
			}
			await save();
			return { ok: true as const, state };
		});
	} catch (error) {
		return eventError(error);
	}
}
