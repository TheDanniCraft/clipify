import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, type TransactionClient } from "@/db/client";
import { awardEventsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { eventInputSchema, type EventConfiguration } from "@/app/lib/eventConfiguration";
import { getActivePartnerAccessGrant, resolveUserEntitlements } from "@/app/lib/entitlements";

export type AwardEvent = typeof awardEventsTable.$inferSelect;
export type ManagedAwardEvent = Omit<AwardEvent, "presenterDigest">;
export type EventErrorCode = "INVALID_INPUT" | "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "NOT_FOUND" | "CONFLICT" | "PARTNER_REQUIRED" | "PRO_REQUIRED" | "PHASE_CLOSED" | "LIMIT_REACHED" | "STORAGE_REQUIRED" | "PROVIDER_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
export class EventError extends Error {
	constructor(readonly code: EventErrorCode) {
		super(code);
	}
}
export function eventError(error: unknown) {
	const codes: EventErrorCode[] = ["INVALID_INPUT", "ACCESS_DENIED", "AUTHENTICATION_REQUIRED", "NOT_FOUND", "CONFLICT", "PARTNER_REQUIRED", "PRO_REQUIRED", "PHASE_CLOSED", "LIMIT_REACHED", "STORAGE_REQUIRED", "PROVIDER_UNAVAILABLE"];
	return { ok: false as const, code: error instanceof Error && codes.includes(error.message as EventErrorCode) ? (error.message as EventErrorCode) : ("SERVICE_UNAVAILABLE" as const) };
}
export function managedEvent(row: AwardEvent): ManagedAwardEvent {
	const { presenterDigest: _digest, ...safe } = row;
	void _digest;
	return safe;
}
export const presenterDigest = (secret: string) => createHash("sha256").update(secret).digest("hex");
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:update", tx);
			await validateBenefits(ownerId, parsed.data, authority.creator);
			const secret = randomBytes(32).toString("base64url");
			const [row] = await tx
				.insert(awardEventsTable)
				.values({ ownerId, configuration: parsed.data, presenterDigest: presenterDigest(secret) })
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:read", tx);
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:read", tx);
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
			const authority = await authorizeLockedMutation(principal, ownerId, "creator:update", tx);
			const event = await lockAwardEvent(tx, ownerId, id);
			if (event.revision !== revision) throw new EventError("CONFLICT");
			if (event.publishedAt) throw new EventError("PHASE_CLOSED");
			await validateBenefits(ownerId, parsed.data, authority.creator);
			const [row] = await tx
				.update(awardEventsTable)
				.set({ configuration: parsed.data, revision: revision + 1, updatedAt: new Date() })
				.where(eq(awardEventsTable.id, id))
				.returning();
			authority.assertAuthorityCurrent();
			return { ok: true as const, event: managedEvent(row) };
		});
	} catch (error) {
		return eventError(error);
	}
}
