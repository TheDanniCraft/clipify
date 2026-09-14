/* istanbul ignore file */

import { dbPool } from "@/db/client";

const RETENTION_YEARS = 3;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

declare global {
	var __consentRetentionSchedulerStarted: boolean | undefined;
	var __consentRetentionSchedulerTimer: ReturnType<typeof setInterval> | undefined;
	var __consentRetentionSchedulerRunning: boolean | undefined;
}

export async function pruneConsentProof(now = new Date()) {
	const cutoff = new Date(now);
	cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
	const client = await dbPool.connect();
	try {
		await client.query("BEGIN");
		const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(20260914, 15) AS locked");
		if (!lock.rows[0]?.locked) {
			await client.query("ROLLBACK");
			return;
		}
		await client.query('DELETE FROM "c15t_auditLog" WHERE "createdAt" < $1', [cutoff]);
		await client.query('DELETE FROM "c15t_consent" WHERE "givenAt" < $1', [cutoff]);
		await client.query('DELETE FROM "c15t_subject" AS subject WHERE "updatedAt" < $1 AND NOT EXISTS (SELECT 1 FROM "c15t_consent" WHERE "subjectId" = subject."id") AND NOT EXISTS (SELECT 1 FROM "c15t_auditLog" WHERE "subjectId" = subject."id")', [cutoff]);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

export function startConsentRetentionScheduler() {
	if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test") return;
	if (globalThis.__consentRetentionSchedulerStarted) return;
	globalThis.__consentRetentionSchedulerStarted = true;

	const run = async () => {
		if (globalThis.__consentRetentionSchedulerRunning) return;
		globalThis.__consentRetentionSchedulerRunning = true;
		try {
			await pruneConsentProof();
		} catch (error) {
			console.error("[consent] retention_prune_failed", error);
		} finally {
			globalThis.__consentRetentionSchedulerRunning = false;
		}
	};

	void run();
	globalThis.__consentRetentionSchedulerTimer = setInterval(() => void run(), RUN_INTERVAL_MS);
	globalThis.__consentRetentionSchedulerTimer.unref?.();
}
