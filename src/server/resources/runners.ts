import "server-only";
import { and, eq, asc, gt, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { runnersTable, streamSessionsTable, overlaysTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { DatabaseClient } from "@/db/client";
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
			const items = rows.slice(0, input.limit).map(sessionDto);
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
			return { ...sessionDto(row), runner: row.runnerId ? runnerDto(await runnerRecord(context, row.runnerId)) : null };
		},
		client,
	);
}

import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
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
			const endpoints = { twitch: "rtmp://live.twitch.tv/app", youtube: "rtmp://a.rtmp.youtube.com/live2" };
			if (input.sessionId) {
				const current = await sessionRecord(context, input.sessionId, true);
				const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision!);
				const rtmpUrl = input.destination ? endpoints[input.destination] : current.rtmpUrl;
				const [row] = await context.tx
					.update(streamSessionsTable)
					.set({ runnerId: input.runnerId, overlayId: input.overlayId, mode: input.mode as StreamMode, resolution: input.resolution, fps: input.fps, rtmpUrl, ...(rtmpUrl !== current.rtmpUrl ? { encryptedStreamKey: null, desiredState: StreamState.Stopped } : {}), configurationRevision: revision, updatedAt: new Date() })
					.where(and(eq(streamSessionsTable.id, current.id), eq(streamSessionsTable.ownerId, input.creatorId)))
					.returning();
				return { ...sessionDto(row), credentialsRequired: destination(row.rtmpUrl) !== "custom" && !row.encryptedStreamKey, dashboardUrl: `${getMcpConfiguration().origin}/dashboard/runners/${input.runnerId}` };
			}
			return workflowRetry(context, "configure_stream_session", input, async () => {
				const [row] = await context.tx
					.insert(streamSessionsTable)
					.values({ ownerId: input.creatorId, runnerId: input.runnerId, overlayId: input.overlayId, mode: input.mode as StreamMode, resolution: input.resolution, fps: input.fps, rtmpUrl: endpoints[input.destination ?? "twitch"] })
					.returning();
				return { ...sessionDto(row), credentialsRequired: true, dashboardUrl: `${getMcpConfiguration().origin}/dashboard/runners/${input.runnerId}` };
			});
		},
		client,
	);
}

import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
export function controlStreamSession(principal: TrustedCreatorPrincipal, input: unknown, client?: DatabaseClient) {
	return workflowOperation(
		principal,
		"control_stream_session",
		input,
		async (input, context) => {
			const current = await sessionRecord(context, input.sessionId, true);
			const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
			if (input.state === "running") {
				if (!current.runnerId) throw new Error("RESOURCE_UNAVAILABLE");
				await runnerRecord(context, current.runnerId);
				const [overlay] = await context.tx
					.select({ id: overlaysTable.id, status: overlaysTable.status })
					.from(overlaysTable)
					.where(and(eq(overlaysTable.id, current.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
					.limit(1);
				if (!overlay) throw new Error("RESOURCE_UNAVAILABLE");
				const access = await resolveRetainedResourceAccess({ kind: "overlay", ownerId: input.creatorId, resourceId: overlay.id, client: context.tx });
				if (!access.runtime || overlay.status !== "active") throw new Error("FEATURE_RESTRICTED");
				if (destination(current.rtmpUrl) !== "custom" && !current.encryptedStreamKey) throw new Error("INVALID_INPUT");
			}
			const [row] = await context.tx
				.update(streamSessionsTable)
				.set({ desiredState: input.state as StreamState, configurationRevision: revision, updatedAt: new Date() })
				.where(and(eq(streamSessionsTable.id, current.id), eq(streamSessionsTable.ownerId, input.creatorId)))
				.returning();
			return { ...sessionDto(row), applied: row.actualState === input.state, requestedState: input.state };
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
