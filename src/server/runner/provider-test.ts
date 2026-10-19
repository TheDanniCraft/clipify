import "server-only";
import { and, asc, eq, isNotNull, isNull, lte, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient } from "@/db/client";
import { runnersTable as runners, streamSessionsTable as sessions, runnerBroadcastAdmissionsTable as admissions, overlaysTable as overlays } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { reserveBroadcastAdmission, requestBroadcastDrain, cancelReservedAdmission, isExpiredUndispatchedConnectionTest } from "./admission";
import { resolveRunnerBenefits } from "./capabilities";
import { withStreamingConnection } from "./provider-connections";
import { fetchStreamingKey, ProviderRequestError } from "./provider-api";
import { encryptString } from "@/app/lib/encryption";
import { isResourceFailure } from "@/server/resources/errors";
import { StreamMode, StreamState, StatusOptions } from "@types";
const identity = z.object({ ownerId: z.string().min(1).max(255), runnerId: z.uuid(), connectionId: z.uuid(), durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(120)]) }).strict();
const fail = (error: string) => ({ success: false as const, error, code: "INVALID_INPUT" as const });
export async function startTwitchConnectionTest(principal: TrustedCreatorPrincipal, raw: unknown, client: DatabaseClient = db) {
	const parsed = identity.safeParse(raw);
	if (!parsed.success) return fail("Choose a test duration.");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.ownerId, "runner:update", tx);
		const now = Date.now(),
			expiresAt = new Date(now + input.durationSeconds * 1000);
		const [runner] = await tx
			.select()
			.from(runners)
			.where(and(eq(runners.ownerId, input.ownerId), eq(runners.id, input.runnerId)))
			.limit(1)
			.for("update");
		if (!runner || runner.status !== "online" || !runner.lastHeartbeatAt || now - runner.lastHeartbeatAt.getTime() > 30000 || runner.protocolVersion !== 2) return fail("Connect your Runner before starting a test.");
		const open = await tx
			.select()
			.from(admissions)
			.where(and(eq(admissions.ownerId, input.ownerId), notInArray(admissions.state, ["stopped", "failed_before_output"])));
		if (open.some((row) => !isExpiredUndispatchedConnectionTest(row, now) && (row.state !== "authorized" || typeof row.benefitsAtStart.scheduledStart !== "number" || row.benefitsAtStart.scheduledStart <= expiresAt.getTime()))) return fail("Stop your broadcasts before testing this connection.");
		const [source] = await tx
			.select({ overlayId: sessions.overlayId })
			.from(sessions)
			.where(and(eq(sessions.ownerId, input.ownerId), eq(sessions.runnerId, input.runnerId), isNull(sessions.testExpiresAt)))
			.orderBy(asc(sessions.id))
			.limit(1);
		const [overlay] = source
			? await tx
					.select()
					.from(overlays)
					.where(and(eq(overlays.ownerId, input.ownerId), eq(overlays.id, source.overlayId), eq(overlays.status, StatusOptions.Active)))
					.limit(1)
			: [];
		if (!overlay) return fail("Save a target overlay on this Runner before testing.");
		const connection = await withStreamingConnection(tx, input.ownerId, input.connectionId, async (context) => {
			if (context.provider !== "twitch") throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
			return fetchStreamingKey(context);
		});
		// Only Twitch-owned keys enter this private output. Never persist a reusable public test destination.
		if (!connection.success) return connection;
		const testKey = connection.value.split("?")[0] + "?bandwidthtest=true";
		const [session] = await tx
			.insert(sessions)
			.values({ ownerId: input.ownerId, runnerId: runner.id, overlayId: overlay.id, mode: StreamMode.AlwaysOn, controlMode: "manual", testExpiresAt: expiresAt, rtmpUrl: "rtmp://live.twitch.tv/app", encryptedStreamKey: encryptString(testKey), desiredState: StreamState.Stopped })
			.returning();
		const benefits = await resolveRunnerBenefits(authority.creator, tx);
		const admission = await reserveBroadcastAdmission(tx, session, benefits, session.configurationRevision);
		if (isResourceFailure(admission)) {
			await tx.delete(sessions).where(eq(sessions.id, session.id));
			return { success: false as const, error: admission.error.message, code: admission.error.code };
		}
		await tx
			.update(admissions)
			.set({ scheduledEnd: expiresAt, benefitsAtStart: { ...admission.benefitsAtStart, runnerPro: false, testConnectionId: input.connectionId, sourceIdAtStart: overlay.id, sourceRevisionAtStart: overlay.configurationRevision } })
			.where(eq(admissions.id, admission.id));
		await tx.update(sessions).set({ desiredState: StreamState.Running }).where(eq(sessions.id, session.id));
		authority.assertAuthorityCurrent();
		return { success: true as const, test: { id: session.id, expiresAt: expiresAt.toISOString() } };
	});
}
export async function readTwitchConnectionTest(principal: TrustedCreatorPrincipal, raw: unknown, stop = false, client: DatabaseClient = db) {
	const parsed = z
		.object({ ownerId: z.string().min(1).max(255), id: z.uuid() })
		.strict()
		.safeParse(raw);
	if (!parsed.success) return fail("Choose a connection test.");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.ownerId, stop ? "runner:update" : "runner:read", tx);
		const [session] = await tx
			.select()
			.from(sessions)
			.where(and(eq(sessions.ownerId, input.ownerId), eq(sessions.id, input.id), isNotNull(sessions.testExpiresAt)))
			.limit(1)
			.for("update");
		if (!session) return fail("This connection test is no longer available.");
		if (stop || (session.desiredState === StreamState.Running && session.testExpiresAt!.getTime() <= Date.now())) {
			const cancelled = await cancelReservedAdmission(tx, session);
			if (!cancelled) await requestBroadcastDrain(tx, session, "immediate");
			await tx
				.update(sessions)
				.set({ desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + 1, updatedAt: new Date() })
				.where(eq(sessions.id, session.id));
		}
		const rows = await tx
			.select({ state: admissions.state, outputs: admissions.outputStates })
			.from(admissions)
			.where(and(eq(admissions.ownerId, input.ownerId), eq(admissions.sessionId, session.id)));
		authority.assertAuthorityCurrent();
		return { success: true as const, test: { id: session.id, expiresAt: session.testExpiresAt!.toISOString(), state: rows.some((row) => row.state === "active") ? "running" : rows.some((row) => ["reserved", "starting"].includes(row.state)) ? "starting" : rows.some((row) => ["draining", "uncertain"].includes(row.state)) ? "stopping" : "stopped", outputs: rows.flatMap((row) => row.outputs) } };
	});
}
export async function expireRunnerConnectionTests(runnerId: string, client: DatabaseClient = db) {
	const expired = await client
		.select()
		.from(sessions)
		.where(and(eq(sessions.runnerId, runnerId), lte(sessions.testExpiresAt, new Date()), eq(sessions.desiredState, StreamState.Running)));
	for (const session of expired)
		await client.transaction(async (tx) => {
			const cancelled = await cancelReservedAdmission(tx, session);
			if (!cancelled) await requestBroadcastDrain(tx, session, "immediate");
			await tx
				.update(sessions)
				.set({ desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + 1, updatedAt: new Date() })
				.where(and(eq(sessions.id, session.id), eq(sessions.desiredState, StreamState.Running)));
		});
}
