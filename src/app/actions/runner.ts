"use server";

import { z } from "zod";
import { ProviderRequestError } from "@/server/runner/provider-api";
import { runnerPreviewCache } from "@lib/runnerPreviewCache";
import { db, type QueryClient } from "@/db/client";
import { overlaysTable, runnersTable, usersTable } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "crypto";
import { eq, and, sql, inArray, asc, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "@/server/runner/capabilities";
import { StreamState } from "@types";
import { PLAYBACK_TIMEOUT_MESSAGE } from "../../../packages/runner/src/presentation";
import { readRunnerOutputStates } from "@/server/runner/lease";
import { getRunnerVersionInfo } from "@lib/runnerArtifacts";
import { captureUnexpectedError } from "@lib/sentryServer";
import { isResourceFailure, toPublicResourceError } from "@/server/resources/errors";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { RunnerDestinationInput } from "@/server/runner/destinations";
import { authorizeCreatorOperation, listAuthorizedCreatorOperations } from "@/auth/authorize-operation";
import type { Permission } from "@/auth/permissions";

const publicRunnerColumns = {
	id: true,
	ownerId: true,
	name: true,
	status: true,
	lastHeartbeatAt: true,
	osInfo: true,
	version: true,
	createdAt: true,
} as const;

const publicRunnerSelection = {
	id: runnersTable.id,
	ownerId: runnersTable.ownerId,
	name: runnersTable.name,
	status: runnersTable.status,
	lastHeartbeatAt: runnersTable.lastHeartbeatAt,
	osInfo: runnersTable.osInfo,
	version: runnersTable.version,
	createdAt: runnersTable.createdAt,
};

async function hasAccess(ownerId: string, permission: Permission) {
	return (await authorizeCreatorOperation({ creatorId: ownerId, resourceOwnerId: ownerId, permission })).allowed;
}

function streamKeyRequiredForUrl(rtmpUrl: string) {
	return rtmpUrl === "rtmp://live.twitch.tv/app" || rtmpUrl === "rtmp://a.rtmp.youtube.com/live2";
}

async function ownerHasRunnerPro(ownerId: string, client: QueryClient = db) {
	const owner = await client.query.usersTable.findFirst({ where: eq(usersTable.id, ownerId) });
	if (!owner) return false;
	return deriveRunnerCapabilities(await resolveRunnerBenefits(owner, client)).runnerPro;
}

async function runnerDestinationAction<T>(operation: string, run: (principal: TrustedCreatorPrincipal) => Promise<T>) {
	try {
		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal();
		if (!principal) return { success: false as const, error: "Unauthorized", code: "ACCESS_DENIED" as const };
		return await run(principal);
	} catch (cause) {
		if (cause instanceof ProviderRequestError) return { success: false as const, error: cause.message, code: cause.code };
		const error = toPublicResourceError(cause instanceof Error && cause.message === "AUTHENTICATION_REQUIRED" ? new Error("ACCESS_DENIED") : cause);
		if (error.code === "SERVICE_UNAVAILABLE") {
			// ORM/process errors may carry credential parameters. Report the unexpected failure
			// without forwarding those values to either Sentry's issue or console-log integrations.
			captureUnexpectedError(new Error("Runner destination storage operation failed"), "runner-actions", operation);
		}
		return { success: false as const, error: error.message, code: error.code };
	}
}

export async function listRunnerScheduleEvents(ownerId: string, runnerId: string) {
	return runnerDestinationAction("list-runner-schedule-events", async (principal) => {
		const { listRunnerScheduleEventsForPrincipal } = await import("@/server/runner/schedules");
		return listRunnerScheduleEventsForPrincipal(principal, { ownerId, runnerId });
	});
}

export async function saveRunnerScheduleEvent(data: unknown) {
	return runnerDestinationAction("save-runner-schedule-event", async (principal) => {
		const { saveRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
		return saveRunnerScheduleEventForPrincipal(principal, data);
	});
}

export async function deleteRunnerScheduleEvent(data: unknown) {
	return runnerDestinationAction("delete-runner-schedule-event", async (principal) => {
		const { deleteRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
		return deleteRunnerScheduleEventForPrincipal(principal, data);
	});
}

export async function setRunnerAutomationPaused(data: unknown) {
	return runnerDestinationAction("set-runner-automation-paused", async (principal) => {
		const { setRunnerAutomationPausedForPrincipal } = await import("@/server/runner/schedules");
		return setRunnerAutomationPausedForPrincipal(principal, data);
	});
}

export async function resumeRunnerScheduleOccurrence(data: unknown) {
	return runnerDestinationAction("resume-runner-schedule-occurrence", async (principal) => {
		const { resumeRunnerScheduleOccurrenceForPrincipal } = await import("@/server/runner/schedules");
		return resumeRunnerScheduleOccurrenceForPrincipal(principal, data);
	});
}

export async function saveRunnerDestination(data: RunnerDestinationInput) {
	return runnerDestinationAction("save-runner-destination", async (principal) => {
		const { saveRunnerDestinationForPrincipal } = await import("@/server/runner/destinations");
		const result = await saveRunnerDestinationForPrincipal(principal, data);
		if (result.success) revalidatePath(data.runnerId ? `/dashboard/runners/${data.runnerId}` : "/dashboard/runners");
		return result;
	});
}

export async function listRunnerDestinations(ownerId: string, runnerId?: string) {
	return runnerDestinationAction("list-runner-destinations", async (principal) => {
		const { listRunnerDestinationsForPrincipal } = await import("@/server/runner/destinations");
		return listRunnerDestinationsForPrincipal(principal, { ownerId, runnerId });
	});
}

export async function deleteRunnerDestination(data: { ownerId: string; id: string; expectedRevision: number; removeFromSavedBroadcasts?: boolean }) {
	return runnerDestinationAction("delete-runner-destination", async (principal) => {
		const { deleteRunnerDestinationForPrincipal } = await import("@/server/runner/destinations");
		const result = await deleteRunnerDestinationForPrincipal(principal, data);
		if (result.success) revalidatePath("/dashboard/runners");
		return result;
	});
}

export async function createRunner(ownerId: string, name: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:create"))) return { success: false, error: "Unauthorized" };

		// Generate a secure random token for the runner to authenticate with
		const token = `cl_run_${randomBytes(24).toString("hex")}`;

		const [newRunner] = await db
			.insert(runnersTable)
			.values({
				ownerId,
				name,
				token,
			})
			.returning(publicRunnerSelection);

		revalidatePath("/dashboard/runners");
		return { success: true, runner: newRunner };
	} catch (error) {
		console.error("Failed to create runner:", error);
		captureUnexpectedError(error, "runner-actions", "create-runner");
		return { success: false, error: "Failed to create runner" };
	}
}

export async function createOwnRunner(name: string) {
	try {
		const candidates = await listAuthorizedCreatorOperations({ permission: "runner:create" });
		const creator = candidates.find((candidate) => candidate.accessPath === "owner")?.creator;
		if (!creator) {
			redirect(`/auth?returnUrl=${encodeURIComponent("/runner/enroll")}`);
		}

		return await createRunner(creator.id, name);
	} catch (error) {
		console.error("Failed to create own runner:", error);
		captureUnexpectedError(error, "runner-actions", "create-own-runner");
		return { success: false, error: "Failed to create runner" };
	}
}

export async function deleteRunner(runnerId: string, ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:delete"))) return { success: false, error: "Unauthorized" };

		const runner = await db.query.runnersTable.findFirst({ where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)) });
		if (!runner) return { success: true };
		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal();
		if (!principal) return { success: false, error: "Unauthorized" };
		const { deleteRunnerForPrincipal } = await import("@/server/resources/runners");
		await deleteRunnerForPrincipal(principal, { creatorId: ownerId, runnerId, expectedRevision: runner.configurationRevision });

		revalidatePath("/dashboard/runners");
		return { success: true };
	} catch (error) {
		console.error("Failed to delete runner:", error);
		captureUnexpectedError(error, "runner-actions", "delete-runner");
		return { success: false, error: "Failed to delete runner" };
	}
}

export async function unlinkRunner(runnerId: string, ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner-credential:rotate"))) return { success: false, error: "Unauthorized" };

		const runner = await db.query.runnersTable.findFirst({
			where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)),
		});

		if (!runner) return { success: false, error: "Runner not found", code: "NOT_FOUND" as const };

		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal();
		if (!principal) return { success: false, error: "Unauthorized" };
		const { unlinkRunnerForPrincipal } = await import("@/server/resources/runners");
		await unlinkRunnerForPrincipal(principal, { creatorId: ownerId, runnerId, expectedRevision: runner.configurationRevision });

		revalidatePath("/dashboard/runners");
		revalidatePath(`/dashboard/runners/${runnerId}`);
		return { success: true };
	} catch (error) {
		console.error("Failed to unlink runner:", error);
		captureUnexpectedError(error, "runner-actions", "unlink-runner");
		return { success: false, error: "Failed to unlink runner" };
	}
}

import { streamSessionsTable, streamSessionDestinationsTable } from "@/db/schema";
import { encryptString } from "@/app/lib/encryption";
import type { StreamMode } from "@/app/lib/types";

export async function upsertStreamSession(data: { id?: string; expectedRevision?: number; ownerId: string; runnerId: string; overlayId: string; mode: StreamMode; controlMode?: "manual" | "scheduled"; streamKey: string; clearStreamKey?: boolean; rtmpUrl: string; destinationIds?: string[]; resolution?: string; fps?: number }) {
	return runnerDestinationAction("upsert-stream-session", async (principal) => {
		if (data.destinationIds !== undefined) {
			const { configureStreamSession } = await import("@/server/resources/runners");
			const result = await configureStreamSession(principal, { creatorId: data.ownerId, runnerId: data.runnerId, overlayId: data.overlayId, mode: data.mode, controlMode: data.controlMode ?? "manual", destinationIds: data.destinationIds, resolution: data.resolution ?? "1080p", fps: data.fps ?? 60, ...(data.id ? { sessionId: data.id, expectedRevision: data.expectedRevision } : { retryKey: randomUUID() }) });
			if (isResourceFailure(result)) return { success: false as const, error: result.error.message, code: result.error.code };
			revalidatePath("/dashboard/runners");
			return { success: true as const };
		}
		return db.transaction(async (tx) => {
			const { authorizeLockedMutation } = await import("@/server/resources/mutation");
			const authority = await authorizeLockedMutation(principal, data.ownerId, data.id ? "runner:update" : "runner:create", tx);
			if (!(await hasAccess(data.ownerId, data.id ? "runner:update" : "runner:create"))) return { success: false, error: "Unauthorized" };
			if (!["24/7", "failsafe"].includes(data.mode)) return { success: false, error: "Choose clip playback or live fallback.", code: "INVALID_INPUT" as const };
			const controlMode = data.controlMode ?? "manual";
			if (!["manual", "scheduled"].includes(controlMode) || (controlMode === "scheduled" && data.mode !== "24/7")) return { success: false, error: "Live fallback uses Manual control.", code: "INVALID_INPUT" as const };
			if (controlMode === "scheduled" && !(await ownerHasRunnerPro(data.ownerId, tx))) return { success: false, error: "Scheduling requires Pro.", code: "ENTITLEMENT_REQUIRED" as const };
			const [runner, overlay] = await Promise.all([tx.query.runnersTable.findFirst({ where: and(eq(runnersTable.id, data.runnerId), eq(runnersTable.ownerId, data.ownerId)) }), tx.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, data.overlayId), eq(overlaysTable.ownerId, data.ownerId)) })]);
			if (!runner || !overlay) return { success: false, error: "Runner or overlay not found", code: "NOT_FOUND" as const };
			if (data.id && !data.rtmpUrl.trim()) {
				const legacy = await tx.query.streamSessionsTable.findFirst({ where: and(eq(streamSessionsTable.id, data.id), eq(streamSessionsTable.ownerId, data.ownerId)) });
				if (!legacy) return { success: false as const, error: "Stream session not found", code: "NOT_FOUND" as const };
				data = { ...data, rtmpUrl: legacy.rtmpUrl };
			}
			if (!data.rtmpUrl.trim()) return { success: false, error: "An RTMP URL is required", code: "RTMP_URL_REQUIRED" as const };

			if (streamKeyRequiredForUrl(data.rtmpUrl) && !data.streamKey && (!data.id || data.clearStreamKey)) return { success: false, error: "A stream key is required for Twitch or YouTube", code: "STREAM_KEY_REQUIRED" as const };
			let savedSessionId = data.id;
			let endpointChanged = true;
			if (data.id) {
				if (data.expectedRevision !== undefined && (!Number.isInteger(data.expectedRevision) || data.expectedRevision < 1 || data.expectedRevision >= 2_147_483_647)) return { success: false, error: "Invalid configuration revision", code: "INVALID_INPUT" as const };
				const existing = await tx.query.streamSessionsTable.findFirst({ where: and(eq(streamSessionsTable.id, data.id), eq(streamSessionsTable.ownerId, data.ownerId)), columns: { controlMode: true, configurationRevision: true, rtmpUrl: true, runnerId: true, overlayId: true } });
				if (!existing) return { success: false, error: "Stream session not found", code: "NOT_FOUND" as const };
				if (existing.runnerId !== data.runnerId || existing.overlayId !== data.overlayId) {
					const { broadcastAssignmentIsLocked } = await import("@/server/runner/admission");
					if (await broadcastAssignmentIsLocked(tx, data.ownerId, data.id)) return { success: false as const, error: "Stop this broadcast and wait for its outputs to close before changing its Runner or source.", code: "CONFLICT" as const };
				}

				if (data.mode === "failsafe" && data.controlMode === undefined && existing.controlMode === "scheduled") return { success: false, error: "Live fallback uses Manual control. Choose Manual before saving.", code: "INVALID_INPUT" as const };
				const expectedRevision = data.expectedRevision ?? existing.configurationRevision;
				endpointChanged = data.rtmpUrl.trim() !== existing.rtmpUrl;

				// Update existing
				const updatePayload: Record<string, unknown> = {
					configurationRevision: sql`${streamSessionsTable.configurationRevision} + 1`,
					runnerId: data.runnerId,
					overlayId: data.overlayId,
					mode: data.mode,
					...(data.controlMode ? { controlMode: data.controlMode } : {}),
					rtmpUrl: data.rtmpUrl,
					resolution: data.resolution || "1080p",
					fps: data.fps || 60,
				};
				if (data.clearStreamKey) {
					updatePayload.encryptedStreamKey = null;
				} else if (data.streamKey) {
					updatePayload.encryptedStreamKey = encryptString(data.streamKey);
				}

				const [updatedSession] = await tx
					.update(streamSessionsTable)
					.set(updatePayload)
					.where(and(eq(streamSessionsTable.id, data.id), eq(streamSessionsTable.ownerId, data.ownerId), expectedRevision !== undefined ? eq(streamSessionsTable.configurationRevision, expectedRevision) : undefined))
					.returning({ id: streamSessionsTable.id });
				if (!updatedSession) return expectedRevision !== undefined ? { success: false, error: "Stream configuration changed. Refresh and try again.", code: "REVISION_CONFLICT" as const } : { success: false, error: "Stream session not found", code: "NOT_FOUND" as const };
			} else {
				// Insert new
				const [created] = await tx
					.insert(streamSessionsTable)
					.values({
						ownerId: data.ownerId,
						runnerId: data.runnerId,
						overlayId: data.overlayId,
						mode: data.mode,
						controlMode,
						encryptedStreamKey: data.streamKey ? encryptString(data.streamKey) : null,
						rtmpUrl: data.rtmpUrl,
						resolution: data.resolution || "1080p",
						fps: data.fps || 60,
					})
					.returning({ id: streamSessionsTable.id });
				savedSessionId = created.id;
			}

			const { normalizeLegacySessionDestination } = await import("@/server/runner/destinations");
			await normalizeLegacySessionDestination(tx, data.ownerId, savedSessionId!, { credentialAction: data.clearStreamKey ? "clear" : data.streamKey ? "replace" : "keep", replaceRtmpUrl: endpointChanged });
			authority.assertAuthorityCurrent();
			revalidatePath("/dashboard/runners");
			return { success: true };
		});
	});
}

export async function setStreamDesiredState(sessionId: string, state: StreamState, expectedRevision?: number, stopMode: "graceful" | "immediate" = "graceful", occurrenceId?: string) {
	try {
		const session = await db.query.streamSessionsTable.findFirst({ where: eq(streamSessionsTable.id, sessionId) });
		if (!session || !(await hasAccess(session.ownerId, "runner:control"))) return { success: false, error: "Unauthorized" };
		if (state === StreamState.Running && streamKeyRequiredForUrl(session.rtmpUrl) && !session.encryptedStreamKey) return { success: false, error: "A stream key is required for Twitch or YouTube", code: "STREAM_KEY_REQUIRED" as const };

		const revision = expectedRevision ?? session.configurationRevision;
		if (!Number.isInteger(revision) || revision < 1 || revision !== session.configurationRevision || revision >= 2_147_483_647) return { success: false, error: "Stream configuration changed. Refresh and try again.", code: "REVISION_CONFLICT" as const };

		const { getVerifiedSessionPrincipal } = await import("@/auth/session-principal");
		const principal = await getVerifiedSessionPrincipal();
		if (!principal) return { success: false, error: "Unauthorized" };
		const { controlStreamSession } = await import("@/server/resources/runners");
		const controlled = await controlStreamSession(principal, { creatorId: session.ownerId, sessionId, state, expectedRevision: revision, ...(state === StreamState.Stopped ? { stopMode } : {}), ...(occurrenceId !== undefined ? { occurrenceId } : {}) });

		if (isResourceFailure(controlled)) return { success: false, error: controlled.error.message, code: controlled.error.code };
		revalidatePath("/dashboard/runners");
		return { success: true, accepted: controlled.accepted === true, applied: controlled.applied === true, admissionId: controlled.admissionId, configurationRevision: controlled.configurationRevision };
	} catch (error) {
		const projected = toPublicResourceError(error);
		if (projected.code === "SERVICE_UNAVAILABLE") captureUnexpectedError(new Error("Runner broadcast control operation failed"), "runner-actions", "set-stream-state");
		return { success: false, error: projected.message, code: projected.code };
	}
}

export async function getAllRunners(ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:read"))) return [];

		return await db.query.runnersTable.findMany({
			where: eq(runnersTable.ownerId, ownerId),
			columns: publicRunnerColumns,
		});
	} catch (error) {
		console.error("Failed to fetch runners:", error);
		captureUnexpectedError(error, "runner-actions", "fetch-runners");
		return [];
	}
}

export async function getAllStreamSessions(ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:read"))) return [];

		const sessions = await db.query.streamSessionsTable.findMany({ where: and(eq(streamSessionsTable.ownerId, ownerId), isNull(streamSessionsTable.testExpiresAt)) });
		return await publicSessionConfigurations(sessions, ownerId);
	} catch (error) {
		console.error("Failed to fetch stream sessions:", error);
		captureUnexpectedError(error, "runner-actions", "fetch-stream-sessions");
		return [];
	}
}

export async function getRunner(runnerId: string, ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:read"))) return null;

		return await db.query.runnersTable.findFirst({
			where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)),
			columns: publicRunnerColumns,
		});
	} catch (error) {
		console.error("Failed to fetch runner:", error);
		captureUnexpectedError(error, "runner-actions", "fetch-runner");
		return null;
	}
}

export async function getRunnerToken(runnerId: string, ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner-credential:read"))) return { success: false, error: "Unauthorized" };

		const runner = await db.query.runnersTable.findFirst({
			where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)),
			columns: { token: true },
		});
		if (!runner) return { success: false, error: "Runner not found" };

		return { success: true, token: runner.token };
	} catch (error) {
		console.error("Failed to fetch runner token:", error);
		captureUnexpectedError(error, "runner-actions", "fetch-runner-token");
		return { success: false, error: "Failed to fetch runner token" };
	}
}

export async function getRunnerVersionManifest() {
	return getRunnerVersionInfo();
}

export async function getStreamSessionsForRunner(runnerId: string, ownerId: string) {
	try {
		if (!(await hasAccess(ownerId, "runner:read"))) return [];

		const sessions = await db.query.streamSessionsTable.findMany({ where: and(eq(streamSessionsTable.runnerId, runnerId), eq(streamSessionsTable.ownerId, ownerId), isNull(streamSessionsTable.testExpiresAt)) });
		return await publicSessionConfigurations(sessions, ownerId);
	} catch (error) {
		console.error("Failed to fetch stream sessions for runner:", error);
		captureUnexpectedError(error, "runner-actions", "fetch-runner-sessions");
		return [];
	}
}

async function publicSessionConfigurations(sessions: (typeof streamSessionsTable.$inferSelect)[], ownerId: string) {
	const outputs = await readRunnerOutputStates(
		db,
		ownerId,
		sessions.map((session) => session.id),
	);
	const selected = sessions.length
		? await db
				.select({ sessionId: streamSessionDestinationsTable.sessionId, destinationId: streamSessionDestinationsTable.destinationId })
				.from(streamSessionDestinationsTable)
				.where(
					and(
						eq(streamSessionDestinationsTable.ownerId, ownerId),
						inArray(
							streamSessionDestinationsTable.sessionId,
							sessions.map((session) => session.id),
						),
					),
				)
				.orderBy(asc(streamSessionDestinationsTable.position))
		: [];
	return sessions.map((session) => ({
		id: session.id,
		ownerId: session.ownerId,
		runnerId: session.runnerId,
		overlayId: session.overlayId,
		mode: session.mode,
		controlMode: session.controlMode,
		desiredState: session.desiredState,
		actualState: session.actualState,
		configurationRevision: session.configurationRevision,
		resolution: session.resolution,
		fps: session.fps,
		hasError: Boolean(session.lastError),
		playbackTimedOut: session.lastError === PLAYBACK_TIMEOUT_MESSAGE,
		destinationIds: selected.filter((target) => target.sessionId === session.id).map((target) => target.destinationId),
		outputs: outputs.get(session.id) ?? [],
		legacyDestinationConfigured: Boolean(session.rtmpUrl) && (!streamKeyRequiredForUrl(session.rtmpUrl) || Boolean(session.encryptedStreamKey)),
	}));
}

export async function getRunnerBrandingProfile(ownerId: string, runnerId: string) {
	return runnerDestinationAction("read-runner-appearance", async (principal) => {
		const { getRunnerBrandingProfileForPrincipal } = await import("@/server/runner/branding-profiles");
		return getRunnerBrandingProfileForPrincipal(principal, { ownerId, runnerId });
	});
}

export async function saveRunnerBrandingProfile(input: unknown) {
	return runnerDestinationAction("save-runner-appearance", async (principal) => {
		const { saveRunnerBrandingProfileForPrincipal } = await import("@/server/runner/branding-profiles");
		return saveRunnerBrandingProfileForPrincipal(principal, input);
	});
}

export async function renameRunnerScheduleEvent(data: unknown) {
	return runnerDestinationAction("rename-runner-schedule-event", async (principal) => {
		const { renameRunnerScheduleEventForPrincipal } = await import("@/server/runner/schedules");
		return renameRunnerScheduleEventForPrincipal(principal, data);
	});
}

/** Dashboard reads use server actions; Runner uploads keep their external API. */
export async function getRunnerLivePreview(runnerId: string, ownerId: string) {
	if (!z.uuid().safeParse(runnerId).success || !/^[A-Za-z0-9_-]{1,255}$/.test(ownerId)) return { success: false as const, code: "INVALID_INPUT" as const, error: "Choose a valid Runner." };
	try {
		if (!(await hasAccess(ownerId, "runner:read"))) return { success: false as const, code: "ACCESS_DENIED" as const, error: "You do not have access to this Runner." };
		const runner = await db.query.runnersTable.findFirst({ where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)), columns: { id: true } });
		if (!runner) return { success: false as const, code: "RESOURCE_UNAVAILABLE" as const, error: "This Runner is unavailable." };
		return { success: true as const, image: runnerPreviewCache.get(runner.id) };
	} catch {
		captureUnexpectedError(new Error("Runner preview read failed"), "runner-actions", "read-preview");
		return { success: false as const, code: "SERVICE_UNAVAILABLE" as const, error: "Preview unavailable. Please try again." };
	}
}

export async function connectRunnerStreamingProvider(input: unknown) {
	return runnerDestinationAction("connect-streaming-provider", async (principal) => {
		const { beginStreamingConnection } = await import("@/server/runner/provider-connections");
		return beginStreamingConnection(principal, input);
	});
}
export async function getRunnerStreamingConnections(ownerId: string) {
	return runnerDestinationAction("list-streaming-connections", async (principal) => {
		const { listStreamingConnections } = await import("@/server/runner/provider-connections");
		return listStreamingConnections(principal, ownerId);
	});
}
export async function disconnectRunnerStreamingProvider(input: unknown) {
	return runnerDestinationAction("disconnect-streaming-provider", async (principal) => {
		const { disconnectStreamingConnection } = await import("@/server/runner/provider-connections");
		return disconnectStreamingConnection(principal, input);
	});
}
export async function getRunnerYoutubeStreams(input: { ownerId: string; connectionId: string }) {
	return runnerDestinationAction("list-youtube-streams", async (principal) => {
		const parsed = z
			.object({ ownerId: z.string().min(1).max(255), connectionId: z.uuid() })
			.strict()
			.safeParse(input);
		if (!parsed.success) return { success: false as const, error: "Choose a connected channel.", code: "INVALID_INPUT" as const };
		const { authorizeLockedMutation } = await import("@/server/resources/mutation");
		const { withStreamingConnection } = await import("@/server/runner/provider-connections");
		const { fetchYoutubeStreams, ProviderRequestError } = await import("@/server/runner/provider-api");
		return db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, input.ownerId, "runner:update", tx);
			const streams = await withStreamingConnection(tx, input.ownerId, input.connectionId, async (context) => {
				if (context.provider !== "youtube") throw new ProviderRequestError("CHANNEL_UNAVAILABLE");
				return (await fetchYoutubeStreams(context)).map((stream) => ({ id: stream.id, name: stream.snippet.title }));
			});
			authority.assertAuthorityCurrent();
			if (!streams.success) return streams;
			return { success: true as const, streams: streams.value };
		});
	});
}

export async function searchRunnerTwitchCategories(input: { ownerId: string; connectionId: string; query: string }) {
	return runnerDestinationAction("search-twitch-categories", async (principal) => {
		const parsed = z
			.object({ ownerId: z.string().min(1).max(255), connectionId: z.uuid(), query: z.string().trim().min(2).max(100) })
			.strict()
			.safeParse(input);
		if (!parsed.success) return { success: false as const, error: "Enter at least two characters.", code: "INVALID_INPUT" as const };
		const { authorizeLockedMutation } = await import("@/server/resources/mutation");
		const { withStreamingConnection } = await import("@/server/runner/provider-connections");
		const { searchTwitchCategories } = await import("@/server/runner/provider-api");
		return db.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, input.ownerId, "runner:read", tx);
			const categories = await withStreamingConnection(tx, input.ownerId, input.connectionId, (context) => searchTwitchCategories(context, parsed.data.query));
			authority.assertAuthorityCurrent();
			if (!categories.success) return categories;
			return { success: true as const, categories: categories.value };
		});
	});
}
export async function uploadRunnerScheduleThumbnail(form: FormData) {
	return runnerDestinationAction("upload-schedule-thumbnail", async (principal) => {
		const file = form.get("file");
		if (!(file instanceof File) || !file.size || file.size > 2097152) return { success: false as const, error: "Choose an image no larger than 2 MiB.", code: "INVALID_INPUT" as const };
		const { storeRunnerBrandingAssetForPrincipal } = await import("@/server/runner/branding-assets");
		return storeRunnerBrandingAssetForPrincipal(principal, { ownerId: form.get("ownerId"), runnerId: form.get("runnerId"), kind: "background", bytes: new Uint8Array(await file.arrayBuffer()) });
	});
}

export async function startRunnerConnectionTest(input: unknown) {
	return runnerDestinationAction("start-connection-test", async (principal) => {
		const { startTwitchConnectionTest } = await import("@/server/runner/provider-test");
		return startTwitchConnectionTest(principal, input);
	});
}
export async function readRunnerConnectionTest(input: unknown) {
	return runnerDestinationAction("read-connection-test", async (principal) => {
		const { readTwitchConnectionTest } = await import("@/server/runner/provider-test");
		return readTwitchConnectionTest(principal, input);
	});
}
export async function stopRunnerConnectionTest(input: unknown) {
	return runnerDestinationAction("stop-connection-test", async (principal) => {
		const { readTwitchConnectionTest } = await import("@/server/runner/provider-test");
		return readTwitchConnectionTest(principal, input, true);
	});
}
