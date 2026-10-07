import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { auditEventsTable, mcpMutationRetriesTable, overlaysTable, playlistsTable } from "@/db/schema";
import { overlayDto, playlistDto, toolInputSchemas } from "@/server/mcp/schemas";
import { canonicalCreateDigest } from "@/server/mcp/retries";
import { authorizeLockedMutation } from "./mutation";

/** Caller owns the transaction. Resource, retained result and success audit commit together. */
export async function createWithRetry(client: TransactionClient, principal: TrustedCreatorPrincipal, tool: "create_overlay" | "create_playlist", rawInput: unknown, create: (client: TransactionClient) => Promise<unknown>) {
	const parsed = toolInputSchemas[tool].safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const authorization = await authorizeLockedMutation(principal, input.creatorId, tool === "create_overlay" ? "overlay:create" : "playlist:create", client);
	const project = tool === "create_overlay" ? overlayDto : playlistDto;
	const resources = tool === "create_overlay" ? overlaysTable : playlistsTable;
	if (principal.kind !== "oauth" || !principal.grantId || !principal.generation || !principal.clientId) throw new Error("AUTHENTICATION_REQUIRED");
	const digest = canonicalCreateDigest(tool, input);
	const identity = { grantId: principal.grantId, grantGeneration: principal.generation, authUserId: principal.authUserId, clientId: principal.clientId, creatorId: input.creatorId, toolName: tool, retryKey: input.retryKey };
	const [previous] = await client
		.select()
		.from(mcpMutationRetriesTable)
		.where(and(eq(mcpMutationRetriesTable.grantId, identity.grantId), eq(mcpMutationRetriesTable.grantGeneration, identity.grantGeneration), eq(mcpMutationRetriesTable.authUserId, identity.authUserId), eq(mcpMutationRetriesTable.clientId, identity.clientId), eq(mcpMutationRetriesTable.creatorId, identity.creatorId), eq(mcpMutationRetriesTable.toolName, identity.toolName), eq(mcpMutationRetriesTable.retryKey, identity.retryKey)))
		.limit(1);
	const now = new Date();
	let result: ReturnType<typeof overlayDto> | ReturnType<typeof playlistDto>;
	let replayed = false;
	authorization.assertAuthorityCurrent();
	if (previous && previous.expiresAt > now) {
		if (previous.inputDigest !== digest) throw new Error("RETRY_CONFLICT");
		const [resource] = await client
			.select({ id: resources.id })
			.from(resources)
			.where(and(eq(resources.id, previous.resourceId), eq(resources.ownerId, input.creatorId)))
			.limit(1);
		if (!resource) throw new Error("RESOURCE_UNAVAILABLE");
		result = project({ ...previous.safeResponse, ownerId: previous.safeResponse.creatorId });
		replayed = true;
	} else {
		if (previous) await client.delete(mcpMutationRetriesTable).where(eq(mcpMutationRetriesTable.id, previous.id));
		result = project(await create(client));
		if (result.creatorId !== input.creatorId) throw new Error("SERVICE_UNAVAILABLE");
		await client.insert(mcpMutationRetriesTable).values({ ...identity, inputDigest: digest, safeResponse: result, resourceId: result.id, createdAt: now, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
	}
	await client.insert(auditEventsTable).values({ actorUserId: principal.authUserId, targetType: tool === "create_overlay" ? "overlay" : "playlist", targetId: result.id, action: `sensitive-integration:mcp.${tool}`, outcome: "success", correlationId: randomUUID(), occurredAt: new Date(), metadata: { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation, creatorId: input.creatorId, tool, replayed } });
	authorization.assertAuthorityCurrent();
	return result;
}
