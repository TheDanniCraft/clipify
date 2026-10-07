import { Entitlement } from "@types";
import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { and, eq, asc, isNull, or } from "drizzle-orm";
import { db, type DatabaseClient, type TransactionClient } from "@/db/client";
import { auditEventsTable, mcpMutationRetriesTable, entitlementGrantsTable, agencyLicenseAllocationsTable, galleriesTable, runnersTable, streamSessionsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { resolveUserEntitlements } from "@lib/entitlements";
import { authorizeLockedMutation } from "./mutation";
import { workflowInputSchemas, type WorkflowToolName } from "@/server/mcp/workflows/schemas";
import { workflowPermissions, workflowAnnotations } from "@/server/mcp/workflows/catalogue";
export type WorkflowContext = { tx: TransactionClient; principal: TrustedCreatorPrincipal; creatorId: string; pro: boolean; runnerAccess: boolean; assertCurrent: () => void };
export async function workflowOperation<T extends WorkflowToolName>(principal: TrustedCreatorPrincipal, tool: T, rawInput: unknown, operation: (input: ReturnType<(typeof workflowInputSchemas)[T]["parse"]>, context: WorkflowContext) => Promise<Record<string, unknown>>, client: DatabaseClient = db) {
	const parsed = workflowInputSchemas[tool].safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	return client.transaction(async (tx) => {
		const authority = await authorizeLockedMutation(principal, input.creatorId, workflowPermissions[tool], tx);
		if (tool.includes("runner") || tool.includes("stream_session")) {
			await tx
				.select({ id: entitlementGrantsTable.id })
				.from(entitlementGrantsTable)
				.where(and(eq(entitlementGrantsTable.entitlement, Entitlement.RunnerAccess), or(eq(entitlementGrantsTable.userId, input.creatorId), isNull(entitlementGrantsTable.userId))))
				.orderBy(asc(entitlementGrantsTable.id))
				.for("share");
			await tx
				.select({ id: agencyLicenseAllocationsTable.id })
				.from(agencyLicenseAllocationsTable)
				.where(and(eq(agencyLicenseAllocationsTable.creatorId, input.creatorId), eq(agencyLicenseAllocationsTable.product, "runner")))
				.orderBy(asc(agencyLicenseAllocationsTable.id))
				.for("share");
		}
		const entitlements = await resolveUserEntitlements(authority.creator, tx);
		const remote = ["get_overlay_runtime", "get_overlay_queues", "control_overlay", "enqueue_overlay_clip", "clear_overlay_queue"].includes(tool);
		if (remote && !entitlements.proAccess) throw new Error("FEATURE_RESTRICTED");
		if (["get_runner_setup", "create_runner", "configure_stream_session", "control_stream_session"].includes(tool) && !entitlements.runnerAccess) throw new Error("FEATURE_RESTRICTED");
		const context: WorkflowContext = { tx, principal, creatorId: input.creatorId, pro: entitlements.proAccess, runnerAccess: entitlements.runnerAccess, assertCurrent: authority.assertAuthorityCurrent };
		authority.assertAuthorityCurrent();
		const result = await operation(input as ReturnType<(typeof workflowInputSchemas)[T]["parse"]>, context);
		authority.assertAuthorityCurrent();
		if (!workflowAnnotations(tool).readOnlyHint) {
			const selectors = input as { overlayId?: string; playlistId?: string; galleryId?: string; runnerId?: string; sessionId?: string };
			const targetId = tool.includes("stream_session") ? (selectors.sessionId ?? (typeof result.id === "string" ? result.id : input.creatorId)) : (selectors.overlayId ?? selectors.playlistId ?? selectors.galleryId ?? selectors.runnerId ?? (typeof result.id === "string" ? result.id : input.creatorId));
			await tx.insert(auditEventsTable).values({
				actorUserId: principal.authUserId,
				...(principal.kind === "session" ? { actorSessionId: principal.sessionId } : {}),
				targetType: tool.includes("gallery") ? "gallery" : tool.includes("playlist") ? "playlist" : tool.includes("overlay") ? "overlay" : tool.includes("runner") ? "runner" : tool.includes("stream_session") ? "stream_session" : "creator",
				targetId,
				action: principal.kind === "oauth" ? `sensitive-integration:mcp.${tool}` : `workflow.${tool}`,
				outcome: "success",
				correlationId: randomUUID(),
				occurredAt: new Date(),
				metadata: { creatorId: input.creatorId, tool, ...(principal.kind === "oauth" ? { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation } : {}) },
			});
		}
		authority.assertAuthorityCurrent();
		return result;
	});
}
/** Replay identity includes the original grant, generation, actor and client. Caller holds policy locks. */
export async function workflowRetry(context: WorkflowContext, tool: WorkflowToolName, input: Record<string, unknown>, operation: () => Promise<Record<string, unknown>>) {
	const { tx, principal, creatorId } = context;
	if (principal.kind === "session") return operation();
	if (principal.kind !== "oauth" || !principal.grantId || !principal.generation || !principal.clientId) throw new Error("AUTHENTICATION_REQUIRED");
	const retryKey = input.retryKey;
	if (typeof retryKey !== "string") throw new Error("INVALID_INPUT");
	const identity = { grantId: principal.grantId, grantGeneration: principal.generation, authUserId: principal.authUserId, clientId: principal.clientId, creatorId, toolName: tool, retryKey };
	const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
	const [previous] = await tx
		.select()
		.from(mcpMutationRetriesTable)
		.where(and(eq(mcpMutationRetriesTable.grantId, identity.grantId), eq(mcpMutationRetriesTable.grantGeneration, identity.grantGeneration), eq(mcpMutationRetriesTable.authUserId, identity.authUserId), eq(mcpMutationRetriesTable.clientId, identity.clientId), eq(mcpMutationRetriesTable.creatorId, creatorId), eq(mcpMutationRetriesTable.toolName, tool), eq(mcpMutationRetriesTable.retryKey, retryKey)))
		.limit(1);
	if (previous && previous.expiresAt > new Date()) {
		if (previous.inputDigest !== digest) throw new Error("RETRY_CONFLICT");
		const table = tool === "create_gallery" ? galleriesTable : tool === "create_runner" ? runnersTable : tool === "configure_stream_session" ? streamSessionsTable : null;
		if (table) {
			const [resource] = await tx
				.select({ id: table.id })
				.from(table)
				.where(and(eq(table.id, previous.resourceId), eq(table.ownerId, creatorId)))
				.limit(1)
				.for("share");
			if (!resource) throw new Error("RESOURCE_UNAVAILABLE");
		}
		return previous.safeResponse;
	}
	if (previous) await tx.delete(mcpMutationRetriesTable).where(eq(mcpMutationRetriesTable.id, previous.id));
	const result = JSON.parse(JSON.stringify(await operation())) as Record<string, unknown>;
	const resourceId = typeof result.id === "string" ? result.id : typeof input.playlistId === "string" ? input.playlistId : typeof input.overlayId === "string" ? input.overlayId : undefined;
	if (!resourceId) throw new Error("SERVICE_UNAVAILABLE");
	await tx.insert(mcpMutationRetriesTable).values({ ...identity, inputDigest: digest, resourceId, safeResponse: result, createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
	return result;
}
