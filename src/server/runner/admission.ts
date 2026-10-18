import "server-only";
import { StreamState } from "@types";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, notInArray, inArray, isNull, asc, or, ne, sql } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";
import { runnerBroadcastAdmissionsTable, usersTable, streamSessionsTable, runnersTable } from "@/db/schema";
import { deriveRunnerCapabilities, type RunnerBenefitInput } from "./capabilities";
import { captureSessionDestinations } from "./destinations";
import { LegacyBroadcastRecoveryRequired, isResourceFailure, resourceFailure } from "@/server/resources/errors";

/** Only this typed reconciliation rejection may commit housekeeping without a Start audit.
 * It is raised before the requested configuration or reservation is changed.
 */
export { LegacyBroadcastRecoveryRequired } from "@/server/resources/errors";

/** Existing pre-admission output is never retrospectively assigned a lease. */
export async function recognizeLegacyBroadcasts(tx: TransactionClient, ownerId: string) {
	await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, ownerId)).limit(1).for("update");
	const sessions = await tx
		.select()
		.from(streamSessionsTable)
		.where(and(eq(streamSessionsTable.ownerId, ownerId), or(eq(streamSessionsTable.desiredState, StreamState.Running), ne(streamSessionsTable.actualState, StreamState.Stopped))))
		.orderBy(asc(streamSessionsTable.id))
		.for("update");
	const existing = await tx
		.select({ sessionId: runnerBroadcastAdmissionsTable.sessionId })
		.from(runnerBroadcastAdmissionsTable)
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, ownerId), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
		.orderBy(asc(runnerBroadcastAdmissionsTable.id))
		.for("update");
	let recognized = 0;
	for (const session of sessions) {
		if (existing.some((admission) => admission.sessionId === session.id)) continue;
		await tx.insert(runnerBroadcastAdmissionsTable).values({ ownerId, runnerId: session.runnerId, sessionId: session.id, executionGeneration: randomUUID(), state: "uncertain", configurationRevision: session.configurationRevision, benefitsAtStart: { ...deriveRunnerCapabilities({ proAccess: false, runnerAccess: true, runnerSource: "legacy" }), provenance: "pre_admission_protocol", ingestModeAtStart: session.mode } });
		recognized++;
	}
	return recognized;
}

type Admission = typeof runnerBroadcastAdmissionsTable.$inferSelect;
async function recoverExpiredAdmissions(tx: TransactionClient, ownerId: string, occupied: Admission[], recoveryNow: number) {
	// Supported Free leases and explicitly bounded cached Scheduled authority prove a stop.
	// The owner lock also serializes renewal; heartbeat age is deliberately irrelevant.
	const recoveryTime = new Date(recoveryNow);
	const recovered = new Set<string>();
	for (const admission of occupied) {
		const cachedScheduled = admission.benefitsAtStart.cacheAuthorization === true && admission.benefitsAtStart.runnerPro === true && admission.scheduledEnd !== null;
		if ((admission.benefitsAtStart.runnerPro !== false && !cachedScheduled) || !admission.protocolSupportsLease || !admission.leaseId || !admission.leaseExpiresAt || !admission.dispatchedAt) continue;
		const deadline = cachedScheduled ? Math.max(admission.leaseExpiresAt.getTime(), admission.scheduledEnd!.getTime()) : admission.leaseExpiresAt.getTime();
		if (deadline + 305000 > recoveryNow) continue;
		await tx
			.update(runnerBroadcastAdmissionsTable)
			.set({ state: "stopped", stoppedAt: recoveryTime, recoveredAt: recoveryTime, terminalReason: "lease_recovered" })
			.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, ownerId)));
		if (admission.sessionId) {
			const [otherOutput] = await tx
				.select({ id: runnerBroadcastAdmissionsTable.id })
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, admission.sessionId), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
				.limit(1)
				.for("update");
			if (!otherOutput)
				await tx
					.update(streamSessionsTable)
					.set({ desiredState: StreamState.Stopped, actualState: StreamState.Stopped })
					.where(and(eq(streamSessionsTable.id, admission.sessionId), eq(streamSessionsTable.ownerId, ownerId)));
		}
		recovered.add(admission.id);
	}
	return occupied.filter((admission) => !recovered.has(admission.id));
}

/** Every admission is committed under the resource owner's lock, never device health. */
export async function reserveBroadcastAdmission(tx: TransactionClient, session: typeof streamSessionsTable.$inferSelect, benefits: RunnerBenefitInput, configurationRevision: number, scheduleEventId?: string, clock: () => number = Date.now) {
	await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, session.ownerId)).limit(1).for("update");
	const recognizedLegacy = await recognizeLegacyBroadcasts(tx, session.ownerId);
	const capabilities = deriveRunnerCapabilities(benefits);
	let occupied = await tx
		.select()
		.from(runnerBroadcastAdmissionsTable)
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, session.ownerId), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
		.orderBy(asc(runnerBroadcastAdmissionsTable.id))
		.for("update");
	const recoveryNow = clock();
	occupied = await recoverExpiredAdmissions(tx, session.ownerId, occupied, recoveryNow);
	const unknownCachedOutput = occupied.some((admission) => admission.sessionId === session.id && admission.state === "authorized" && admission.benefitsAtStart.cacheAuthorization === true && typeof admission.benefitsAtStart.scheduledStart === "number" && admission.benefitsAtStart.scheduledStart <= recoveryNow);
	if (unknownCachedOutput) return resourceFailure("RUNNER_RECOVERY_REQUIRED");
	const existing = occupied.find((admission) => admission.sessionId === session.id && admission.state !== "authorized");
	if (existing) {
		if (existing.state === "draining" || existing.state === "uncertain") {
			if (recognizedLegacy > 0) throw new LegacyBroadcastRecoveryRequired();
			throw new Error("RUNNER_RECOVERY_REQUIRED");
		}
		return existing;
	}
	if (capabilities.maxActiveBroadcasts !== null && occupied.length >= capabilities.maxActiveBroadcasts) {
		const deviceIds = occupied.flatMap((admission) => (admission.runnerId ? [admission.runnerId] : []));
		const devices = await tx
			.select({ id: runnersTable.id, status: runnersTable.status, lastHeartbeatAt: runnersTable.lastHeartbeatAt })
			.from(runnersTable)
			.where(and(eq(runnersTable.ownerId, session.ownerId), inArray(runnersTable.id, deviceIds)))
			.orderBy(asc(runnersTable.id))
			.for("share");
		const now = Date.now();
		const needsRecovery = occupied.some((admission) => {
			const device = devices.find((device) => device.id === admission.runnerId);
			return admission.state === "uncertain" || admission.state === "draining" || !device || device.status !== "online" || !device.lastHeartbeatAt || now - device.lastHeartbeatAt.getTime() > 30000;
		});
		if (recognizedLegacy > 0) throw new LegacyBroadcastRecoveryRequired();
		throw new Error(needsRecovery ? "RUNNER_RECOVERY_REQUIRED" : "RUNNER_CONCURRENCY_LIMIT");
	}
	// Captured mode survives later configuration edits; neither health nor a drain
	// request proves that the installation's fixed-port live input has closed.
	if (session.mode === "failsafe" && session.runnerId && occupied.some((admission) => admission.runnerId === session.runnerId && admission.benefitsAtStart.ingestModeAtStart !== "24/7")) return resourceFailure("RUNNER_INGEST_IN_USE");
	const targets = await captureSessionDestinations(tx, session, capabilities.runnerPro, scheduleEventId);
	if (isResourceFailure(targets)) return targets;
	const [admission] = await tx
		.insert(runnerBroadcastAdmissionsTable)
		.values({ ownerId: session.ownerId, runnerId: session.runnerId, sessionId: session.id, executionGeneration: randomUUID(), state: "reserved", configurationRevision, ...targets, benefitsAtStart: { ...capabilities, ingestModeAtStart: session.mode } })
		.returning();
	return admission;
}

/** Safe only before dispatch has been committed; device health is never closure evidence. */
export async function cancelReservedAdmission(tx: TransactionClient, session: typeof streamSessionsTable.$inferSelect) {
	await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, session.ownerId)).limit(1).for("update");
	await recognizeLegacyBroadcasts(tx, session.ownerId);
	const [cancelled] = await tx
		.update(runnerBroadcastAdmissionsTable)
		.set({ state: "failed_before_output", stoppedAt: new Date(), terminalReason: "cancelled_before_dispatch" })
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, session.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), eq(runnerBroadcastAdmissionsTable.state, "reserved"), isNull(runnerBroadcastAdmissionsTable.dispatchedAt)))
		.returning();
	return cancelled;
}

/** A stop request is not output-closed evidence for an already dispatched attempt. */
export async function requestBroadcastDrain(tx: TransactionClient, session: typeof streamSessionsTable.$inferSelect, stopMode: "graceful" | "immediate" = "graceful") {
	await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, session.ownerId)).limit(1).for("update");
	const [draining] = await tx
		.update(runnerBroadcastAdmissionsTable)
		.set({ state: "draining", commandId: randomUUID(), stopMode: sql`case when ${runnerBroadcastAdmissionsTable.stopMode} = 'immediate' then 'immediate' else ${stopMode} end` })
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, session.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), notInArray(runnerBroadcastAdmissionsTable.state, ["authorized", "stopped", "failed_before_output"])))
		.returning();
	return draining;
}

/** Revoked bearer hashes authorize only matching terminal reconciliation, never jobs. */
export async function revokeDeviceAdmissions(tx: TransactionClient, runner: Pick<typeof runnersTable.$inferSelect, "id" | "ownerId" | "token">) {
	await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, runner.ownerId)).limit(1).for("update");
	await recognizeLegacyBroadcasts(tx, runner.ownerId);
	const pending = await tx
		.select()
		.from(runnerBroadcastAdmissionsTable)
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.runnerId, runner.id), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
		.orderBy(asc(runnerBroadcastAdmissionsTable.id))
		.for("update");
	const now = new Date(),
		hash = createHash("sha256").update(runner.token).digest("hex");
	for (const admission of pending) {
		const neverDispatched = admission.state === "reserved" && admission.dispatchedAt === null;
		await tx
			.update(runnerBroadcastAdmissionsTable)
			.set({ state: neverDispatched ? "failed_before_output" : admission.state === "authorized" ? "authorized" : "draining", stoppedAt: neverDispatched ? now : admission.stoppedAt, terminalReason: neverDispatched ? "revoked_before_dispatch" : admission.terminalReason, revokedAt: admission.revokedAt ?? now, terminalCredentialHash: admission.terminalCredentialHash ?? hash })
			.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId)));
	}
}

/** Output commands must retain the installation/source binding until closure. */
export async function broadcastAssignmentIsLocked(tx: TransactionClient, ownerId: string, sessionId: string) {
	const [active] = await tx
		.select({ id: runnerBroadcastAdmissionsTable.id })
		.from(runnerBroadcastAdmissionsTable)
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, sessionId), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
		.limit(1)
		.for("update");
	return Boolean(active);
}
