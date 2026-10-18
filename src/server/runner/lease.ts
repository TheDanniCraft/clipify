import { PLAYBACK_TIMEOUT_MESSAGE } from "../../../packages/runner/src/presentation";
import "server-only";
import { randomUUID, sign } from "node:crypto";
import { runnerSigningKey as signingKey } from "./signing";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type DatabaseClient, type QueryClient } from "@/db/client";
import { runnersTable, streamSessionsTable, runnerBroadcastAdmissionsTable, overlaysTable, usersTable } from "@/db/schema";
import { StreamState } from "@types";
import { hashExecutionTargets } from "../../../packages/runner/src/protocol";
import { requestBroadcastDrain } from "./admission";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "./capabilities";

export async function issueRunnerBenefitSnapshot(runner: Pick<typeof runnersTable.$inferSelect, "id" | "ownerId" | "token">, requestId: string, client: DatabaseClient = db) {
	if (!process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY) return null;
	return client.transaction(async (tx) => {
		const [owner] = await tx.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, runner.ownerId)).limit(1).for("update");
		if (!owner) return null;
		const [device] = await tx
			.select({ token: runnersTable.token, configurationRevision: runnersTable.configurationRevision })
			.from(runnersTable)
			.where(and(eq(runnersTable.id, runner.id), eq(runnersTable.ownerId, owner.id)))
			.limit(1)
			.for("update");
		if (!device || device.token !== runner.token) return null;
		const now = Date.now();
		const capabilities = deriveRunnerCapabilities(await resolveRunnerBenefits(owner, tx, new Date(now)), new Date(now));
		const expiresAt = capabilities.runnerPro && capabilities.validUntil ? Math.min(now + 604800000, Date.parse(capabilities.validUntil)) : now + 604800000;
		const claims = { issuer: "clipify.us", kind: "benefits", ownerId: owner.id, runnerId: runner.id, requestId, configurationRevision: device.configurationRevision, issuedAt: now, expiresAt, capabilities };
		const { key, keyId } = signingKey();
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		return { keyId, payload, signature: sign(null, Buffer.from(payload), key).toString("base64url") };
	});
}

/** A returned permit is usable only after the owner-locked transaction commits.
 * Current device credentials are rechecked inside that lock, before any signing.
 */
export async function issueFreeExecutionLease(runner: Pick<typeof runnersTable.$inferSelect, "id" | "ownerId" | "token">, sessionId: string, requestId: string, client: DatabaseClient = db) {
	return client.transaction(async (tx) => {
		const [owner] = await tx.select({ id: usersTable.id, plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, runner.ownerId)).limit(1).for("update");
		if (!owner) return null;
		const [device] = await tx
			.select()
			.from(runnersTable)
			.where(and(eq(runnersTable.id, runner.id), eq(runnersTable.ownerId, runner.ownerId)))
			.limit(1)
			.for("update");
		if (!device || device.token !== runner.token) return null;
		const [session] = await tx
			.select()
			.from(streamSessionsTable)
			.where(and(eq(streamSessionsTable.id, sessionId), eq(streamSessionsTable.ownerId, runner.ownerId), eq(streamSessionsTable.runnerId, runner.id)))
			.limit(1)
			.for("update");
		if (!session || session.desiredState !== StreamState.Running) return null;
		const [admission] = await tx
			.select()
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.runnerId, runner.id), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active"])))
			.orderBy(desc(runnerBroadcastAdmissionsTable.scheduledEnd))
			.limit(1)
			.for("update");
		if (!admission || admission.revokedAt) return null;
		const paid = admission.benefitsAtStart.runnerPro === true;
		const now = Date.now();
		const knownPaidEnd = typeof admission.benefitsAtStart.validUntil === "string" ? Date.parse(admission.benefitsAtStart.validUntil) : null;
		if (paid && knownPaidEnd !== null && !Number.isFinite(knownPaidEnd)) return null;
		const acceptedPaid = paid && admission.state === "active" && admission.startedAt !== null;
		const currentPaidPolicy = paid && !acceptedPaid ? deriveRunnerCapabilities(await resolveRunnerBenefits(owner, tx, new Date(now)), new Date(now)) : null;
		if (currentPaidPolicy && !currentPaidPolicy.runnerPro) {
			if (!admission.dispatchedAt && admission.state === "reserved") {
				await tx
					.update(runnerBroadcastAdmissionsTable)
					.set({ state: "failed_before_output", stoppedAt: new Date(now), terminalReason: "benefits_revoked_before_dispatch" })
					.where(eq(runnerBroadcastAdmissionsTable.id, admission.id));
				await tx
					.update(streamSessionsTable)
					.set({ desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + 1, updatedAt: new Date(now) })
					.where(eq(streamSessionsTable.id, session.id));
				return null;
			}
			// A dispatched permit may already have opened output. Preserve its
			// identity for a late receipt without issuing another paid Start.
			return { lease: undefined, destinations: undefined, scheduledEnd: undefined, targetHash: undefined, sourceRevision: undefined, permissionPending: true as const, admissionId: admission.id, executionGeneration: admission.executionGeneration, ownerId: runner.ownerId, runnerId: runner.id, configurationRevision: admission.configurationRevision };
		}
		// Cached automatic starts retain their separate signed purpose. Reissuing
		// an ordinary execution command here would falsely become an owner Resume.
		if (paid && admission.benefitsAtStart.cacheAuthorization === true && admission.state === "active") {
			return { lease: undefined, permissionPending: true as const, admissionId: admission.id, executionGeneration: admission.executionGeneration, ownerId: runner.ownerId, runnerId: runner.id, configurationRevision: admission.configurationRevision };
		}
		if (paid && admission.scheduledEnd && admission.scheduledEnd.getTime() <= now) {
			await requestBroadcastDrain(tx, session);
			await tx
				.update(streamSessionsTable)
				.set({ desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + 1, updatedAt: new Date(now) })
				.where(and(eq(streamSessionsTable.id, session.id), eq(streamSessionsTable.ownerId, runner.ownerId)));
			return null;
		}
		if (!paid && admission.leaseExpiresAt && admission.leaseExpiresAt.getTime() <= now) {
			await tx.update(runnerBroadcastAdmissionsTable).set({ state: "draining" }).where(eq(runnerBroadcastAdmissionsTable.id, admission.id));
			return null;
		}
		const capturedSource = admission.benefitsAtStart.sourceIdAtStart;
		const capturedRevision = admission.benefitsAtStart.sourceRevisionAtStart;
		if (capturedSource !== undefined && (typeof capturedSource !== "string" || !Number.isSafeInteger(capturedRevision) || Number(capturedRevision) < 1)) return null;
		const sourceId = typeof capturedSource === "string" ? capturedSource : session.overlayId;
		const [overlay] = await tx
			.select()
			.from(overlaysTable)
			.where(and(eq(overlaysTable.id, sourceId), eq(overlaysTable.ownerId, runner.ownerId)))
			.limit(1)
			.for("share");
		if (!overlay || overlay.status !== "active") return null;
		// Captured benefits remain historical. A fresh pending permit uses current
		// validity, allowing renewal of the same intent without another admission.
		const currentPaidEnd = currentPaidPolicy?.validUntil ? Date.parse(currentPaidPolicy.validUntil) : null;
		const leaseId = admission.leaseId ?? randomUUID(),
			expiresAt = currentPaidEnd !== null ? Math.min(now + 300000, currentPaidEnd) : now + 300000;
		const { decryptString } = await import("@/app/lib/encryption");
		const streamKey = session.encryptedStreamKey ? decryptString(session.encryptedStreamKey) : null;
		if (session.encryptedStreamKey && !streamKey) return null;
		let destinations: { id: string; name?: string; provider?: string; rtmpUrl: string; streamKey: string | null }[] | undefined;
		if (admission.encryptedTargetsSnapshot) {
			const decoded = decryptString(admission.encryptedTargetsSnapshot);
			if (!decoded) return null;
			try {
				const snapshot = JSON.parse(decoded);
				if (snapshot.version !== 1 || !Array.isArray(snapshot.destinations) || !snapshot.destinations.length) return null;
				destinations = snapshot.destinations;
			} catch {
				return null;
			}
		}
		const targetHash = hashExecutionTargets(destinations ?? [{ id: session.id, rtmpUrl: session.rtmpUrl, streamKey }]);
		const occurrence = paid && admission.occurrenceId && typeof admission.benefitsAtStart.scheduledStart === "number" ? { occurrenceId: admission.occurrenceId, scheduledStart: admission.benefitsAtStart.scheduledStart } : {};
		const claims = {
			issuer: "clipify.us",
			kind: "execution",
			...occurrence,
			policy: paid ? "pro_broadcast" : "free_lease",
			...(paid ? { scheduledEnd: admission.scheduledEnd?.getTime() ?? null } : {}),
			ownerId: runner.ownerId,
			runnerId: runner.id,
			sessionId: session.id,
			generation: admission.executionGeneration,
			targetHash,
			configurationRevision: admission.configurationRevision,
			sourceRevision: typeof capturedRevision === "number" ? capturedRevision : overlay.configurationRevision,
			sourceId,
			admissionId: admission.id,
			leaseId,
			requestId,
			issuedAt: now,
			expiresAt,
		};
		const { key, keyId } = signingKey(),
			payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		const lease = { keyId, payload, signature: sign(null, Buffer.from(payload), key).toString("base64url") };
		await tx
			.update(runnerBroadcastAdmissionsTable)
			.set({ leaseId, leaseExpiresAt: new Date(expiresAt), protocolSupportsLease: true, dispatchedAt: admission.dispatchedAt ?? new Date(now), state: admission.state === "reserved" ? "starting" : admission.state })
			.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId)));
		return { lease, ...occurrence, ...(paid ? { scheduledEnd: admission.scheduledEnd?.getTime() ?? null } : {}), ...(destinations ? { destinations } : {}), admissionId: admission.id, executionGeneration: admission.executionGeneration, ownerId: runner.ownerId, runnerId: runner.id, targetHash, configurationRevision: admission.configurationRevision, sourceId, sourceRevision: typeof capturedRevision === "number" ? capturedRevision : overlay.configurationRevision };
	});
}

export type RunnerOutputObservation = (typeof runnerBroadcastAdmissionsTable.$inferSelect)["outputStates"][number];
export async function readRunnerOutputStates(client: QueryClient, ownerId: string, sessionIds: readonly string[]) {
	if (!sessionIds.length) return new Map<string, RunnerOutputObservation[]>();
	const rows = await client
		.select({ sessionId: runnerBroadcastAdmissionsTable.sessionId, outputs: runnerBroadcastAdmissionsTable.outputStates })
		.from(runnerBroadcastAdmissionsTable)
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, ownerId), inArray(runnerBroadcastAdmissionsTable.sessionId, [...sessionIds]), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])));
	return new Map(rows.filter((row) => row.sessionId !== null).map((row) => [row.sessionId!, row.outputs ?? []]));
}
export type FreeExecutionAcknowledgment = { admissionId: string; sessionId: string; executionGeneration: string; leaseId: string; configurationRevision: number } & ({ state: "active"; outputs?: RunnerOutputObservation[] } | { state: "draining" } | { state: "stopped"; allOutputsClosed: true; playbackOutcome?: "clip_completed" | "playback_timeout" });
/** Session-only telemetry cannot apply or release a new-policy Free execution. */
export async function acknowledgeFreeExecutions(runner: Pick<typeof runnersTable.$inferSelect, "id" | "ownerId" | "token">, acknowledgments: readonly FreeExecutionAcknowledgment[], client: QueryClient = db, clock: () => number = Date.now) {
	return client.transaction(async (tx) => {
		const accepted: { admissionId: string; executionGeneration: string; state: "active" | "draining" | "stopped" }[] = [];
		await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, runner.ownerId)).limit(1).for("update");
		const [device] = await tx
			.select()
			.from(runnersTable)
			.where(and(eq(runnersTable.id, runner.id), eq(runnersTable.ownerId, runner.ownerId)))
			.limit(1)
			.for("update");
		if (!device || device.token !== runner.token) return accepted;
		for (const ack of [...acknowledgments].sort((a, b) => a.admissionId.localeCompare(b.admissionId))) {
			const [session] = await tx
				.select()
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.id, ack.sessionId), eq(streamSessionsTable.ownerId, runner.ownerId), eq(streamSessionsTable.runnerId, runner.id)))
				.limit(1)
				.for("update");
			if (!session) continue;
			const [admission] = await tx
				.select()
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.id, ack.admissionId), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.runnerId, runner.id), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), eq(runnerBroadcastAdmissionsTable.executionGeneration, ack.executionGeneration), inArray(runnerBroadcastAdmissionsTable.state, ["authorized", "starting", "active", "draining", "uncertain", "stopped"])))
				.limit(1)
				.for("update");
			const now = new Date(clock());
			if (!admission || admission.revokedAt || !admission.dispatchedAt || !admission.protocolSupportsLease || admission.leaseId !== ack.leaseId || admission.configurationRevision !== ack.configurationRevision || !admission.leaseExpiresAt) continue;
			if (ack.state === "stopped") {
				// Terminal replay must never stop a newer execution of the same session.
				if (ack.allOutputsClosed !== true) continue;
				accepted.push({ admissionId: admission.id, executionGeneration: admission.executionGeneration, state: "stopped" });
				if (admission.state === "stopped") continue;
				await tx
					.update(runnerBroadcastAdmissionsTable)
					.set({ state: "stopped", stoppedAt: now, lastObservedAt: now, terminalReason: ack.playbackOutcome === "playback_timeout" ? "playback_timeout" : "all_outputs_closed" })
					.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId)));
				const [otherOutput] = await tx
					.select({ id: runnerBroadcastAdmissionsTable.id })
					.from(runnerBroadcastAdmissionsTable)
					.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
					.limit(1)
					.for("update");
				if (!otherOutput) {
					await tx
						.update(streamSessionsTable)
						.set({ ...(ack.playbackOutcome === "playback_timeout" ? { lastError: PLAYBACK_TIMEOUT_MESSAGE } : {}), actualState: StreamState.Stopped, desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + (session.desiredState === StreamState.Running ? 1 : 0) })
						.where(and(eq(streamSessionsTable.id, session.id), eq(streamSessionsTable.ownerId, runner.ownerId)));
				}
				continue;
			}
			if (ack.state === "draining") {
				if (admission.state === "authorized") {
					const start = admission.benefitsAtStart.scheduledStart;
					if (admission.benefitsAtStart.cacheAuthorization !== true || admission.benefitsAtStart.runnerPro !== true || admission.benefitsAtStart.scheduleSuppressed === true || session.controlMode !== "scheduled" || session.mode !== "24/7" || typeof start !== "number" || !Number.isSafeInteger(start) || now.getTime() < start || !admission.scheduledEnd || now.getTime() >= admission.scheduledEnd.getTime() + 305000) continue;
					const [otherOutput] = await tx
						.select({ id: runnerBroadcastAdmissionsTable.id })
						.from(runnerBroadcastAdmissionsTable)
						.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
						.limit(1)
						.for("update");
					if (otherOutput) continue;
				} else if (!["starting", "active", "draining"].includes(admission.state)) continue;
				await tx
					.update(runnerBroadcastAdmissionsTable)
					.set({ state: "draining", lastObservedAt: now })
					.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId)));
				await tx
					.update(streamSessionsTable)
					.set({ actualState: StreamState.Running, desiredState: StreamState.Stopped, configurationRevision: session.configurationRevision + (session.desiredState === StreamState.Running ? 1 : 0) })
					.where(and(eq(streamSessionsTable.id, session.id), eq(streamSessionsTable.ownerId, runner.ownerId)));
				accepted.push({ admissionId: admission.id, executionGeneration: admission.executionGeneration, state: "draining" });
				continue;
			}
			let continuityRootAdmissionId: string | undefined;
			const cachedStart = admission.state === "authorized" && admission.benefitsAtStart.cacheAuthorization === true;
			if (cachedStart) {
				const start = admission.benefitsAtStart.scheduledStart;
				if (session.controlMode !== "scheduled" || session.mode !== "24/7" || admission.benefitsAtStart.scheduleSuppressed === true || typeof start !== "number" || !Number.isSafeInteger(start) || now.getTime() < start || !admission.scheduledEnd || now.getTime() >= admission.scheduledEnd.getTime()) continue;
				const otherOutputs = await tx
					.select()
					.from(runnerBroadcastAdmissionsTable)
					.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
					.for("update");
				if (otherOutputs.length) {
					const fingerprint = admission.benefitsAtStart.executionPayloadHashAtStart;
					const predecessor = otherOutputs.find((row) => row.scheduledEnd?.getTime() === start);
					if (!predecessor || typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) continue;
					const root = predecessor.continuityRootAdmissionId ?? predecessor.id;
					if (otherOutputs.some((row) => row.state !== "active" || row.revokedAt || row.benefitsAtStart.runnerPro !== true || row.benefitsAtStart.scheduleSuppressed === true || row.benefitsAtStart.executionPayloadHashAtStart !== fingerprint || row.benefitsAtStart.sourceRevisionAtStart !== admission.benefitsAtStart.sourceRevisionAtStart || (row.continuityRootAdmissionId ?? row.id) !== root)) continue;
					continuityRootAdmissionId = root;
				}
			} else {
				if (session.desiredState !== StreamState.Running || !["starting", "active"].includes(admission.state) || (admission.benefitsAtStart.runnerPro !== true && admission.leaseExpiresAt.getTime() <= now.getTime())) continue;
			}
			const targetIds = admission.targetIdsSnapshot ?? [session.id];
			if (ack.outputs && (!ack.outputs.length || new Set(ack.outputs.map((output) => output.id)).size !== ack.outputs.length || ack.outputs.some((output) => !targetIds.includes(output.id) || !["connecting", "streaming", "retrying", "failed", "stopped"].includes(output.state)))) continue;
			const outputStates = ack.outputs
				? targetIds.map((id) => {
						const observed = ack.outputs!.find((output) => output.id === id) ?? admission.outputStates?.find((output) => output.id === id);
						return { id, state: observed?.state ?? ("connecting" as const) };
					})
				: undefined;
			await tx
				.update(runnerBroadcastAdmissionsTable)
				.set({ state: "active", startedAt: admission.startedAt ?? now, lastObservedAt: now, ...(continuityRootAdmissionId ? { continuityRootAdmissionId } : {}), ...(outputStates ? { outputStates } : {}) })
				.where(and(eq(runnerBroadcastAdmissionsTable.id, admission.id), eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId)));
			await tx
				.update(streamSessionsTable)
				.set({ actualState: StreamState.Running, ...(session.lastError === PLAYBACK_TIMEOUT_MESSAGE ? { lastError: null } : {}), ...(cachedStart ? { desiredState: StreamState.Running } : {}) })
				.where(and(eq(streamSessionsTable.id, session.id), eq(streamSessionsTable.ownerId, runner.ownerId)));
			accepted.push({ admissionId: admission.id, executionGeneration: admission.executionGeneration, state: "active" });
		}
		return accepted;
	});
}
