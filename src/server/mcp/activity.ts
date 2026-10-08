import "server-only";
import { randomUUID } from "node:crypto";
import { db, type QueryClient } from "@/db/client";
import { and, or, eq, lt, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { user as authUser, oauthClient } from "@/db/auth-schema";
import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
import { encodePageCursor, decodePageCursor } from "./pagination";
import { toolInputSchemas } from "./schemas";
import { toolPermissions } from "./permissions";
import type { McpActivityPage } from "@lib/mcpConnection";
import { auditEventsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import type { ToolName } from "./schemas";

/** Explicit fields only: neither payloads nor denied target selectors enter activity. */
export async function recordMcpCallActivity(principal: TrustedCreatorPrincipal, input: { tool?: ToolName; outcome: "success" | "denied" | "error"; reason?: string; creatorId?: string; targetType?: string; targetId?: string }, client: QueryClient = db) {
	if (principal.kind !== "oauth" || !principal.clientId || !principal.grantId) throw new Error("AUTHENTICATION_REQUIRED");
	const success = input.outcome === "success";
	try {
		await client.insert(auditEventsTable).values({
			actorUserId: principal.authUserId,
			targetType: success ? (input.targetType ?? "mcp_connection") : "mcp_connection",
			targetId: success ? (input.targetId ?? null) : null,
			action: `sensitive-integration:mcp.${input.tool ?? "unavailable_tool"}`,
			outcome: input.outcome,
			reason: input.reason,
			correlationId: randomUUID(),
			occurredAt: new Date(),
			metadata: { clientId: principal.clientId, grantId: principal.grantId, generation: principal.generation, ...(input.tool ? { tool: input.tool } : {}), ...(success && input.creatorId ? { creatorId: input.creatorId } : {}) },
		});
	} catch {
		throw new Error("SERVICE_UNAVAILABLE");
	}
}

const activityInput = z.object({ creatorId: toolInputSchemas.get_capabilities.shape.creatorId, limit: z.number().int().min(1).max(100).default(25), cursor: z.string().min(1).max(2048).optional() }).strict();
const activityPosition = z.object({ id: z.uuid(), time: z.string().datetime() }).strict();
const activityReasons = new Set(["INVALID_INPUT", "ACCESS_DENIED", "RESOURCE_UNAVAILABLE", "FEATURE_RESTRICTED", "PLAN_LIMIT_REACHED", "CONFLICT", "RETRY_CONFLICT", "RATE_LIMITED", "SERVICE_UNAVAILABLE", "MISSING_SCOPE"]);

export async function listMcpActivity(principal: TrustedCreatorPrincipal, rawInput: unknown, client: QueryClient = db): Promise<McpActivityPage> {
	const parsed = activityInput.safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const access = await authorizeTrustedCreatorOperation({ principal, creatorId: input.creatorId, permission: "audit:read", client });
	if (!access.allowed) throw new Error("ACCESS_DENIED");
	const context = `${principal.authUserId}:mcp_activity:${input.creatorId}`;
	let position: z.infer<typeof activityPosition> | undefined;
	if (input.cursor) {
		try {
			position = activityPosition.parse(JSON.parse(decodePageCursor(input.cursor, context)));
		} catch {
			throw new Error("INVALID_INPUT");
		}
	}
	const creatorScope = sql`(
  ${auditEventsTable.metadata}->>'creatorId'=${input.creatorId}
  OR ((${auditEventsTable.outcome}<>'success' OR ${auditEventsTable.metadata}->>'tool'='list_creators')
   AND EXISTS (SELECT 1 FROM mcp_grant_creators targets WHERE targets.creator_id=${input.creatorId} AND targets.grant_id::text=${auditEventsTable.metadata}->>'grantId'))
 )`;
	const cursorFilter = position ? or(lt(auditEventsTable.occurredAt, sql`${position.time}::timestamptz`), and(eq(auditEventsTable.occurredAt, sql`${position.time}::timestamptz`), lt(auditEventsTable.id, position.id))) : undefined;
	const rows = await client
		.select({
			id: auditEventsTable.id,
			occurredAt: sql<string>`to_char(${auditEventsTable.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
			actorId: auditEventsTable.actorUserId,
			actorName: authUser.name,
			clientId: sql<string | null>`CASE WHEN jsonb_typeof(${auditEventsTable.metadata}->'clientId')='string' THEN ${auditEventsTable.metadata}->>'clientId' END`,
			clientName: oauthClient.name,
			tool: sql<string | null>`${auditEventsTable.metadata}->>'tool'`,
			outcome: auditEventsTable.outcome,
			reason: auditEventsTable.reason,
		})
		.from(auditEventsTable)
		.leftJoin(authUser, eq(authUser.id, auditEventsTable.actorUserId))
		.leftJoin(oauthClient, sql`${oauthClient.clientId}=${auditEventsTable.metadata}->>'clientId'`)
		.where(and(sql`${auditEventsTable.action} LIKE 'sensitive-integration:mcp.%'`, creatorScope, cursorFilter))
		.orderBy(desc(auditEventsTable.occurredAt), desc(auditEventsTable.id))
		.limit(input.limit + 1);
	const page = rows.slice(0, input.limit);
	const items = page.map((row) => ({ id: row.id, occurredAt: row.occurredAt, actor: { id: row.actorId, name: row.actorName ?? "Deleted account" }, client: { id: row.clientId, name: row.clientName ?? "Unavailable app" }, creator: { id: input.creatorId, name: access.creator.username }, tool: row.tool && Object.hasOwn(toolPermissions, row.tool) ? row.tool : "unavailable_tool", outcome: row.outcome, reason: row.reason && activityReasons.has(row.reason) ? row.reason : null }));
	const last = page.at(-1);
	return { items, nextCursor: rows.length > input.limit && last ? encodePageCursor(JSON.stringify({ id: last.id, time: last.occurredAt }), context) : null };
}
