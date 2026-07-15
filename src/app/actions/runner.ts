"use server";

import { db } from "@/db/client";
import { editorsTable, overlaysTable, runnersTable, usersTable } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { validateAuth } from "./auth";
import { redirect } from "next/navigation";
import { hasActiveEntitlement } from "@lib/entitlements";
import { Entitlement, RunnerStatus, StreamState } from "@types";
import { getRunnerVersionInfo } from "@lib/runnerArtifacts";

async function hasAccess(ownerId: string, userId: string) {
	if (ownerId === userId) return true;
	const editor = await db.query.editorsTable.findFirst({
		where: and(eq(editorsTable.userId, ownerId), eq(editorsTable.editorId, userId)),
	});
	return Boolean(editor);
}

function streamKeyRequiredForUrl(rtmpUrl: string) {
	return rtmpUrl === "rtmp://live.twitch.tv/app" || rtmpUrl === "rtmp://a.rtmp.youtube.com/live2";
}

async function ownerHasRunnerAccess(ownerId: string) {
	const owner = await db.query.usersTable.findFirst({ where: eq(usersTable.id, ownerId) });
	return Boolean(owner && (await hasActiveEntitlement(owner.id, Entitlement.RunnerAccess)));
}

export async function createRunner(ownerId: string, name: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return { success: false, error: "Unauthorized" };
		if (!(await ownerHasRunnerAccess(ownerId))) return { success: false, error: "Runner add-on required", code: "ENTITLEMENT_REQUIRED" as const };

		// Generate a secure random token for the runner to authenticate with
		const token = `cl_run_${randomBytes(24).toString("hex")}`;

		const [newRunner] = await db
			.insert(runnersTable)
			.values({
				ownerId,
				name,
				token,
			})
			.returning();

		revalidatePath("/dashboard/runners");
		return { success: true, runner: newRunner };
	} catch (error) {
		console.error("Failed to create runner:", error);
		return { success: false, error: "Failed to create runner" };
	}
}

export async function createOwnRunner(name: string) {
	try {
		const user = await validateAuth();
		if (!user) {
			redirect(`/auth?returnUrl=${encodeURIComponent("/runner/enroll")}`);
		}

		return await createRunner(user.id, name);
	} catch (error) {
		console.error("Failed to create own runner:", error);
		return { success: false, error: "Failed to create runner" };
	}
}

export async function deleteRunner(runnerId: string, ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return { success: false, error: "Unauthorized" };

		await db
			.delete(runnersTable)
			// Ensure only the owner can delete it (or admin check, omitted for prototype)
			.where(and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)));

		revalidatePath("/dashboard/runners");
		return { success: true };
	} catch (error) {
		console.error("Failed to delete runner:", error);
		return { success: false, error: "Failed to delete runner" };
	}
}

export async function unlinkRunner(runnerId: string, ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return { success: false, error: "Unauthorized" };

		const runner = await db.query.runnersTable.findFirst({
			where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)),
		});

		if (!runner) return { success: false, error: "Runner not found", code: "NOT_FOUND" as const };

		const revokedToken = `cl_run_${randomBytes(24).toString("hex")}`;
		await db
			.update(runnersTable)
			.set({
				token: revokedToken,
				bootstrapToken: null,
				status: RunnerStatus.Offline,
				lastHeartbeatAt: null,
			})
			.where(and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)));

		await db
			.update(streamSessionsTable)
			.set({
				desiredState: StreamState.Stopped,
			})
			.where(and(eq(streamSessionsTable.runnerId, runnerId), eq(streamSessionsTable.ownerId, ownerId)));

		revalidatePath("/dashboard/runners");
		revalidatePath(`/dashboard/runners/${runnerId}`);
		return { success: true };
	} catch (error) {
		console.error("Failed to unlink runner:", error);
		return { success: false, error: "Failed to unlink runner" };
	}
}

import { streamSessionsTable } from "@/db/schema";
import { encryptString } from "@/app/lib/encryption";
import type { StreamMode } from "@/app/lib/types";

export async function upsertStreamSession(data: { id?: string; ownerId: string; runnerId: string; overlayId: string; mode: StreamMode; streamKey: string; clearStreamKey?: boolean; rtmpUrl: string; resolution?: string; fps?: number }) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(data.ownerId, user.id))) return { success: false, error: "Unauthorized" };
		if (!(await ownerHasRunnerAccess(data.ownerId))) return { success: false, error: "Runner add-on required", code: "ENTITLEMENT_REQUIRED" as const };
		const [runner, overlay] = await Promise.all([db.query.runnersTable.findFirst({ where: and(eq(runnersTable.id, data.runnerId), eq(runnersTable.ownerId, data.ownerId)) }), db.query.overlaysTable.findFirst({ where: and(eq(overlaysTable.id, data.overlayId), eq(overlaysTable.ownerId, data.ownerId)) })]);
		if (!runner || !overlay) return { success: false, error: "Runner or overlay not found", code: "NOT_FOUND" as const };
		if (!data.rtmpUrl.trim()) return { success: false, error: "An RTMP URL is required", code: "RTMP_URL_REQUIRED" as const };

		if (streamKeyRequiredForUrl(data.rtmpUrl) && !data.streamKey && (!data.id || data.clearStreamKey)) return { success: false, error: "A stream key is required for Twitch or YouTube", code: "STREAM_KEY_REQUIRED" as const };
		if (data.id) {
			// Update existing
			const updatePayload: Record<string, unknown> = {
				runnerId: data.runnerId,
				overlayId: data.overlayId,
				mode: data.mode,
				rtmpUrl: data.rtmpUrl,
				resolution: data.resolution || "1080p",
				fps: data.fps || 60,
			};
			if (data.clearStreamKey) {
				updatePayload.encryptedStreamKey = null;
			} else if (data.streamKey) {
				updatePayload.encryptedStreamKey = encryptString(data.streamKey);
			}

			await db.update(streamSessionsTable).set(updatePayload).where(eq(streamSessionsTable.id, data.id));
		} else {
			// Insert new
			await db.insert(streamSessionsTable).values({
				ownerId: data.ownerId,
				runnerId: data.runnerId,
				overlayId: data.overlayId,
				mode: data.mode,
				encryptedStreamKey: data.streamKey ? encryptString(data.streamKey) : null,
				rtmpUrl: data.rtmpUrl,
				resolution: data.resolution || "1080p",
				fps: data.fps || 60,
			});
		}

		revalidatePath("/dashboard/runners");
		return { success: true };
	} catch (error) {
		console.error("Failed to upsert stream session:", error);
		return { success: false, error: "Failed to save stream session" };
	}
}

export async function setStreamDesiredState(sessionId: string, state: StreamState) {
	try {
		const user = await validateAuth();
		if (!user) return { success: false, error: "Unauthorized" };

		// Ensure the session belongs to the user or an editor
		const session = await db.query.streamSessionsTable.findFirst({ where: eq(streamSessionsTable.id, sessionId) });
		if (!session || !(await hasAccess(session.ownerId, user.id))) return { success: false, error: "Unauthorized" };
		if (!(await ownerHasRunnerAccess(session.ownerId))) return { success: false, error: "Runner add-on required", code: "ENTITLEMENT_REQUIRED" as const };
		if (state === StreamState.Running && streamKeyRequiredForUrl(session.rtmpUrl) && !session.encryptedStreamKey) return { success: false, error: "A stream key is required for Twitch or YouTube", code: "STREAM_KEY_REQUIRED" as const };

		await db.update(streamSessionsTable).set({ desiredState: state }).where(eq(streamSessionsTable.id, sessionId));

		revalidatePath("/dashboard/runners");
		return { success: true };
	} catch (error) {
		console.error("Failed to set stream state:", error);
		return { success: false, error: "Failed to set state" };
	}
}

export async function getAllRunners(ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return [];

		return await db.query.runnersTable.findMany({
			where: eq(runnersTable.ownerId, ownerId),
		});
	} catch (error) {
		console.error("Failed to fetch runners:", error);
		return [];
	}
}

export async function getAllStreamSessions(ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return [];

		return await db.query.streamSessionsTable.findMany({
			where: eq(streamSessionsTable.ownerId, ownerId),
		});
	} catch (error) {
		console.error("Failed to fetch stream sessions:", error);
		return [];
	}
}

export async function getRunner(runnerId: string, ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return null;

		return await db.query.runnersTable.findFirst({
			where: and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId)),
		});
	} catch (error) {
		console.error("Failed to fetch runner:", error);
		return null;
	}
}

export async function getRunnerVersionManifest() {
	return getRunnerVersionInfo();
}

export async function getStreamSessionsForRunner(runnerId: string, ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return [];

		return await db.query.streamSessionsTable.findMany({
			where: and(eq(streamSessionsTable.runnerId, runnerId), eq(streamSessionsTable.ownerId, ownerId)),
		});
	} catch (error) {
		console.error("Failed to fetch stream sessions for runner:", error);
		return [];
	}
}
