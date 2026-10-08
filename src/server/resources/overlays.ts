import "server-only";
import { listOverlayRecords, readOverlayRecord } from "./overlay-reads";
import { validateOwnedOverlayReward } from "./overlay-reward-validation";
import { enqueueOverlayRewardEffect } from "./overlay-effects";
import { lockOwnerProEntitlements } from "./entitlement-lock";
import { disconnectOverlaySources } from "@/app/store/overlaySubscribers";
import { buildOverlayUpdatePayload, browserOverlayPatchSchema } from "./overlay-configuration";
import { nextConfigurationRevision } from "./revisions";
import { resolveRetainedResourceAccess } from "@/server/entitlements/resource-access";
import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import type { DatabaseClient, TransactionClient } from "@/db/client";
import { usersTable, playlistsTable, auditEventsTable, creatorAccountsTable } from "@/db/schema";
import { resolveUserEntitlements } from "@lib/entitlements";
import { OverlayType, StatusOptions } from "@types";
import { authorizeLockedMutation } from "./mutation";
import { assertCreationQuota } from "./quota";
import { createWithRetry } from "./create-retry";
import { and, asc, eq } from "drizzle-orm";
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { db, type QueryClient } from "@/db/client";
import { overlaysTable } from "@/db/schema";
import { decodePageCursor, encodePageCursor } from "@/server/mcp/pagination";
import { overlayDto, toolInputSchemas, type ToolName } from "@/server/mcp/schemas";

/** Current backend membership is checked before querying even an empty page. */
export async function listOverlays(principal: TrustedCreatorPrincipal, rawInput: unknown, client: QueryClient = db) {
	const parsed = toolInputSchemas.list_overlays.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const context = `${principal.grantId}:${principal.generation}:${principal.authUserId}:list_overlays:${input.creatorId}`;
	const rows = await listOverlayRecords(input.creatorId, { principal, afterId: input.cursor ? () => decodePageCursor(input.cursor!, context) : undefined, limit: input.limit + 1 }, client);
	const items = rows.slice(0, input.limit).map(overlayDto);
	return { items, nextCursor: rows.length > input.limit ? encodePageCursor(items[items.length - 1].id, context) : null };
}

async function insertOverlay(client: TransactionClient, input: { creatorId: string; name?: string }) {
	const [owner] = await client.select().from(usersTable).where(eq(usersTable.id, input.creatorId)).limit(1);
	if (!owner) throw new Error("ACCESS_DENIED");
	const entitlements = await resolveUserEntitlements(owner, client);
	const [usage] = await client.select({ count: count() }).from(overlaysTable).where(eq(overlaysTable.ownerId, input.creatorId));
	assertCreationQuota(entitlements.effectivePlan, "overlay", usage.count);
	const [overlay] = await client
		.insert(overlaysTable)
		.values({ ownerId: input.creatorId, secret: randomUUID(), name: input.name ?? "New Overlay", status: StatusOptions.Active, type: OverlayType.Featured, playlistId: null })
		.returning();
	if (!overlay) throw new Error("SERVICE_UNAVAILABLE");
	return overlay;
}
/** Session and OAuth callers share authorization, creator locking, limits and insertion. */
export async function createOverlayForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.create_overlay.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		if (principal.kind === "oauth") return createWithRetry(tx, principal, "create_overlay", input, () => insertOverlay(tx, input));
		await authorizeLockedMutation(principal, input.creatorId, "overlay:create", tx);
		return insertOverlay(tx, input);
	});
}

/** Scope and current membership precede owner-bound lookup to avoid enumeration. */
export async function getOverlay(principal: TrustedCreatorPrincipal, rawInput: unknown, client: QueryClient = db) {
	const parsed = toolInputSchemas.get_overlay.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const { overlay: row } = await readOverlayRecord(input.overlayId, { principal, creatorId: input.creatorId }, client);
	return { overlay: overlayDto(row) };
}

/** Current authorization, retained-plan policy and optimistic revision share one transaction. */
export async function updateOverlayRecord(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db, auditTool: ToolName = "update_overlay") {
	const parsed = (principal.kind === "session" ? toolInputSchemas.update_overlay.extend({ patch: browserOverlayPatchSchema }) : toolInputSchemas.update_overlay).safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	if (principal.kind === "session" && "rewardId" in input.patch && typeof input.patch.rewardId === "string" && input.patch.rewardId) {
		const decision = await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "overlay:update", requiredEntitlement: "pro", client });
		if (!decision.allowed) throw new Error("ACCESS_DENIED");
		const [current] = await client
			.select()
			.from(overlaysTable)
			.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
			.limit(1);
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		if (input.patch.rewardId !== current.rewardId) await validateOwnedOverlayReward(input.creatorId, input.patch.rewardId);
	}
	const updated = await client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "overlay:update", tx);
		if (input.patch.playlistId) {
			const [playlist] = await tx
				.select({ id: playlistsTable.id })
				.from(playlistsTable)
				.where(and(eq(playlistsTable.id, input.patch.playlistId), eq(playlistsTable.ownerId, input.creatorId)))
				.limit(1)
				.for("update");
			if (!playlist) throw new Error("RESOURCE_UNAVAILABLE");
		}
		const [current] = await tx
			.select()
			.from(overlaysTable)
			.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		const revision = nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		const access = await resolveRetainedResourceAccess({ kind: "overlay", ownerId: input.creatorId, resourceId: current.id, client: tx });
		if (!access.update) throw new Error("FEATURE_RESTRICTED");
		const basicFields = new Set(["name", "status", "type", "playlistId"]);
		if (access.effectivePlan !== "pro" && Object.keys(input.patch).some((field) => !basicFields.has(field))) throw new Error("FEATURE_RESTRICTED");
		authorization.assertAuthorityCurrent();
		const [updated] = await tx
			.update(overlaysTable)
			.set({ ...buildOverlayUpdatePayload({ ...current, ...input.patch }, access.effectivePlan === "pro"), configurationRevision: revision })
			.where(eq(overlaysTable.id, current.id))
			.returning();
		if (principal.kind === "session" && "rewardId" in input.patch && updated.rewardId && updated.rewardId !== current.rewardId) {
			await enqueueOverlayRewardEffect(tx, { overlayId: updated.id, creatorId: updated.ownerId, rewardId: updated.rewardId, configurationRevision: revision });
		}
		await tx.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
			targetType: "overlay",
			targetId: current.id,
			action: principal.kind === "oauth" ? `sensitive-integration:mcp.${auditTool}` : "overlay.update",
			outcome: "success",
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { creatorId: input.creatorId, tool: auditTool, ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}), revision },
		});
		authorization.assertAuthorityCurrent();
		return updated;
	});
	if (updated.status === StatusOptions.Paused) disconnectOverlaySources(updated.id);
	return updated;
}

/** MCP only exposes the explicit safe configuration DTO. */
export async function updateOverlay(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db, auditTool: ToolName = "update_overlay") {
	return { overlay: overlayDto(await updateOverlayRecord(principal, rawInput, client, auditTool)) };
}

export async function deleteOverlay(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = toolInputSchemas.delete_overlay.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authorization = await authorizeLockedMutation(principal, input.creatorId, "overlay:delete", tx);
		const [current] = await tx
			.select()
			.from(overlaysTable)
			.where(and(eq(overlaysTable.id, input.overlayId), eq(overlaysTable.ownerId, input.creatorId)))
			.limit(1)
			.for("update");
		if (!current) throw new Error("RESOURCE_UNAVAILABLE");
		nextConfigurationRevision(current.configurationRevision, input.expectedRevision);
		authorization.assertAuthorityCurrent();
		await tx.delete(overlaysTable).where(eq(overlaysTable.id, current.id));
		await tx.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
			targetType: "overlay",
			targetId: current.id,
			action: principal.kind === "oauth" ? "sensitive-integration:mcp.delete_overlay" : "overlay.delete",
			outcome: "success",
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { creatorId: input.creatorId, tool: "delete_overlay", ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}), revision: current.configurationRevision },
		});
		authorization.assertAuthorityCurrent();
		return { deletedId: current.id };
	});
}

function normalizedOwnerVolume(creatorId: string, volume: number) {
	if (typeof creatorId !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(creatorId) || typeof volume !== "number" || !Number.isFinite(volume)) throw new Error("INVALID_INPUT");
	return Math.round(Math.max(0, Math.min(100, volume)));
}

async function writeOwnerOverlayVolume(tx: TransactionClient, creatorId: string, volume: number, actor: { principal?: TrustedCreatorPrincipal; actorTwitchUserId?: string }) {
	const [owner] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).limit(1).for("update");
	if (!owner || owner.disabled) throw new Error("ACCESS_DENIED");
	await lockOwnerProEntitlements(creatorId, tx);
	const entitlements = await resolveUserEntitlements(owner, tx);
	if (entitlements.effectivePlan !== "pro") throw new Error("FEATURE_RESTRICTED");
	const rows = await tx.select().from(overlaysTable).where(eq(overlaysTable.ownerId, creatorId)).orderBy(asc(overlaysTable.id)).for("update");
	if (!rows.length) throw new Error("RESOURCE_UNAVAILABLE");
	const correlationId = randomUUID();
	for (const row of rows) {
		const revision = nextConfigurationRevision(row.configurationRevision, row.configurationRevision);
		await tx.update(overlaysTable).set({ playerVolume: volume, configurationRevision: revision, updatedAt: new Date() }).where(eq(overlaysTable.id, row.id));
		await tx.insert(auditEventsTable).values({ actorUserId: actor.principal?.authUserId ?? null, actorSessionId: actor.principal?.sessionId ?? null, targetType: "overlay", targetId: row.id, action: actor.principal ? "overlay.volume.update" : "overlay.volume.chat", outcome: "success", correlationId, metadata: { creatorId, volume, revision, ...(actor.actorTwitchUserId ? { actorTwitchUserId: actor.actorTwitchUserId } : {}) } });
	}
	return volume;
}

/** Imperative browser volume commands invalidate every affected configuration draft. */
export async function updateOwnerOverlayVolume(principal: TrustedCreatorPrincipal, creatorId: string, rawVolume: number, client: DatabaseClient = db) {
	if (principal.kind !== "session") throw new Error("INVALID_INPUT");
	const volume = normalizedOwnerVolume(creatorId, rawVolume);
	return client.transaction(async (tx) => {
		await authorizeLockedMutation(principal, creatorId, "overlay:update", tx);
		return writeOwnerOverlayVolume(tx, creatorId, volume, { principal });
	});
}

/** Server-only entry for the privileged chat handler after signed EventSub verification.
 * Never forward this entry from a Server Action or register it as an MCP tool.
 */
export async function updateTrustedChatOverlayVolume(creatorId: string, rawVolume: number, actorTwitchUserId: string, client: DatabaseClient = db) {
	const volume = normalizedOwnerVolume(creatorId, rawVolume);
	if (typeof actorTwitchUserId !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(actorTwitchUserId)) throw new Error("INVALID_INPUT");
	return client.transaction(async (tx) => {
		const [account] = await tx.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, creatorId)).limit(1).for("update");
		if (!account || account.status !== "active") throw new Error("ACCESS_DENIED");
		return writeOwnerOverlayVolume(tx, creatorId, volume, { actorTwitchUserId });
	});
}
