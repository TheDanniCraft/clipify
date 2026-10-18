import type { workflowInputSchemas } from "@/server/mcp/workflows/schemas";
import { resolveActiveRunnerScheduleWindow } from "@/server/runner/schedules";
import "server-only";
import { isResourceFailure, resourceFailure } from "./errors";
import { broadcastAssignmentIsLocked, reserveBroadcastAdmission, cancelReservedAdmission, requestBroadcastDrain, revokeDeviceAdmissions } from "@/server/runner/admission";
import { and, or, ne, eq, asc, gt, sql, notInArray, inArray, isNotNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { runnersTable, streamSessionsTable, overlaysTable, runnerBroadcastAdmissionsTable, streamSessionDestinationsTable } from "@/db/schema";
import { selectedDestinationsHaveCredentials, normalizeLegacySessionDestination, resolveRunnerDestinationSelection, replaceSessionDestinationSelection } from "@/server/runner/destinations";
import { readRunnerOutputStates } from "@/server/runner/lease";
import { deriveRunnerCapabilities } from "@/server/runner/capabilities";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient, TransactionClient } from "@/db/client";
import { workflowOperation, workflowRetry, type WorkflowContext } from "./workflow";
import { getMcpConfiguration } from "@/server/mcp/config";
import { getRunnerContext } from "@lib/runnerArtifacts";
import { encodePageCursor, decodePageCursor } from "@/server/mcp/pagination";
import { nextConfigurationRevision } from "./revisions";
import { RunnerStatus, StreamState, StreamMode } from "@types";
function runnerDto(row: typeof runnersTable.$inferSelect) {
	const age = row.lastHeartbeatAt ? Math.max(0, Date.now() - row.lastHeartbeatAt.getTime()) : null;
	return { id: row.id, creatorId: row.ownerId, name: row.name.slice(0, 120), configurationRevision: row.configurationRevision, status: row.status === RunnerStatus.Online && age !== null && age <= 30_000 ? "online" : "offline", lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null, heartbeatAgeMs: age, osInfo: row.osInfo?.slice(0, 256) ?? null, version: row.version?.slice(0, 128) ?? null, createdAt: row.createdAt.toISOString() };
}
async function runnerRecord(context: WorkflowContext, runnerId: string, lock = false) {
	const query = context.tx
		.select()
		.from(runnersTable)
		.where(and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, context.creatorId)))
		.limit(1);
	const [row] = await (lock ? query.for("update") : query);
	if (!row) throw new Error("RESOURCE_UNAVAILABLE");
	return row;
}
function destination(url: string) {
	if (url === "rtmp://live.twitch.tv/app") return "twitch";
	if (url === "rtmp://a.rtmp.youtube.com/live2") return "youtube";
	return "custom";
}
function sessionDto(row: typeof streamSessionsTable.$inferSelect) {
	return {
		id: row.id,
		creatorId: row.ownerId,
		runnerId: row.runnerId,
		overlayId: row.overlayId,
		configurationRevision: row.configurationRevision,
		mode: row.mode,
		controlMode: row.controlMode ?? "manual",
		desiredState: row.desiredState,
		actualState: row.actualState,
		resolution: row.resolution,
		fps: row.fps,
		destination: destination(row.rtmpUrl),
		credentialsConfigured: Boolean(row.encryptedStreamKey),
		hasError: Boolean(row.lastError),
		error: row.lastError ? "The runner reported a stream error. Open the dashboard for details." : null,
		updatedAt: row.updatedAt.toISOString(),
	};
}
async function sessionWithDestinations(tx: TransactionClient, row: typeof streamSessionsTable.$inferSelect) {
	const selected = await tx
		.select({ id: streamSessionDestinationsTable.destinationId })
		.from(streamSessionDestinationsTable)
		.where(and(eq(streamSessionDestinationsTable.ownerId, row.ownerId), eq(streamSessionDestinationsTable.sessionId, row.id)))
		.orderBy(asc(streamSessionDestinationsTable.position));
	return { ...sessionDto(row), destinationIds: selected.map((target) => target.id), outputs: (await readRunnerOutputStates(tx, row.ownerId, [row.id])).get(row.id) ?? [] };
}
async function sessionRecord(context: WorkflowContext, sessionId: string, lock = false) {
	const query = context.tx
		.select()
		.from(streamSessionsTable)
		.where(and(eq(streamSessionsTable.id, sessionId), eq(streamSessionsTable.ownerId, context.creatorId)))
		.limit(1);
	const [row] = await (lock ? query.for("update") : query);
	if (!row) throw new Error("RESOURCE_UNAVAILABLE");
	return row;
}
export function getRunnerSetup(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_runner_setup",
		input,
		async (input) => {
			const origin = getMcpConfiguration().origin;
			const context = getRunnerContext();
			return {
				creatorId: input.creatorId,
				platform: input.platform,
				downloadUrl: `${origin}/api/runner/download?os=${input.platform}`,
				versionInfoUrl: `${origin}/api/runner/version`,
				artifactFingerprint: context.sourceFingerprint || null,
				artifactAvailability: "Check the official download/version endpoint; this tool does not claim a binary is available.",
				enrollmentUrl: `${origin}/runner/enroll`,
				dashboardUrl: `${origin}/dashboard/runners`,
				installationRequired: true,
				enrollmentRequired: true,
				instructions: ["Download the official binary for your platform.", input.platform === "windows" ? "Run the downloaded executable on your streaming machine." : "Make the downloaded binary executable and run it on your streaming machine.", "Use the enrollment link/code shown by the runner, sign in, and approve the device for this creator.", "Return after enrollment; list_runners and list_stream_sessions can help configure it. Enter stream keys through the dashboard, not chat."],
			};
		},
		client,
	);
}

import { z } from "zod";
export function listRunnersForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"list_runners",
		input,
		async (input, { tx }) => {
			const key = `${principal.grantId}:${principal.generation}:runners:${input.creatorId}`;
			const after = input.cursor ? decodePageCursor(input.cursor, key) : undefined;
			if (after && !z.uuid().safeParse(after).success) throw new Error("INVALID_INPUT");
			const rows = await tx
				.select()
				.from(runnersTable)
				.where(and(eq(runnersTable.ownerId, input.creatorId), after ? gt(runnersTable.id, after) : undefined))
				.orderBy(asc(runnersTable.id))
				.limit(input.limit + 1);
			const items = rows.slice(0, input.limit).map(runnerDto);
			return { items, nextCursor: rows.length > input.limit ? encodePageCursor(items.at(-1)!.id, key) : null };
		},
		client,
	);
}

export function getRunnerForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(principal, "get_runner", input, async (input, context) => runnerDto(await runnerRecord(context, input.runnerId)), client);
}

export function createRunnerForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"create_runner",
		input,
		(input, context) =>
			workflowRetry(context, "create_runner", input, async () => {
				const [row] = await context.tx
					.insert(runnersTable)
					.values({ ownerId: input.creatorId, name: input.name, token: `cl_run_${randomBytes(24).toString("hex")}`, status: RunnerStatus.Offline })
					.returning();
				return { ...runnerDto(row), enrollmentRequired: true, enrollmentUrl: `${getMcpConfiguration().origin}/runner/enroll`, dashboardUrl: `${getMcpConfiguration().origin}/dashboard/runners/${row.id}` };
			}),
		client,
	);
}

export function updateRunnerForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"update_runner",
		input,
		async (input, context) => {
			const current = await runnerRecord(context, input.runnerId, true);
			const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
			const [row] = await context.tx
				.update(runnersTable)
				.set({ name: input.name, configurationRevision: revision })
				.where(and(eq(runnersTable.id, current.id), eq(runnersTable.ownerId, input.creatorId)))
				.returning();
			return runnerDto(row);
		},
		client,
	);
}

import { runnerPreviewCache } from "@lib/runnerPreviewCache";
export function deleteRunnerForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"delete_runner",
		input,
		async (input, context) => {
			const row = await runnerRecord(context, input.runnerId, true);
			nextConfigurationRevision(row.configurationRevision, input.expectedRevision);
			await revokeDeviceAdmissions(context.tx, row);
			await context.tx
				.update(streamSessionsTable)
				.set({ desiredState: StreamState.Stopped, runnerId: null, configurationRevision: sql`${streamSessionsTable.configurationRevision}+1`, updatedAt: new Date() })
				.where(and(eq(streamSessionsTable.runnerId, row.id), eq(streamSessionsTable.ownerId, input.creatorId)));
			await context.tx.delete(runnersTable).where(and(eq(runnersTable.id, row.id), eq(runnersTable.ownerId, input.creatorId)));
			runnerPreviewCache.delete(row.id);
			return { runnerId: row.id, deleted: true, desiredSessionsStopped: true, deviceShutdownConfirmed: false };
		},
		client,
	);
}

export function unlinkRunnerForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"unlink_runner",
		input,
		async (input, context) => {
			const current = await runnerRecord(context, input.runnerId, true);
			const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
			await revokeDeviceAdmissions(context.tx, current);
			const [row] = await context.tx
				.update(runnersTable)
				.set({ token: `cl_run_${randomBytes(24).toString("hex")}`, status: RunnerStatus.Offline, lastHeartbeatAt: null, configurationRevision: revision })
				.where(and(eq(runnersTable.id, current.id), eq(runnersTable.ownerId, input.creatorId)))
				.returning();
			await context.tx
				.update(streamSessionsTable)
				.set({ desiredState: StreamState.Stopped, configurationRevision: sql`${streamSessionsTable.configurationRevision}+1`, updatedAt: new Date() })
				.where(and(eq(streamSessionsTable.runnerId, row.id), eq(streamSessionsTable.ownerId, input.creatorId)));
			runnerPreviewCache.delete(row.id);
			return { ...runnerDto(row), enrollmentRequired: true, credentialRevoked: true, desiredSessionsStopped: true, deviceShutdownConfirmed: false };
		},
		client,
	);
}

export function listStreamSessionsForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"list_stream_sessions",
		input,
		async (input, { tx }) => {
			const key = `${principal.grantId}:${principal.generation}:streams:${input.creatorId}`;
			const after = input.cursor ? decodePageCursor(input.cursor, key) : undefined;
			if (after && !z.uuid().safeParse(after).success) throw new Error("INVALID_INPUT");
			const rows = await tx
				.select()
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.ownerId, input.creatorId), after ? gt(streamSessionsTable.id, after) : undefined))
				.orderBy(asc(streamSessionsTable.id))
				.limit(input.limit + 1);
			const items = await Promise.all(rows.slice(0, input.limit).map((row) => sessionWithDestinations(tx, row)));
			return { items, nextCursor: rows.length > input.limit ? encodePageCursor(items.at(-1)!.id, key) : null };
		},
		client,
	);
}

export function getStreamSessionForPrincipal(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_stream_session",
		input,
		async (input, context) => {
			const row = await sessionRecord(context, input.sessionId);
			return { ...(await sessionWithDestinations(context.tx, row)), runner: row.runnerId ? runnerDto(await runnerRecord(context, row.runnerId)) : null };
		},
		client,
	);
}

import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
type StreamConfigurationInput = ReturnType<typeof workflowInputSchemas.configure_stream_session.parse>;
type DestinationSelection = Extract<Awaited<ReturnType<typeof resolveRunnerDestinationSelection>>, unknown[]>;
async function updateConfiguredSession(input: StreamConfigurationInput, context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect, selected: DestinationSelection | undefined, endpoints: Record<"twitch" | "youtube", string>) {
	if ((input.controlMode ?? current.controlMode) === "scheduled" && input.mode !== "24/7") return resourceFailure("INVALID_INPUT");
	const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision!);
	const rtmpUrl = selected?.[0].rtmpUrl ?? (input.destination ? endpoints[input.destination] : current.rtmpUrl);
	const [row] = await context.tx
		.update(streamSessionsTable)
		.set({ runnerId: input.runnerId, overlayId: input.overlayId, mode: input.mode as StreamMode, ...(input.controlMode ? { controlMode: input.controlMode } : {}), resolution: input.resolution, fps: input.fps, rtmpUrl, ...(selected ? { encryptedStreamKey: selected[0].encryptedStreamKey } : rtmpUrl !== current.rtmpUrl ? { encryptedStreamKey: null, desiredState: StreamState.Stopped } : {}), configurationRevision: revision, updatedAt: new Date() })
		.where(and(eq(streamSessionsTable.id, current.id), eq(streamSessionsTable.ownerId, input.creatorId)))
		.returning();
	if (selected) await replaceSessionDestinationSelection(context.tx, input.creatorId, row.id, selected);
	const normalized = selected ? { rtmpUrl, encryptedStreamKey: selected[0].encryptedStreamKey } : await normalizeLegacySessionDestination(context.tx, input.creatorId, row.id, { replaceRtmpUrl: input.destination !== undefined, clearCredentialOnUrlChange: true });
	return { ...(await sessionWithDestinations(context.tx, { ...row, ...normalized })), credentialsRequired: destination(normalized.rtmpUrl) !== "custom" && !normalized.encryptedStreamKey, dashboardUrl: `${getMcpConfiguration().origin}/dashboard/runners/${input.runnerId}` };
}

export function configureStreamSession(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"configure_stream_session",
		input,
		async (input, context) => {
			if (!input.sessionId && !(await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "runner:create", client: context.tx })).allowed) throw new Error("ACCESS_DENIED");
			await runnerRecord(context, input.runnerId, true);
			const [overlay] = await context.tx
				.select({ id: overlaysTable.id })
				.from(overlaysTable)
				.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
				.limit(1);
			if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
			const current = input.sessionId ? await sessionRecord(context, input.sessionId, true) : undefined;
			if (current && (current.runnerId !== input.runnerId || current.overlayId !== input.overlayId) && (await broadcastAssignmentIsLocked(context.tx, input.creatorId, current.id))) return resourceFailure("CONFLICT");
			const selected = input.destinationIds ? await resolveRunnerDestinationSelection(context.tx, input.creatorId, input.runnerId, input.destinationIds, deriveRunnerCapabilities(effectiveRunnerBenefits(context)).runnerPro) : undefined;
			if (isResourceFailure(selected)) return selected;
			const endpoints = { twitch: "rtmp://live.twitch.tv/app", youtube: "rtmp://a.rtmp.youtube.com/live2" };
			if (current) return updateConfiguredSession(input, context, current, selected, endpoints);
			return workflowRetry(context, "configure_stream_session", input, async () => {
				const [row] = await context.tx
					.insert(streamSessionsTable)
					.values({ ownerId: input.creatorId, runnerId: input.runnerId, overlayId: input.overlayId, mode: input.mode as StreamMode, controlMode: input.controlMode ?? "manual", resolution: input.resolution, fps: input.fps, rtmpUrl: selected?.[0].rtmpUrl ?? endpoints[input.destination ?? "twitch"], encryptedStreamKey: selected?.[0].encryptedStreamKey ?? null })
					.returning();
				if (selected) await replaceSessionDestinationSelection(context.tx, input.creatorId, row.id, selected);
				else await normalizeLegacySessionDestination(context.tx, input.creatorId, row.id);
				return { ...(await sessionWithDestinations(context.tx, row)), credentialsRequired: selected ? selected.some((target) => target.provider !== "custom" && !target.encryptedStreamKey) : true, dashboardUrl: `${getMcpConfiguration().origin}/dashboard/runners/${input.runnerId}` };
			});
		},
		client,
	);
}

import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
function effectiveRunnerBenefits(context: WorkflowContext) {
	return context.runnerBenefits ?? { proAccess: context.pro, runnerAccess: context.runnerAccess };
}
function scheduledStartIsAllowed(context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect) {
	return current.controlMode !== "scheduled" || current.desiredState === StreamState.Running || deriveRunnerCapabilities(effectiveRunnerBenefits(context)).runnerPro;
}
async function resolveSessionStartSource(tx: TransactionClient, ownerId: string, overlayId: string) {
	const [overlay] = await tx
		.select({ id: overlaysTable.id, status: overlaysTable.status, revision: overlaysTable.configurationRevision })
		.from(overlaysTable)
		.where(and(eq(overlaysTable.id, overlayId), eq(overlaysTable.ownerId, ownerId)))
		.limit(1);
	if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
	const access = await resolveRetainedResourceAccess({ kind: "overlay", ownerId: ownerId, resourceId: overlay.id, client: tx });
	if (!access.runtime || overlay.status !== "active") return resourceFailure("FEATURE_RESTRICTED");
	return overlay;
}
async function validateManualStartCredentials(tx: TransactionClient, ownerId: string, current: typeof streamSessionsTable.$inferSelect) {
	if (!(await selectedDestinationsHaveCredentials(tx, ownerId, current.id))) return resourceFailure("INVALID_INPUT");
	if (destination(current.rtmpUrl) !== "custom" && !current.encryptedStreamKey) throw new Error("INVALID_INPUT");
}
function capturedStartBinding(reserved: typeof runnerBroadcastAdmissionsTable.$inferSelect, scheduled: Awaited<ReturnType<typeof resolveActiveRunnerScheduleWindow>>, overlay: { id: string; revision: number }) {
	return {
		...(scheduled ? { occurrenceId: scheduled.occurrence.occurrenceId, scheduledEnd: new Date(scheduled.occurrence.endUtc) } : {}),
		benefitsAtStart: { ...reserved.benefitsAtStart, ...(scheduled ? { scheduleEventId: scheduled.event.id, scheduleEventRevision: scheduled.event.configurationRevision, scheduledStart: Date.parse(scheduled.occurrence.startUtc) } : {}), sourceIdAtStart: overlay.id, sourceRevisionAtStart: overlay.revision },
	};
}

type StreamControlInput = ReturnType<typeof workflowInputSchemas.control_stream_session.parse>;
async function reserveSessionStart(input: StreamControlInput, context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect, revision: number, clock: () => number) {
	if (!scheduledStartIsAllowed(context, current)) return resourceFailure("FEATURE_RESTRICTED");
	if (!current.runnerId) throw new Error("RESOURCE_UNAVAILABLE");
	const scheduled = current.controlMode === "scheduled" ? await resolveActiveRunnerScheduleWindow(context.tx, input.creatorId, current.runnerId, current.id, input.occurrenceId, clock()) : null;
	if (current.controlMode === "scheduled" && !scheduled) return resourceFailure("SCHEDULE_WINDOW_ENDED");
	if (scheduled) {
		const [open] = await context.tx
			.select({ id: runnerBroadcastAdmissionsTable.id })
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId), eq(runnerBroadcastAdmissionsTable.sessionId, current.id), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
			.limit(1)
			.for("update");
		if (open) return resourceFailure("RUNNER_RECOVERY_REQUIRED");
	}

	await runnerRecord(context, current.runnerId);
	const overlay = await resolveSessionStartSource(context.tx, input.creatorId, scheduled?.event.overlayId ?? current.overlayId);
	if (isResourceFailure(overlay)) return overlay;
	if (!scheduled) {
		const credentialFailure = await validateManualStartCredentials(context.tx, input.creatorId, current);
		if (credentialFailure) return credentialFailure;
	}
	const reserved = await reserveBroadcastAdmission(context.tx, current, effectiveRunnerBenefits(context), revision, scheduled?.event.id, clock);
	if (isResourceFailure(reserved)) return reserved;
	const [bound] = await context.tx
		.update(runnerBroadcastAdmissionsTable)
		.set(capturedStartBinding(reserved, scheduled, overlay))
		.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId), eq(runnerBroadcastAdmissionsTable.id, reserved.id)))
		.returning();
	return bound;
}

async function suppressStoppedOccurrence(input: StreamControlInput, context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect, clock: () => number) {
	if (current.controlMode === "scheduled") {
		const captures = await context.tx
			.select({ occurrenceId: runnerBroadcastAdmissionsTable.occurrenceId })
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId), eq(runnerBroadcastAdmissionsTable.sessionId, current.id), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active", "draining", "uncertain"])))
			.for("update");
		const occurrences = captures.map((row) => row.occurrenceId).filter((id): id is string => id !== null);
		const stopTime = clock();
		// Keep owner Stop intent after terminal receipts replace terminalReason.
		// A later explicit Resume has its own higher-revision admission.
		await context.tx
			.update(runnerBroadcastAdmissionsTable)
			.set({ benefitsAtStart: sql`jsonb_set(${runnerBroadcastAdmissionsTable.benefitsAtStart}, '{scheduleSuppressed}', 'true'::jsonb)` })
			.where(
				and(
					eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId),
					eq(runnerBroadcastAdmissionsTable.sessionId, current.id),
					isNotNull(runnerBroadcastAdmissionsTable.occurrenceId),
					notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"]),
					or(ne(runnerBroadcastAdmissionsTable.state, "authorized"), occurrences.length ? inArray(runnerBroadcastAdmissionsTable.occurrenceId, occurrences) : undefined, and(sql`case when jsonb_typeof(${runnerBroadcastAdmissionsTable.benefitsAtStart}->'scheduledStart') = 'number' then (${runnerBroadcastAdmissionsTable.benefitsAtStart}->>'scheduledStart')::numeric else 0 end <= ${stopTime}`, gt(runnerBroadcastAdmissionsTable.scheduledEnd, new Date(stopTime)))),
				),
			);
	}
}

async function validateSessionControlIntent(input: StreamControlInput, context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect) {
	if (input.occurrenceId && current.controlMode !== "scheduled") return resourceFailure("CONFLICT");
	if (input.executionGeneration) {
		const [attempt] = await context.tx
			.select({ generation: runnerBroadcastAdmissionsTable.executionGeneration })
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId), eq(runnerBroadcastAdmissionsTable.sessionId, current.id), notInArray(runnerBroadcastAdmissionsTable.state, ["stopped", "failed_before_output"])))
			.limit(1)
			.for("update");
		if (attempt?.generation !== input.executionGeneration) throw new Error("REVISION_CONFLICT");
	}
}

async function replaySessionStart(input: StreamControlInput, context: WorkflowContext, current: typeof streamSessionsTable.$inferSelect) {
	if (input.state === "running" && current.desiredState === StreamState.Running && input.expectedRevision === current.configurationRevision - 1) {
		const [existing] = await context.tx
			.select()
			.from(runnerBroadcastAdmissionsTable)
			.where(and(eq(runnerBroadcastAdmissionsTable.ownerId, input.creatorId), eq(runnerBroadcastAdmissionsTable.sessionId, current.id), eq(runnerBroadcastAdmissionsTable.configurationRevision, current.configurationRevision), inArray(runnerBroadcastAdmissionsTable.state, ["reserved", "starting", "active"])))
			.limit(1)
			.for("update");
		if (existing && input.occurrenceId && existing.occurrenceId !== input.occurrenceId) return resourceFailure("CONFLICT");
		if (existing) return { ...(await sessionWithDestinations(context.tx, current)), accepted: true, applied: existing.state === "active" && current.actualState === StreamState.Running, requestedState: input.state, admissionId: existing.id, executionGeneration: existing.executionGeneration };
	}
}

export function controlStreamSession(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient, clock: () => number = Date.now) {
	return workflowOperation(
		principal,
		"control_stream_session",
		input,
		async (input, context) => {
			const current = await sessionRecord(context, input.sessionId, true);
			const intentFailure = await validateSessionControlIntent(input, context, current);
			if (intentFailure) return intentFailure;

			const replay = await replaySessionStart(input, context, current);
			if (replay) return replay;
			const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
			let admission: typeof runnerBroadcastAdmissionsTable.$inferSelect | undefined;
			if (input.state === "running") {
				const reserved = await reserveSessionStart(input, context, current, revision, clock);
				if (isResourceFailure(reserved)) return reserved;
				admission = reserved;
			} else {
				await suppressStoppedOccurrence(input, context, current, clock);
				const cancelled = await cancelReservedAdmission(context.tx, current);
				if (!cancelled) admission = await requestBroadcastDrain(context.tx, current, input.stopMode);
			}
			const [row] = await context.tx
				.update(streamSessionsTable)
				.set({ desiredState: input.state as StreamState, configurationRevision: revision, updatedAt: new Date() })
				.where(and(eq(streamSessionsTable.id, current.id), eq(streamSessionsTable.ownerId, input.creatorId)))
				.returning();
			return { ...(await sessionWithDestinations(context.tx, row)), accepted: true, applied: input.state === "stopped" && admission ? false : row.actualState === input.state, requestedState: input.state, ...(admission ? { admissionId: admission.id, executionGeneration: admission.executionGeneration } : {}) };
		},
		client,
	);
}

export function getRunnerSnapshot(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"get_runner_snapshot",
		input,
		async (input, context) => {
			const runner = await runnerRecord(context, input.runnerId);
			const status = runnerDto(runner);
			const frame = runnerPreviewCache.getEntry(runner.id);
			const base = { runnerId: runner.id, source: "current_server_instance", runnerStatus: status.status, capturedAt: frame ? new Date(frame.timestamp).toISOString() : null };
			if (status.status !== "online") return { ...base, status: "runner_offline" };
			if (!frame || !frame.overlayId || frame.runnerRevision !== runner.configurationRevision) return { ...base, status: "unavailable" };
			const [assignment] = await context.tx
				.select({ id: streamSessionsTable.id })
				.from(streamSessionsTable)
				.where(and(eq(streamSessionsTable.runnerId, runner.id), eq(streamSessionsTable.overlayId, frame.overlayId), eq(streamSessionsTable.ownerId, input.creatorId)))
				.limit(1);
			if (!assignment) return { ...base, status: "unavailable" };
			if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(frame.image)) return { ...base, status: "unavailable" };
			return { ...base, overlayId: frame.overlayId, status: "available", ageMs: Date.now() - frame.timestamp, imageData: frame.image.slice("data:image/jpeg;base64,".length) };
		},
		client,
	);
}
