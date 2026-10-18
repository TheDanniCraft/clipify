import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient, type TransactionClient } from "@/db/client";
import { auditEventsTable, runnerDestinationsTable, runnersTable, streamSessionDestinationsTable, streamSessionsTable, runnerScheduleEventDestinationsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { resourceFailure } from "@/server/resources/errors";

const ownerId = z
	.string()
	.min(1)
	.max(255)
	.regex(/^[A-Za-z0-9_-]+$/);
const uuid = z.uuid();
const revision = z.number().int().positive().max(2_147_483_646);
const destinationInput = z
	.object({
		ownerId,
		runnerId: uuid.nullable().optional(),
		id: uuid.optional(),
		expectedRevision: revision.optional(),
		name: z.string().trim().min(1).max(80),
		provider: z.enum(["youtube", "twitch", "custom"]),
		rtmpUrl: z
			.string()
			.max(4096)
			.refine((value) => !/[\u0000-\u001f\u007f]/.test(value))
			.transform((value) => value.trim())
			.pipe(z.string().min(1))
			.optional(),
		credentialAction: z.enum(["keep", "replace", "clear"]).default("keep"),
		streamKey: z.string().max(4096).optional(),
	})
	.strict()
	.refine((input) => (input.id ? input.expectedRevision !== undefined : input.rtmpUrl !== undefined));

type Destination = typeof runnerDestinationsTable.$inferSelect;
export type RunnerDestinationView = ReturnType<typeof destinationView>;
export type RunnerDestinationInput = z.input<typeof destinationInput>;

function failure(code: Parameters<typeof resourceFailure>[0]) {
	const { error } = resourceFailure(code);
	return { success: false as const, error: error.message, code: error.code };
}

function destinationView(row: Destination) {
	return { id: row.id, name: row.name, provider: row.provider, host: new URL(row.rtmpUrl).host, runnerId: row.runnerId, credentialConfigured: Boolean(row.encryptedStreamKey), credentialActions: ["keep", "replace", "clear"] as const, credentialRevision: row.credentialRevision, configurationRevision: row.configurationRevision };
}

function normalizedRtmpUrl(value: string) {
	if (/[\u0000-\u001f\u007f]/.test(value)) return null;
	try {
		const url = new URL(value);
		if (!["rtmp:", "rtmps:"].includes(url.protocol) || !url.hostname || url.hash) return null;
		return url.toString();
	} catch {
		return null;
	}
}

async function audit(tx: TransactionClient, principal: TrustedCreatorPrincipal, resourceId: string, action: string) {
	await tx.insert(auditEventsTable).values({ actorUserId: principal.authUserId, ...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}), targetType: "runner_destination", targetId: resourceId, action, outcome: "success", correlationId: randomUUID(), occurredAt: new Date() });
}

async function resolveDestinationCredential(input: z.infer<typeof destinationInput>, current: Destination | undefined) {
	if (input.credentialAction !== "replace" && input.streamKey) return failure("INVALID_INPUT");
	const replacement = input.streamKey?.trim();
	if (input.credentialAction === "replace" && (!replacement || /[\u0000-\u001f\u007f]/.test(replacement))) return failure("INVALID_INPUT");
	const { encryptString, decryptString } = await import("@/app/lib/encryption");
	let encryptedStreamKey = current?.encryptedStreamKey ?? null;
	if (input.credentialAction === "replace") encryptedStreamKey = encryptString(replacement!);
	if (input.credentialAction === "clear") encryptedStreamKey = null;
	// Explicit clear retains editable metadata. Keeping an already empty key does not
	// authorize a Start or a new provider configuration without credentials.
	if (input.provider !== "custom" && !encryptedStreamKey && !(current && (input.credentialAction === "clear" || (input.credentialAction === "keep" && current.provider === input.provider)))) return failure("INVALID_INPUT");
	const credential = encryptedStreamKey ? decryptString(encryptedStreamKey) : null;
	if (encryptedStreamKey && credential === null) return failure("RESOURCE_UNAVAILABLE");
	return { encryptedStreamKey, credential };
}

/** No network connection is made here: private/local RTMP addresses belong to the user's Runner. */
export async function saveRunnerDestinationForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = destinationInput.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.ownerId, input.id ? "runner:update" : "runner:create", tx);
		let current: Destination | undefined;
		if (input.id) {
			[current] = await tx
				.select()
				.from(runnerDestinationsTable)
				.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), eq(runnerDestinationsTable.id, input.id)))
				.limit(1)
				.for("update");
			if (!current) return failure("RESOURCE_UNAVAILABLE");
			if (current.configurationRevision !== input.expectedRevision) return failure("CONFLICT");
		}
		const runnerId = input.runnerId === undefined ? (current?.runnerId ?? null) : input.runnerId;
		if (runnerId) {
			const [runner] = await tx
				.select({ id: runnersTable.id })
				.from(runnersTable)
				.where(and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, input.ownerId)))
				.limit(1);
			if (!runner) return failure("RESOURCE_UNAVAILABLE");
		}
		const rtmpUrl = normalizedRtmpUrl(input.rtmpUrl ?? current?.rtmpUrl ?? "");
		if (!rtmpUrl) return failure("INVALID_INPUT");
		const credentials = await resolveDestinationCredential(input, current);
		if ("success" in credentials) return credentials;
		const { encryptedStreamKey, credential } = credentials;
		const { decryptString } = await import("@/app/lib/encryption");
		const peers = await tx
			.select()
			.from(runnerDestinationsTable)
			.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), runnerId ? eq(runnerDestinationsTable.runnerId, runnerId) : isNull(runnerDestinationsTable.runnerId)))
			.orderBy(asc(runnerDestinationsTable.id));
		for (const peer of peers) {
			if (peer.id === current?.id) continue;
			if (peer.name.toLocaleLowerCase("en-US") === input.name.toLocaleLowerCase("en-US")) return failure("INVALID_INPUT");
			if (peer.provider === input.provider && normalizedRtmpUrl(peer.rtmpUrl) === rtmpUrl && (peer.encryptedStreamKey ? decryptString(peer.encryptedStreamKey) : null) === credential) return failure("INVALID_INPUT");
		}
		const values = { runnerId, name: input.name, provider: input.provider, rtmpUrl, encryptedStreamKey, updatedAt: new Date() };
		const [row] = current
			? await tx
					.update(runnerDestinationsTable)
					.set({ ...values, credentialRevision: current.credentialRevision + (input.credentialAction === "keep" ? 0 : 1), configurationRevision: current.configurationRevision + 1 })
					.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), eq(runnerDestinationsTable.id, current.id), eq(runnerDestinationsTable.configurationRevision, input.expectedRevision!)))
					.returning()
			: await tx
					.insert(runnerDestinationsTable)
					.values({ ...values, ownerId: input.ownerId })
					.returning();
		if (!row) return failure("CONFLICT");
		await audit(tx, principal, row.id, current ? "runner.destination.update" : "runner.destination.create");
		authority.assertAuthorityCurrent();
		return { success: true as const, destination: destinationView(row) };
	});
}

export async function listRunnerDestinationsForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = z.object({ ownerId, runnerId: uuid.optional() }).strict().safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.ownerId, "runner:read", tx);
		if (input.runnerId) {
			const [runner] = await tx
				.select({ id: runnersTable.id })
				.from(runnersTable)
				.where(and(eq(runnersTable.id, input.runnerId), eq(runnersTable.ownerId, input.ownerId)))
				.limit(1);
			if (!runner) return failure("RESOURCE_UNAVAILABLE");
		}
		const rows = await tx
			.select()
			.from(runnerDestinationsTable)
			.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), input.runnerId ? or(eq(runnerDestinationsTable.runnerId, input.runnerId), isNull(runnerDestinationsTable.runnerId)) : undefined))
			.orderBy(asc(runnerDestinationsTable.createdAt), asc(runnerDestinationsTable.id));
		authority.assertAuthorityCurrent();
		return { success: true as const, destinations: rows.map(destinationView) };
	});
}

/** Called inside the existing owner-locked Start transaction before any admission is reserved. */
export async function selectedDestinationsHaveCredentials(tx: TransactionClient, owner: string, sessionId: string) {
	const selected = await tx
		.select({ provider: runnerDestinationsTable.provider, encryptedStreamKey: runnerDestinationsTable.encryptedStreamKey })
		.from(streamSessionDestinationsTable)
		.innerJoin(runnerDestinationsTable, and(eq(runnerDestinationsTable.id, streamSessionDestinationsTable.destinationId), eq(runnerDestinationsTable.ownerId, owner)))
		.where(and(eq(streamSessionDestinationsTable.ownerId, owner), eq(streamSessionDestinationsTable.sessionId, sessionId)));
	return selected.every((target) => target.provider === "custom" || Boolean(target.encryptedStreamKey));
}

export async function deleteRunnerDestinationForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = z.object({ ownerId, id: uuid, expectedRevision: revision }).strict().safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.ownerId, "runner:delete", tx);
		const [row] = await tx
			.select()
			.from(runnerDestinationsTable)
			.where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), eq(runnerDestinationsTable.id, input.id)))
			.limit(1)
			.for("update");
		if (!row) return failure("RESOURCE_UNAVAILABLE");
		if (row.configurationRevision !== input.expectedRevision) return failure("CONFLICT");
		const references = await tx
			.select({ sessionId: streamSessionDestinationsTable.sessionId })
			.from(streamSessionDestinationsTable)
			.where(and(eq(streamSessionDestinationsTable.ownerId, input.ownerId), eq(streamSessionDestinationsTable.destinationId, input.id)))
			.orderBy(asc(streamSessionDestinationsTable.sessionId));
		authority.assertAuthorityCurrent();
		const schedules = await tx
			.select({ eventId: runnerScheduleEventDestinationsTable.eventId })
			.from(runnerScheduleEventDestinationsTable)
			.where(and(eq(runnerScheduleEventDestinationsTable.ownerId, input.ownerId), eq(runnerScheduleEventDestinationsTable.destinationId, input.id)))
			.orderBy(asc(runnerScheduleEventDestinationsTable.eventId));
		if (references.length || schedules.length) return { ...failure("RESOURCE_IN_USE"), references: { sessions: references.map((reference) => reference.sessionId), schedules: schedules.map((reference) => reference.eventId) } };
		await tx.delete(runnerDestinationsTable).where(and(eq(runnerDestinationsTable.ownerId, input.ownerId), eq(runnerDestinationsTable.id, input.id)));
		await audit(tx, principal, row.id, "runner.destination.delete");
		authority.assertAuthorityCurrent();
		return { success: true as const };
	});
}

/** Caller holds the creator policy lock and commits the scalar edit and conversion together. */
export async function normalizeLegacySessionDestination(tx: TransactionClient, creatorId: string, sessionId: string, mutation: { credentialAction?: "keep" | "replace" | "clear"; replaceRtmpUrl?: boolean; clearCredentialOnUrlChange?: boolean } = {}) {
	const { decryptString } = await import("@/app/lib/encryption");
	const [session] = await tx
		.select()
		.from(streamSessionsTable)
		.where(and(eq(streamSessionsTable.id, sessionId), eq(streamSessionsTable.ownerId, creatorId)))
		.limit(1);
	if (!session) throw new Error("RESOURCE_UNAVAILABLE");
	const selected = await tx
		.select()
		.from(streamSessionDestinationsTable)
		.where(and(eq(streamSessionDestinationsTable.sessionId, sessionId), eq(streamSessionDestinationsTable.ownerId, creatorId)));
	if (selected.length > 1) throw new Error("CONFLICT");
	// Once selected, the named record is authoritative. Older callers can change it
	// only through explicit credential/endpoint intent, never through a stale shadow.
	async function synchronizeShadow(rtmpUrl: string, encryptedStreamKey: string | null) {
		if (session.rtmpUrl !== rtmpUrl || session.encryptedStreamKey !== encryptedStreamKey) {
			await tx
				.update(streamSessionsTable)
				.set({ rtmpUrl, encryptedStreamKey })
				.where(and(eq(streamSessionsTable.id, sessionId), eq(streamSessionsTable.ownerId, creatorId)));
		}
		return { rtmpUrl, encryptedStreamKey };
	}
	if (selected.length === 1) {
		const [current] = await tx
			.select()
			.from(runnerDestinationsTable)
			.where(and(eq(runnerDestinationsTable.id, selected[0].destinationId), eq(runnerDestinationsTable.ownerId, creatorId)))
			.limit(1);
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		const url = normalizedRtmpUrl(mutation.replaceRtmpUrl ? session.rtmpUrl : current.rtmpUrl);
		if (!url) throw new Error("INVALID_INPUT");
		const host = new URL(url).hostname;
		const provider = mutation.replaceRtmpUrl ? (host === "live.twitch.tv" ? "twitch" : host === "a.rtmp.youtube.com" ? "youtube" : "custom") : current.provider;
		let encryptedStreamKey = mutation.credentialAction === "replace" ? session.encryptedStreamKey : mutation.credentialAction === "clear" ? null : current.encryptedStreamKey;
		if (mutation.clearCredentialOnUrlChange && url !== current.rtmpUrl) encryptedStreamKey = null;
		const keyChanged = decryptString(current.encryptedStreamKey ?? "") !== decryptString(encryptedStreamKey ?? "");
		if (keyChanged || current.rtmpUrl !== url || current.provider !== provider) {
			const references = await tx
				.select({ sessionId: streamSessionDestinationsTable.sessionId })
				.from(streamSessionDestinationsTable)
				.where(and(eq(streamSessionDestinationsTable.destinationId, current.id), eq(streamSessionDestinationsTable.ownerId, creatorId)));
			// Transaction-only rollback signal; public boundaries return a safe conflict.
			if (references.some((reference) => reference.sessionId !== sessionId)) throw new Error("CONFLICT");
			await tx
				.update(runnerDestinationsTable)
				.set({ provider, rtmpUrl: url, encryptedStreamKey, credentialRevision: current.credentialRevision + (keyChanged ? 1 : 0), configurationRevision: current.configurationRevision + 1, updatedAt: new Date() })
				.where(and(eq(runnerDestinationsTable.id, current.id), eq(runnerDestinationsTable.ownerId, creatorId)));
		}
		return synchronizeShadow(url, encryptedStreamKey);
	}
	const url = normalizedRtmpUrl(session.rtmpUrl);
	if (!url) throw new Error("INVALID_INPUT");
	const host = new URL(url).hostname;
	const provider = host === "live.twitch.tv" ? "twitch" : host === "a.rtmp.youtube.com" ? "youtube" : "custom";
	const name = provider === "twitch" ? "Twitch" : provider === "youtube" ? "YouTube" : "Custom RTMP";
	const peers = await tx
		.select()
		.from(runnerDestinationsTable)
		.where(and(eq(runnerDestinationsTable.ownerId, creatorId), session.runnerId ? or(eq(runnerDestinationsTable.runnerId, session.runnerId), isNull(runnerDestinationsTable.runnerId)) : isNull(runnerDestinationsTable.runnerId)))
		.orderBy(asc(runnerDestinationsTable.id));
	const existing = peers.find((row) => row.provider === provider && normalizedRtmpUrl(row.rtmpUrl) === url && decryptString(row.encryptedStreamKey ?? "") === decryptString(session.encryptedStreamKey ?? ""));
	let destinationId = existing?.id;
	if (!destinationId) {
		let uniqueName = name;
		for (let suffix = 2; peers.some((row) => row.name.toLowerCase() === uniqueName.toLowerCase()); suffix++) uniqueName = `${name} ${suffix}`;
		const [created] = await tx.insert(runnerDestinationsTable).values({ ownerId: creatorId, runnerId: session.runnerId, name: uniqueName, provider, rtmpUrl: url, encryptedStreamKey: session.encryptedStreamKey }).returning({ id: runnerDestinationsTable.id });
		destinationId = created.id;
	}
	await tx.insert(streamSessionDestinationsTable).values({ ownerId: creatorId, sessionId, destinationId, position: 0 });
	return synchronizeShadow(url, existing?.encryptedStreamKey ?? session.encryptedStreamKey);
}

/** Caller owns the creator lock. Validate the complete selection before any write. */
export async function resolveRunnerDestinationSelection(tx: TransactionClient, owner: string, runnerId: string, ids: readonly string[], runnerPro: boolean) {
	if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !uuid.safeParse(id).success)) return resourceFailure("INVALID_INPUT");
	if (!runnerPro && ids.length > 1) return resourceFailure("RUNNER_TARGET_LIMIT");
	const rows = await tx
		.select()
		.from(runnerDestinationsTable)
		.where(and(eq(runnerDestinationsTable.ownerId, owner), inArray(runnerDestinationsTable.id, [...ids])))
		.orderBy(asc(runnerDestinationsTable.id))
		.for("share");
	if (rows.length !== ids.length || rows.some((row) => row.runnerId !== null && row.runnerId !== runnerId)) return resourceFailure("RESOURCE_UNAVAILABLE");
	return ids.map((id) => rows.find((row) => row.id === id)!);
}

export async function replaceSessionDestinationSelection(tx: TransactionClient, owner: string, sessionId: string, targets: readonly Destination[]) {
	await tx.delete(streamSessionDestinationsTable).where(and(eq(streamSessionDestinationsTable.ownerId, owner), eq(streamSessionDestinationsTable.sessionId, sessionId)));
	await tx.insert(streamSessionDestinationsTable).values(targets.map((target, position) => ({ ownerId: owner, sessionId, destinationId: target.id, position })));
}

/** Secrets remain server-private and are encrypted as one immutable admission snapshot. */
export async function captureSessionDestinations(tx: TransactionClient, session: typeof streamSessionsTable.$inferSelect, runnerPro: boolean, scheduleEventId?: string) {
	const { encryptString, decryptString } = await import("@/app/lib/encryption");
	const selected = scheduleEventId
		? await tx
				.select({ target: runnerDestinationsTable })
				.from(runnerScheduleEventDestinationsTable)
				.innerJoin(runnerDestinationsTable, and(eq(runnerDestinationsTable.id, runnerScheduleEventDestinationsTable.destinationId), eq(runnerDestinationsTable.ownerId, runnerScheduleEventDestinationsTable.ownerId)))
				.where(and(eq(runnerScheduleEventDestinationsTable.ownerId, session.ownerId), eq(runnerScheduleEventDestinationsTable.eventId, scheduleEventId)))
				.orderBy(asc(runnerScheduleEventDestinationsTable.position))
		: await tx
				.select({ target: runnerDestinationsTable })
				.from(streamSessionDestinationsTable)
				.innerJoin(runnerDestinationsTable, and(eq(runnerDestinationsTable.id, streamSessionDestinationsTable.destinationId), eq(runnerDestinationsTable.ownerId, streamSessionDestinationsTable.ownerId)))
				.where(and(eq(streamSessionDestinationsTable.ownerId, session.ownerId), eq(streamSessionDestinationsTable.sessionId, session.id)))
				.orderBy(asc(streamSessionDestinationsTable.position));
	if (scheduleEventId && !selected.length) return resourceFailure("INVALID_INPUT");
	if (!runnerPro && selected.length > 1) return resourceFailure("RUNNER_TARGET_LIMIT");
	const targets = selected.length ? selected.map(({ target }) => target) : [{ id: session.id, name: "Legacy destination", provider: "custom" as const, runnerId: session.runnerId, rtmpUrl: session.rtmpUrl, encryptedStreamKey: session.encryptedStreamKey, configurationRevision: session.configurationRevision, credentialRevision: 1 }];
	const destinations = [];
	for (const target of targets) {
		if (target.runnerId !== null && target.runnerId !== session.runnerId) return resourceFailure("RESOURCE_UNAVAILABLE");
		const streamKey = target.encryptedStreamKey ? decryptString(target.encryptedStreamKey) : null;
		if ((target.encryptedStreamKey && !streamKey) || (target.provider !== "custom" && !streamKey)) return resourceFailure("INVALID_INPUT");
		destinations.push({ id: target.id, name: target.name, provider: target.provider, rtmpUrl: target.rtmpUrl, streamKey, configurationRevision: target.configurationRevision, credentialRevision: target.credentialRevision });
	}
	return { targetIdsSnapshot: destinations.map((target) => target.id), encryptedTargetsSnapshot: encryptString(JSON.stringify({ version: 1, destinations })) };
}
