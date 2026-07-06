"use server";

import { db } from "@/db/client";
import { runnersTable } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { validateAuth } from "./auth";
import { getEditorAccess } from "./database";

async function hasAccess(ownerId: string, userId: string) {
	if (ownerId === userId) return true;
	const editorRows = await getEditorAccess(ownerId);
	if (!editorRows) return false;
	return editorRows.some(e => e.editorId === userId);
}

export async function createRunner(ownerId: string, name: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return { success: false, error: "Unauthorized" };

		// Generate a secure random token for the runner to authenticate with
		const token = `cl_run_${randomBytes(24).toString("hex")}`;

		const [newRunner] = await db.insert(runnersTable)
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

export async function deleteRunner(runnerId: string, ownerId: string) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(ownerId, user.id))) return { success: false, error: "Unauthorized" };

		await db.delete(runnersTable)
			// Ensure only the owner can delete it (or admin check, omitted for prototype)
			.where(and(eq(runnersTable.id, runnerId), eq(runnersTable.ownerId, ownerId))); 

		revalidatePath("/dashboard/runners");
		return { success: true };
	} catch (error) {
		console.error("Failed to delete runner:", error);
		return { success: false, error: "Failed to delete runner" };
	}
}

import { streamSessionsTable } from "@/db/schema";
import { encryptString } from "@/app/lib/encryption";
import type { StreamMode, StreamState } from "@/app/lib/types";

export async function upsertStreamSession(data: {
	id?: string;
	ownerId: string;
	runnerId: string;
	overlayId: string;
	mode: StreamMode;
	streamKey: string;
	rtmpUrl: string;
	resolution?: string;
	fps?: number;
}) {
	try {
		const user = await validateAuth();
		if (!user || !(await hasAccess(data.ownerId, user.id))) return { success: false, error: "Unauthorized" };

		if (data.id) {
			// Update existing
			const updatePayload: any = {
				runnerId: data.runnerId,
				overlayId: data.overlayId,
				mode: data.mode,
				rtmpUrl: data.rtmpUrl,
				resolution: data.resolution || "1080p",
				fps: data.fps || 60,
			};
			if (data.streamKey) {
				updatePayload.encryptedStreamKey = encryptString(data.streamKey);
			}

			await db.update(streamSessionsTable)
				.set(updatePayload)
				.where(eq(streamSessionsTable.id, data.id));
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

		await db.update(streamSessionsTable)
			.set({ desiredState: state })
			.where(eq(streamSessionsTable.id, sessionId));

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
