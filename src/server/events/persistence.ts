import "server-only";
import { materializeAwardDeck } from "@/app/lib/eventPresenter";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { z } from "zod";
import { eventSlideSchema, awardPresentationSchema, eventInputSchema, type EventConfiguration } from "@/app/lib/eventConfiguration";
import { getActivePartnerAccessGrant, resolveUserEntitlements } from "@/app/lib/entitlements";

export type AwardEvent = typeof awardEventsTable.$inferSelect;
export type ManagedAwardEvent = Omit<AwardEvent, "presenterDigest">;
export type EventErrorCode = "INVALID_INPUT" | "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "NOT_FOUND" | "CONFLICT" | "PARTNER_REQUIRED" | "PRO_REQUIRED" | "RESULTS_REQUIRED" | "PHASE_CLOSED" | "LIMIT_REACHED" | "STORAGE_REQUIRED" | "PROVIDER_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
export class EventError extends Error {
	constructor(readonly code: EventErrorCode) {
		super(code);
	}
}
export function eventError(error: unknown) {
	const codes: EventErrorCode[] = ["INVALID_INPUT", "ACCESS_DENIED", "AUTHENTICATION_REQUIRED", "NOT_FOUND", "CONFLICT", "PARTNER_REQUIRED", "PRO_REQUIRED", "RESULTS_REQUIRED", "PHASE_CLOSED", "LIMIT_REACHED", "STORAGE_REQUIRED", "PROVIDER_UNAVAILABLE"];
	return { ok: false as const, code: error instanceof Error && codes.includes(error.message as EventErrorCode) ? (error.message as EventErrorCode) : ("SERVICE_UNAVAILABLE" as const) };
}
export function managedEvent(row: AwardEvent): ManagedAwardEvent {
	const { presenterDigest: _digest, ...safe } = row;
	void _digest;
	return safe;
}
export const presenterDigest = (secret: string) => createHash("sha256").update(secret).digest("hex");
export function hasAwardPresenterSecret(event: Pick<AwardEvent, "presenterDigest">, secret: unknown) {
	return typeof secret === "string" && /^[A-Za-z0-9_-]{43}$/.test(secret) && /^[0-9a-f]{64}$/i.test(event.presenterDigest) && timingSafeEqual(Buffer.from(presenterDigest(secret), "hex"), Buffer.from(event.presenterDigest, "hex"));
}

async function validateBenefits(ownerId: string, configuration: EventConfiguration, creator: Parameters<typeof resolveUserEntitlements>[0]) {
	if (configuration.visibility === "public" && !(await getActivePartnerAccessGrant(ownerId))) throw new EventError("PARTNER_REQUIRED");
	if (configuration.whiteLabel && !(await resolveUserEntitlements(creator)).proAccess) throw new EventError("PRO_REQUIRED");
}
export async function lockAwardEvent(tx: TransactionClient, ownerId: string, id: string) {
	const [event] = await tx
		.select()
		.from(awardEventsTable)
		.where(and(eq(awardEventsTable.id, id), eq(awardEventsTable.ownerId, ownerId)))
		.limit(1)
		.for("update");
	if (!event) throw new EventError("NOT_FOUND");
	return event;
}
export async function createAwardEvent(principal: TrustedCreatorPrincipal, ownerId: string, raw: unknown) {
	const parsed = eventInputSchema.safeParse(raw);
	if (!parsed.success || !ownerId || ownerId.length > 200) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:create", tx);
			await validateBenefits(ownerId, parsed.data, authority.creator);
			const secret = randomBytes(32).toString("base64url");
			const [row] = await tx
				.insert(awardEventsTable)
				.values({ ownerId, configuration: materializeAwardDeck(parsed.data), presenterDigest: presenterDigest(secret) })
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row), presenterSecret: secret };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function readAwardEvent(principal: TrustedCreatorPrincipal, ownerId: string, id: string) {
	if (!/^[0-9a-f-]{36}$/i.test(id)) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:read", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(event) };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function listAwardEvents(principal: TrustedCreatorPrincipal, ownerId: string) {
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:read", tx);
			const rows = await tx.select().from(awardEventsTable).where(eq(awardEventsTable.ownerId, ownerId)).orderBy(desc(awardEventsTable.createdAt));
			authority.assertAuthorityCurrent();
			return { ok: true as const, events: rows.map(managedEvent) };
		});
	} catch (error) {
		return eventError(error);
	}
}
export async function updateAwardEvent(principal: TrustedCreatorPrincipal, ownerId: string, id: string, revision: number, raw: unknown) {
	const parsed = eventInputSchema.safeParse(raw);
	if (!parsed.success || !Number.isSafeInteger(revision) || revision < 1 || !/^[0-9a-f-]{36}$/i.test(id)) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (event.revision !== revision) throw new EventError("CONFLICT");
			if (event.publishedAt) throw new EventError("PHASE_CLOSED");
			await validateBenefits(ownerId, parsed.data, authority.creator);
			const [row] = await tx
				.update(awardEventsTable)
				.set({ configuration: materializeAwardDeck(parsed.data), revision: revision + 1, updatedAt: new Date() })
				.where(eq(awardEventsTable.id, id))
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row) };
		});
	} catch (error) {
		return eventError(error);
	}
}

const presentationInput = z.object({ slides: z.array(eventSlideSchema).max(500), presentation: awardPresentationSchema }).strict();
export async function saveAwardPresentation(principal: TrustedCreatorPrincipal, ownerId: string, id: string, revision: number, input: unknown) {
	const parsed = presentationInput.safeParse(input);
	if (!parsed.success || !z.uuid().safeParse(id).success || !Number.isSafeInteger(revision) || revision < 1) return eventError(new EventError("INVALID_INPUT"));
	try {
		return await db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, ownerId, "event:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (event.revision !== revision) throw new EventError("CONFLICT");
			const configuration = eventInputSchema.safeParse({ ...event.configuration, ...parsed.data });
			if (!configuration.success) throw new EventError("INVALID_INPUT");
			const [row] = await tx
				.update(awardEventsTable)
				.set({ configuration: materializeAwardDeck(configuration.data), revision: revision + 1, updatedAt: new Date() })
				.where(eq(awardEventsTable.id, id))
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row) };
		});
	} catch (error) {
		return eventError(error);
	}
}
