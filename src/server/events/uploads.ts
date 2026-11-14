import "server-only";
import { hasTeamDataNominees } from "@/app/lib/eventConfiguration";
import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { awardAssetsTable as assets, awardSubmissionsTable as submissions, eventConnectionsTable as connections } from "@/db/schema";
import { lockPublicAwardEvent, awardPhase, commitAwardSubmission } from "./submissions";
import { uploadInputSchema } from "./upload-policy";
import { allocateAwardUpload, writeAwardUpload, deleteAwardUpload } from "./upload-provider";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { commitAwardTeamCandidate, isAwardReviewOpen } from "./review";
import { EventError, eventError } from "./persistence";
type TeamUploadContext = { principal: TrustedCreatorPrincipal; ownerId: string };
type PublicUploadResult = Awaited<ReturnType<typeof commitAwardSubmission>> | ReturnType<typeof eventError>;
type TeamUploadResult = ({ ok: true } & Awaited<ReturnType<typeof commitAwardTeamCandidate>>) | ReturnType<typeof eventError>;
export function acceptAwardUpload(authUserId: string, eventId: string, categoryId: string, raw: unknown, body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<PublicUploadResult>;
export function acceptAwardUpload(authUserId: string, eventId: string, categoryId: string, raw: unknown, body: ReadableStream<Uint8Array>, signal: AbortSignal, team: TeamUploadContext): Promise<TeamUploadResult>;
export async function acceptAwardUpload(authUserId: string, eventId: string, categoryId: string, raw: unknown, body: ReadableStream<Uint8Array>, signal: AbortSignal, team?: TeamUploadContext) {
	const uploadSignal = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
	const parsed = uploadInputSchema.safeParse(raw);
	if (!authUserId || !parsed.success) return eventError(new EventError("INVALID_INPUT"));
	let asset: typeof assets.$inferSelect | undefined, connection: typeof connections.$inferSelect | undefined, key: string | undefined;
	try {
		const reserved = await db.transaction(async (tx) => {
			if (team && team.principal.authUserId !== authUserId) throw new EventError("ACCESS_DENIED");
			const authority = team ? await authorizeLockedMutation(team.principal, team.ownerId, "event:review", tx) : undefined;
			const event = await lockPublicAwardEvent(tx, eventId);
			if (team && event.ownerId !== team.ownerId) throw new EventError("ACCESS_DENIED");
			if (team ? !isAwardReviewOpen(event, new Date()) : awardPhase(event, new Date()) !== "submissions") throw new EventError("PHASE_CLOSED");
			const category = event.configuration.categories.find((c) => c.id === categoryId);
			if (!category || (!team && category.selection !== "audience") || (category.selection === "data" && (!team || !hasTeamDataNominees(category))) || !["image", "audio", "video"].includes(category.source) || !parsed.data.mime.startsWith(`${category.source}/`)) throw new EventError("INVALID_INPUT");
			const active = team
				? []
				: await tx
						.select({ id: submissions.id })
						.from(submissions)
						.where(and(eq(submissions.eventId, eventId), eq(submissions.categoryId, categoryId), eq(submissions.authUserId, authUserId), isNull(submissions.withdrawnAt)));
			const pending = await tx
				.select({ id: assets.id })
				.from(assets)
				.where(and(eq(assets.eventId, eventId), eq(assets.categoryId, categoryId), eq(assets.authUserId, authUserId), eq(assets.state, "pending"), gt(assets.createdAt, new Date(Date.now() - 600000))));
			if (pending.length || (!team && category.submissionLimit !== null && active.length + pending.length >= category.submissionLimit)) throw new EventError("LIMIT_REACHED");
			const [storage] = await tx
				.select()
				.from(connections)
				.where(and(eq(connections.id, event.configuration.storageConnectionId ?? randomUUID()), eq(connections.ownerId, event.ownerId), eq(connections.connected, true), inArray(connections.provider, ["s3", "drive"])))
				.limit(1);
			if (!storage) throw new EventError("STORAGE_REQUIRED");
			const [row] = await tx
				.insert(assets)
				.values({ eventId, categoryId, authUserId, connectionId: storage.id, ...parsed.data })
				.returning();
			authority?.assertAuthorityCurrent();
			return { asset: row, connection: storage };
		});
		asset = reserved.asset;
		connection = reserved.connection;
		key = await allocateAwardUpload(connection, asset.id, parsed.data.mime, uploadSignal);
		await db.update(assets).set({ providerKey: key, updatedAt: new Date() }).where(eq(assets.id, asset.id));
		await writeAwardUpload(connection, key, parsed.data, body, uploadSignal);
		uploadSignal.throwIfAborted();
		const content = { kind: parsed.data.mime.split("/")[0], title: parsed.data.title, description: parsed.data.description, reference: asset.id, storageAssetId: asset.id, mediaUrl: `/api/events/${eventId}/media/${asset.id}` };
		return await db.transaction(async (tx) => {
			const result = team ? { ok: true as const, ...(await commitAwardTeamCandidate(tx, team.principal, team.ownerId, eventId, categoryId, content)) } : await commitAwardSubmission(tx, authUserId, eventId, categoryId, content);
			const [finished] = await tx
				.update(assets)
				.set({ state: "completed", updatedAt: new Date() })
				.where(and(eq(assets.id, asset!.id), eq(assets.state, "pending")))
				.returning();
			if (!finished) throw new EventError("CONFLICT");
			return result;
		});
	} catch (error) {
		if (asset) {
			let removed = !key;
			if (key && connection) {
				try {
					await deleteAwardUpload(connection, key);
					removed = true;
				} catch {
					await db.update(assets).set({ state: "cleanup", providerKey: key, updatedAt: new Date() }).where(eq(assets.id, asset.id));
				}
			}
			if (removed) await db.delete(assets).where(eq(assets.id, asset.id));
		}
		return eventError(error);
	}
}

export async function cleanupAwardUploads(now = new Date()) {
	let removed = 0,
		failed = 0;
	for (let index = 0; index < 20; index++) {
		const result = await db.transaction(async (tx) => {
			const [asset] = await tx
				.select()
				.from(assets)
				.where(and(inArray(assets.state, ["pending", "cleanup"]), lt(assets.updatedAt, new Date(now.getTime() - 600000))))
				.limit(1)
				.for("update", { skipLocked: true });
			if (!asset) return null;
			const [connection] = await tx.select().from(connections).where(eq(connections.id, asset.connectionId)).limit(1);
			try {
				if (asset.providerKey) {
					if (!connection) throw new EventError("STORAGE_REQUIRED");
					await deleteAwardUpload(connection, asset.providerKey);
				}
				await tx.delete(assets).where(eq(assets.id, asset.id));
				return true;
			} catch {
				await tx.update(assets).set({ state: "cleanup", updatedAt: now }).where(eq(assets.id, asset.id));
				return false;
			}
		});
		if (result === null) break;
		if (result) removed++;
		else failed++;
	}
	return { removed, failed };
}
