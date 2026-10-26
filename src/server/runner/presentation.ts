import "server-only";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { runnersTable, streamSessionsTable, runnerBroadcastAdmissionsTable } from "@/db/schema";
import { z } from "zod";

export const RUNNER_PRESENTATION_COOKIE = "clipify_runner_presentation";
export const RUNNER_PRESENTATION_TTL_SECONDS = 600;
export type RunnerPresentationIdentity = { ownerId: string; runnerId: string; sessionId: string; executionGeneration: string; admissionId: string; credentialBinding: string };

export function signRunnerPresentationIdentity(identity: RunnerPresentationIdentity, now: number) {
	const secret = process.env.JWT_SECRET;
	if (!secret || secret.length < 32) return null;
	const expiresAt = (Math.floor(now / 1000) + RUNNER_PRESENTATION_TTL_SECONDS) * 1000;
	const token = jwt.sign({ kind: "runner_presentation", version: 1, ...identity, iat: Math.floor(now / 1000) }, secret, { algorithm: "HS256", issuer: "clipify.us", audience: "clipify-runner-presentation", expiresIn: RUNNER_PRESENTATION_TTL_SECONDS });
	return { token, expiresAt };
}

const identityClaims = z
	.object({
		kind: z.literal("runner_presentation"),
		version: z.literal(1),
		ownerId: z.string().min(1).max(255),
		runnerId: z.uuid(),
		sessionId: z.uuid(),
		executionGeneration: z.uuid(),
		admissionId: z.uuid(),
		credentialBinding: z.string().regex(/^[a-f0-9]{64}$/),
		iat: z.number().int().nonnegative(),
		exp: z.number().int().nonnegative(),
		iss: z.literal("clipify.us"),
		aud: z.literal("clipify-runner-presentation"),
	})
	.strict();

export function verifyRunnerPresentationIdentity(token: unknown, sessionId: string, now = Date.now()): RunnerPresentationIdentity | null {
	const secret = process.env.JWT_SECRET;
	if (typeof token !== "string" || !token || token.length > 4096 || !secret || secret.length < 32 || !Number.isSafeInteger(now) || now < 0) return null;
	try {
		const decoded = jwt.verify(token, secret, { algorithms: ["HS256"], issuer: "clipify.us", audience: "clipify-runner-presentation", clockTimestamp: Math.floor(now / 1000) });
		const parsed = identityClaims.safeParse(decoded);
		if (!parsed.success || parsed.data.sessionId !== sessionId || parsed.data.iat > Math.floor(now / 1000) || parsed.data.exp <= parsed.data.iat || parsed.data.exp - parsed.data.iat > RUNNER_PRESENTATION_TTL_SECONDS) return null;
		const { ownerId, runnerId, executionGeneration, admissionId, credentialBinding } = parsed.data;
		return { ownerId, runnerId, sessionId, executionGeneration, admissionId, credentialBinding };
	} catch {
		return null;
	}
}

/** Revalidate the live assignment on both issuance and authenticated rendering. */
export async function resolveRunnerPresentationExecution(identity: Omit<RunnerPresentationIdentity, "admissionId"> & { admissionId?: string }) {
	const runner = await db.query.runnersTable.findFirst({ where: and(eq(runnersTable.id, identity.runnerId), eq(runnersTable.ownerId, identity.ownerId)) });
	if (!runner || runner.id !== identity.runnerId || runner.ownerId !== identity.ownerId || createHash("sha256").update(runner.token).digest("hex") !== identity.credentialBinding) return null;
	const session = await db.query.streamSessionsTable.findFirst({ where: and(eq(streamSessionsTable.id, identity.sessionId), eq(streamSessionsTable.runnerId, runner.id), eq(streamSessionsTable.ownerId, runner.ownerId)) });
	if (!session || session.ownerId !== runner.ownerId || session.runnerId !== runner.id || session.id !== identity.sessionId) return null;
	const admission = await db.query.runnerBroadcastAdmissionsTable.findFirst({
		where: and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.runnerId, runner.id), eq(runnerBroadcastAdmissionsTable.sessionId, session.id), eq(runnerBroadcastAdmissionsTable.executionGeneration, identity.executionGeneration), identity.admissionId ? eq(runnerBroadcastAdmissionsTable.id, identity.admissionId) : undefined, inArray(runnerBroadcastAdmissionsTable.state, ["starting", "active", "draining", "authorized"])),
	});
	if (!admission || admission.revokedAt || admission.ownerId !== runner.ownerId || admission.runnerId !== runner.id || admission.sessionId !== session.id || admission.executionGeneration !== identity.executionGeneration || (identity.admissionId !== undefined && admission.id !== identity.admissionId) || !["starting", "active", "draining", "authorized"].includes(admission.state)) return null;
	if (admission.state === "authorized") {
		const start = admission.benefitsAtStart.scheduledStart;
		const now = Date.now();
		if (admission.benefitsAtStart.runnerPro !== true || admission.benefitsAtStart.cacheAuthorization !== true || typeof start !== "number" || !Number.isSafeInteger(start) || start > now || !admission.scheduledEnd || admission.scheduledEnd.getTime() <= now || !admission.protocolSupportsLease || !admission.leaseId || !admission.leaseExpiresAt || admission.leaseExpiresAt.getTime() <= now || !admission.dispatchedAt) return null;
	}
	return { session, admission };
}
