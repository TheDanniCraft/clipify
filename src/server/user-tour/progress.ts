import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, type DatabaseClient } from "@/db/client";
import { userContentStatesTable, overlaysTable, playlistsTable, playlistClipsTable } from "@/db/schema";
import { defaultProgress, hasCompletedCoreGuide, guideContentKey, parseProgress, transition, type GuideEvent, type GuideProgress } from "@lib/userTour";

/** Reuse account content state; no onboarding schema or generated migration is needed. */
async function transactProgress(userId: string, event?: GuideEvent, client: DatabaseClient = db) {
	return client.transaction(async (tx) => {
		const inserted = await tx
			.insert(userContentStatesTable)
			.values({ userId, contentKey: guideContentKey, state: JSON.stringify(defaultProgress()), stateUntil: null, updatedAt: new Date() })
			.onConflictDoNothing()
			.returning({ userId: userContentStatesTable.userId });
		const [row] = await tx
			.select({ state: userContentStatesTable.state })
			.from(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, userId), eq(userContentStatesTable.contentKey, guideContentKey)))
			.for("update");
		let progress = parseProgress(row.state, false);
		if (inserted.length || !event) {
			const [overlay] = await tx
				.select({ id: overlaysTable.id, name: overlaysTable.name, type: overlaysTable.type })
				.from(overlaysTable)
				.where(eq(overlaysTable.ownerId, userId))
				.orderBy(sql`${overlaysTable.id}::text = ${progress.overlayId ?? ""} DESC`, overlaysTable.createdAt)
				.limit(1);
			const [playlist] = await tx
				.select({ id: playlistsTable.id, name: playlistsTable.name })
				.from(playlistsTable)
				.where(eq(playlistsTable.ownerId, userId))
				.orderBy(sql`${playlistsTable.id}::text = ${progress.playlistId ?? ""} DESC`, playlistsTable.createdAt)
				.limit(1);
			if (progress.overlayId !== (overlay?.id ?? null)) progress.copiedOverlayId = null;
			progress.overlayId = overlay?.id ?? null;
			progress.playlistSource = overlay?.type === "Playlist";
			progress.playlistId = playlist?.id ?? null;
			if (progress.active && ((!overlay && (progress.active.task.startsWith("overlay.") || progress.active.task.startsWith("appearance.") || progress.active.task === "playlist.use")) || (!playlist && progress.active.task.startsWith("playlist.")))) {
				progress.active = { ...progress.active, index: 0, navigation: [], navigationTotal: 0, paused: true };
			}
			if (inserted.length) {
				if (overlay) {
					if (overlay.name.trim()) progress.completed.push("overlay.name");
					progress.completed.push("overlay.source");
				}
				if (playlist) {
					if (playlist.name.trim()) progress.completed.push("playlist.name");
					const [clip] = await tx.select({ clipId: playlistClipsTable.clipId }).from(playlistClipsTable).where(eq(playlistClipsTable.playlistId, playlist.id)).limit(1);
					if (clip) progress.completed.push("playlist.clips");
				}
				progress.minimized = Boolean(overlay || playlist);
				progress.welcomeSeen = Boolean(overlay || playlist);
			}
		}
		if (event) progress = transition(progress, event, userId);
		// Award once, independently of replay, restored checkboxes or later optional tasks.
		if (!progress.expertAwardedAt && hasCompletedCoreGuide(progress)) progress.expertAwardedAt = new Date().toISOString();
		const serialized = JSON.stringify(progress);
		if (serialized !== row.state)
			await tx
				.update(userContentStatesTable)
				.set({ state: serialized, updatedAt: new Date() })
				.where(and(eq(userContentStatesTable.userId, userId), eq(userContentStatesTable.contentKey, guideContentKey)));
		return { progress, importLegacy: Boolean(inserted.length) };
	});
}
export async function loadUserTourProgress(userId: string, client: DatabaseClient = db) {
	const result = await transactProgress(userId, undefined, client);
	return { ...result, progress: { ...result.progress, active: result.progress.active ? { ...result.progress.active, paused: true } : null } satisfies GuideProgress };
}
export async function applyUserTourEvent(userId: string, event: GuideEvent, client: DatabaseClient = db) {
	return (await transactProgress(userId, event, client)).progress;
}
