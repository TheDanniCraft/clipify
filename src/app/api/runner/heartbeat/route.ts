import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { db } from "@/db/client";
import { runnersTable, streamSessionsTable, overlaysTable, runnerBroadcastAdmissionsTable } from "@/db/schema";
import { and, eq, inArray, InferSelectModel, sql } from "drizzle-orm";
import { RunnerStatus, StreamState } from "@types";
import { decryptString } from "@/app/lib/encryption";
import { hasActiveRunnerAccess } from "@lib/entitlements";
import { issueRunnerScheduleCache } from "@/server/runner/schedules";
import { issueFreeExecutionLease, acknowledgeFreeExecutions, issueRunnerBenefitSnapshot } from "@/server/runner/lease";
import { tryRateLimit } from "@actions/rateLimit";

import { captureUnexpectedError } from "@lib/sentryServer";
import { operationalCount, operationalDuration } from "@lib/operationalHealth";
type StreamSession = InferSelectModel<typeof streamSessionsTable>;
const executionAckBase = z.object({ admissionId: z.uuid(), sessionId: z.uuid(), executionGeneration: z.uuid(), leaseId: z.uuid(), configurationRevision: z.number().int().positive() });
const heartbeatSchema = z.object({
	requestId: z.uuid().optional(),
	executions: z
		.array(
			z.discriminatedUnion("state", [
				executionAckBase
					.extend({
						state: z.literal("active"),
						outputs: z
							.array(z.object({ id: z.uuid(), state: z.enum(["connecting", "streaming", "retrying", "failed", "stopped"]) }).strict())
							.min(1)
							.max(1024)
							.optional(),
					})
					.strict(),
				executionAckBase.extend({ state: z.literal("draining") }).strict(),
				executionAckBase.extend({ state: z.literal("stopped"), allOutputsClosed: z.literal(true), playbackOutcome: z.enum(["clip_completed", "playback_timeout"]).optional() }).strict(),
			]),
		)
		.max(128)
		.optional(),
	os: z.string().max(256).optional(),
	version: z.string().max(128).optional(),
	hostname: z.string().max(256).optional(),
	protocolVersion: z.number().int().min(1).max(2147483647).optional(),
	capabilities: z.array(z.string().min(1).max(64)).max(32).optional(),
	lastAcknowledgedConfigRevision: z.number().int().min(0).max(2147483647).optional(),
	actualStates: z.record(z.string().max(256), z.unknown()).optional(),
});
function heartbeatResponse(body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	headers.set("Cache-Control", "no-store");
	return NextResponse.json(body, { ...init, headers });
}
async function readHeartbeat(req: Request): Promise<{ body: z.infer<typeof heartbeatSchema> } | { error: 400 | 413 }> {
	const reader = req.body?.getReader();
	if (!reader) return { error: 400 };
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 65536) {
				await reader.cancel();
				return { error: 413 };
			}
			chunks.push(value);
		}
		const parsed = heartbeatSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
		return parsed.success ? { body: parsed.data } : { error: 400 };
	} catch {
		return { error: 400 };
	} finally {
		reader.releaseLock();
	}
}

export async function POST(req: Request) {
	const started = Date.now();
	const recordOutcome = (outcome: string) => {
		operationalCount("clipify.runner.heartbeats", 1, { outcome });
		operationalDuration("clipify.runner.heartbeat_duration", Date.now() - started, { outcome });
	};
	try {
		// 1. Authenticate the Runner
		const authHeader = req.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			recordOutcome("unauthorized");
			return heartbeatResponse({ error: "Unauthorized" }, { status: 401 });
		}
		const token = authHeader.split(" ")[1];
		const identifier = createHash("sha256").update(token).digest("hex");
		const limit = await tryRateLimit({ key: "runner-heartbeat", points: 12, duration: 60, identifier });
		if (!limit.success) {
			recordOutcome("rate_limited");
			return heartbeatResponse({ error: "Too many heartbeats" }, { status: 429, headers: { "Retry-After": "60" } });
		}

		const runner = await db.query.runnersTable.findFirst({
			where: eq(runnersTable.token, token),
		});

		if (!runner) {
			recordOutcome("invalid_token");
			return heartbeatResponse({ error: "Invalid runner token" }, { status: 401 });
		}

		const advancedAccess = await hasActiveRunnerAccess(runner.ownerId);

		// 2. Parse payload
		const payload = await readHeartbeat(req);
		if ("error" in payload) {
			recordOutcome("invalid_payload");
			return heartbeatResponse({ error: payload.error === 413 ? "Heartbeat payload too large" : "Invalid heartbeat payload" }, { status: payload.error });
		}
		const { body } = payload;
		const { os, version, actualStates, hostname } = body;
		const signedProtocol = Boolean(body.protocolVersion === 2 && body.requestId && ["admissions", "drain", "runner_presentation", "free_lease"].every((capability) => (body.capabilities ?? []).includes(capability)));
		if (!advancedAccess && !signedProtocol) {
			recordOutcome("update_required");
			return heartbeatResponse({ error: "Update Clipify Runner before using Free broadcasting", code: "update_required", supportedProtocolVersion: 2, jobs: [] }, { status: 426 });
		}

		// 3. Update Runner Status
		await db
			.update(runnersTable)
			.set({
				lastHeartbeatAt: new Date(),
				status: RunnerStatus.Online,
				osInfo: os,
				version: version,
				protocolVersion: body.protocolVersion ?? 1,
				capabilities: [...new Set(body.capabilities ?? [])],
				...(body.lastAcknowledgedConfigRevision !== undefined ? { lastAcknowledgedConfigRevision: body.lastAcknowledgedConfigRevision } : {}),
				...(runner.name === "New Hardware Node" && hostname && hostname !== runner.name ? { name: hostname, configurationRevision: sql`${runnersTable.configurationRevision} + 1` } : {}),
			})
			.where(eq(runnersTable.id, runner.id));

		// 4. Find all sessions assigned to this runner
		const sessions = await db.query.streamSessionsTable.findMany({
			where: eq(streamSessionsTable.runnerId, runner.id),
		});

		// New-policy output requires an explicitly supported client, never a silent legacy fallback.
		if (sessions.some((session) => session.desiredState === StreamState.Running) && !(body.protocolVersion === 2 && Array.isArray(body.capabilities) && ["admissions", "drain", "runner_presentation"].every((capability) => (body.capabilities ?? []).includes(capability)))) {
			recordOutcome("update_required");
			return heartbeatResponse({ error: "Update Clipify Runner before starting this broadcast", code: "update_required", supportedProtocolVersion: 2, jobs: [] }, { status: 426, headers: { "Cache-Control": "no-store" } });
		}

		// 5. Update actual states in DB (if the runner reported them)
		// For a rough prototype, we might skip full state reconciliation and just send desired state
		if (advancedAccess && actualStates && typeof actualStates === "object") {
			const allowedSessionIds = new Set(sessions.map((session) => session.id));
			await Promise.all(
				Object.keys(actualStates).flatMap((sessionId) => {
					if (!allowedSessionIds.has(sessionId)) return [];
					const state = actualStates[sessionId];
					const parsedState = z.enum(StreamState).safeParse(state);
					if (!parsedState.success) return [];
					return [db.update(streamSessionsTable).set({ actualState: parsedState.data }).where(eq(streamSessionsTable.id, sessionId))];
				}),
			);
		}

		const acceptedExecutions = body.executions ? await acknowledgeFreeExecutions(runner, body.executions) : undefined;

		// 6. Build jobs for the runner based on desiredState
		const overlayIds = [...new Set(sessions.map((session) => session.overlayId))];
		const overlays = overlayIds.length ? await db.query.overlaysTable.findMany({ where: inArray(overlaysTable.id, overlayIds) }) : [];
		const overlaysById = new Map(overlays.map((overlay) => [overlay.id, overlay]));
		const jobs = await Promise.all(
			sessions.map(async (session: StreamSession) => {
				const execution = body.requestId && session.desiredState === StreamState.Running ? await issueFreeExecutionLease(runner, session.id, body.requestId) : null;
				const sourceId = execution && "sourceId" in execution && typeof execution.sourceId === "string" ? execution.sourceId : session.overlayId;
				const overlay = sourceId === session.overlayId ? overlaysById.get(sourceId) : await db.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, sourceId), eq(overlaysTable.ownerId, runner.ownerId)) });
				const permitted = (advancedAccess && !signedProtocol) || session.desiredState !== StreamState.Running || execution !== null;

				return {
					id: session.id,
					overlayId: sourceId,
					overlaySecret: advancedAccess || execution ? overlay?.secret || "" : "",
					mode: session.mode,
					desiredState: permitted ? session.desiredState : StreamState.Stopped,
					resolution: session.resolution,
					fps: session.fps,
					...(execution ?? {}),
					rtmpUrl: session.rtmpUrl,
					// Decrypt stream key if it's supposed to be running
					streamKey: permitted && session.desiredState === "running" && session.encryptedStreamKey ? decryptString(session.encryptedStreamKey) : null,
				};
			}),
		);

		const admissions = sessions.length ? await db.query.runnerBroadcastAdmissionsTable.findMany({ where: and(eq(runnerBroadcastAdmissionsTable.ownerId, runner.ownerId), eq(runnerBroadcastAdmissionsTable.runnerId, runner.id), eq(runnerBroadcastAdmissionsTable.state, "draining")) }) : [];
		const commandedJobs = jobs.map((job) => {
			const admission = admissions.find((attempt) => attempt.sessionId === job.id && attempt.state === "draining");
			if (!admission) return job;
			return { ...job, desiredState: StreamState.Stopped, admissionId: admission.id, executionGeneration: admission.executionGeneration, configurationRevision: admission.configurationRevision, ownerId: runner.ownerId, runnerId: runner.id, commandId: admission.commandId, command: admission.stopMode === "immediate" ? "stop_now" : "drain", stopMode: admission.stopMode };
		});
		const benefitSnapshot = signedProtocol && body.requestId ? await issueRunnerBenefitSnapshot(runner, body.requestId) : undefined;
		const scheduleCache = signedProtocol && body.requestId && body.capabilities?.includes("schedule_cache") ? await issueRunnerScheduleCache(runner, body.requestId) : undefined;
		recordOutcome("success");
		return heartbeatResponse({ success: true, jobs: commandedJobs, ...(scheduleCache !== undefined ? { scheduleCache } : {}), ...(benefitSnapshot !== undefined ? { benefitSnapshot } : {}), ...(acceptedExecutions ? { acceptedExecutions } : {}) }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		recordOutcome("unexpected_error");
		console.error("Heartbeat Error:", error);
		captureUnexpectedError(error, "runner-api", "heartbeat");
		return heartbeatResponse({ error: "Internal Server Error" }, { status: 500 });
	}
}
