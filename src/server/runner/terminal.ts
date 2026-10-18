import { PLAYBACK_TIMEOUT_MESSAGE } from "../../../packages/runner/src/presentation";
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, type DatabaseClient } from "@/db/client";
import { runnerBroadcastAdmissionsTable, streamSessionsTable, usersTable } from "@/db/schema";
import { StreamState } from "@types";

export type TerminalReceipt = { admissionId: string; executionGeneration: string; allOutputsClosed: true; playbackOutcome?: "clip_completed" | "playback_timeout" };
function matchesCredential(expected: string | null, actual: string) {
	if (!expected || !/^[a-f0-9]{64}$/.test(expected)) return false;
	return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}
/** Former credentials confer no read, configuration, start or renewal authority. */
export async function acknowledgeRevokedExecution(token: string, receipt: TerminalReceipt, client: DatabaseClient = db) {
	const hash = createHash("sha256").update(token).digest("hex");
	const [candidate] = await client.select().from(runnerBroadcastAdmissionsTable).where(eq(runnerBroadcastAdmissionsTable.id, receipt.admissionId)).limit(1);
	if (!candidate || !candidate.revokedAt || candidate.executionGeneration !== receipt.executionGeneration || !matchesCredential(candidate.terminalCredentialHash, hash)) throw new Error("INVALID_TERMINAL_CREDENTIAL");
	return client.transaction(async (tx) => {
		await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, candidate.ownerId)).limit(1).for("update");
		const [current] = await tx
			.select()
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.id, receipt.admissionId), eq(runnerBroadcastAdmissionsTable.ownerId, candidate.ownerId)))
			.limit(1)
			.for("update");
		if (!current || !current.revokedAt || current.executionGeneration !== receipt.executionGeneration || !matchesCredential(current.terminalCredentialHash, hash)) throw new Error("INVALID_TERMINAL_CREDENTIAL");
		if (current.state === "stopped" || current.state === "failed_before_output") return { accepted: true };
		const now = new Date();
		await tx
			.update(runnerBroadcastAdmissionsTable)
			.set({ state: "stopped", stoppedAt: now, lastObservedAt: now, terminalReason: receipt.playbackOutcome === "playback_timeout" ? "playback_timeout" : "all_outputs_closed" })
			.where(and(eq(runnerBroadcastAdmissionsTable.id, current.id), eq(runnerBroadcastAdmissionsTable.ownerId, current.ownerId)));
		if (current.sessionId) {
			const [otherOutput] = await tx
				.select({ id: runnerBroadcastAdmissionsTable.id })
				.from(runnerBroadcastAdmissionsTable)
				.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, current.ownerId), eq(runnerBroadcastAdmissionsTable.sessionId, current.sessionId), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
				.limit(1)
				.for("update");
			if (!otherOutput)
				await tx
					.update(streamSessionsTable)
					.set({ actualState: StreamState.Stopped, ...(receipt.playbackOutcome === "playback_timeout" ? { lastError: PLAYBACK_TIMEOUT_MESSAGE } : {}) })
					.where(and(eq(streamSessionsTable.id, current.sessionId), eq(streamSessionsTable.ownerId, current.ownerId)));
		}
		return { accepted: true };
	});
}
