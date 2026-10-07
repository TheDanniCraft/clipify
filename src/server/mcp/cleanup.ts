import "server-only";
import { sql } from "drizzle-orm";
import { db, type DatabaseClient } from "@/db/client";

/** Each sweep is bounded and skips live row locks; retries are safe across replicas. */
export async function pruneMcpOperationalRecords(input: { now?: Date; batchSize?: number } = {}, client: DatabaseClient = db) {
	const now = input.now ?? new Date();
	const batchSize = input.batchSize ?? 100;
	if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("INVALID_INPUT");
	const unusedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	return client.transaction(async (tx) => {
		const clients = await tx.execute(sql`
   WITH candidates AS (
    SELECT c.id FROM auth.oauth_client c
    WHERE c.created_at <= ${unusedCutoff} AND c.user_id IS NULL
     AND c.client_discovery_id IS NULL AND c.skip_consent IS DISTINCT FROM true
     AND NOT EXISTS (SELECT 1 FROM auth.oauth_consent consent WHERE consent.client_id=c.client_id)
     AND NOT EXISTS (SELECT 1 FROM mcp_connection_grants grants WHERE grants.client_id=c.client_id)
     AND NOT EXISTS (SELECT 1 FROM auth.oauth_access_token tokens WHERE tokens.client_id=c.client_id)
     AND NOT EXISTS (SELECT 1 FROM auth.oauth_refresh_token tokens WHERE tokens.client_id=c.client_id)
    ORDER BY c.created_at,c.id LIMIT ${batchSize} FOR UPDATE OF c SKIP LOCKED
   ) DELETE FROM auth.oauth_client c USING candidates WHERE c.id=candidates.id RETURNING c.id
  `);
		const retries = await tx.execute(sql`
   WITH candidates AS (
    SELECT id FROM mcp_mutation_retries WHERE expires_at <= ${now}
    ORDER BY expires_at,id LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
   ) DELETE FROM mcp_mutation_retries r USING candidates WHERE r.id=candidates.id RETURNING r.id
  `);
		const counters = await tx.execute(sql`
   WITH candidates AS (
    SELECT id FROM rate_limit_counters WHERE action LIKE 'mcp:%' AND expires_at <= ${now}
    ORDER BY expires_at,id LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
   ) DELETE FROM rate_limit_counters c USING candidates WHERE c.id=candidates.id RETURNING c.id
  `);
		return { clients: clients.rows.length, retries: retries.rows.length, counters: counters.rows.length };
	});
}

/** Durable revoked grants retain cleanup intent until every credential is gone. */
export async function pruneRevokedMcpCredentials(input: { batchSize?: number } = {}, client: DatabaseClient = db) {
	const batchSize = input.batchSize ?? 100;
	if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("INVALID_INPUT");
	return client.transaction(async (tx) => {
		const counts = { accessTokens: 0, refreshTokens: 0, consents: 0 };
		for (const [table, key] of [
			["oauth_access_token", "accessTokens"],
			["oauth_refresh_token", "refreshTokens"],
			["oauth_consent", "consents"],
		] as const) {
			const identifier = sql`${sql.identifier("auth")}.${sql.identifier(table)}`;
			// A refresh token must not cascade-delete access rows beyond this batch.
			const safeRefresh = table === "oauth_refresh_token" ? sql`AND NOT EXISTS (SELECT 1 FROM auth.oauth_access_token a WHERE a.refresh_id=t.id)` : sql``;
			const result = await tx.execute(sql`
    WITH candidates AS (
     SELECT t.id FROM ${identifier} t
     JOIN mcp_connection_grants g ON g.id::text=t.reference_id AND g.auth_user_id=t.user_id AND g.client_id=t.client_id
     WHERE g.active=false AND g.revoked_at IS NOT NULL ${safeRefresh}
     ORDER BY t.created_at,t.id LIMIT ${batchSize} FOR UPDATE OF t SKIP LOCKED
    ) DELETE FROM ${identifier} t USING candidates WHERE t.id=candidates.id RETURNING t.id
   `);
			counts[key] = result.rows.length;
		}
		return counts;
	});
}

/** Operational MCP activity only; preserve independent security and billing audit retention. */
export async function pruneMcpActivity(input: { now?: Date; batchSize?: number } = {}, client: DatabaseClient = db) {
	const now = input.now ?? new Date();
	const batchSize = input.batchSize ?? 100;
	const configuredDays = process.env.MCP_ACTIVITY_RETENTION_DAYS;
	const days = configuredDays === undefined ? 90 : Number(configuredDays);
	const cutoff = new Date(now.getTime() - days * 86400000);
	if (!Number.isFinite(now.getTime()) || !Number.isFinite(cutoff.getTime()) || !Number.isSafeInteger(days) || days < 1 || days > 365 || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("INVALID_INPUT");
	return client.transaction(async (tx) => {
		const deleted = await tx.execute(sql`
			WITH candidates AS (
				SELECT id FROM audit_events
				WHERE action LIKE 'sensitive-integration:mcp.%' AND (
					occurred_at <= ${cutoff}
					OR actor_user_id IS NULL
					OR (metadata->>'creatorId' IS NOT NULL AND NOT EXISTS (
						SELECT 1 FROM creator_accounts creator WHERE creator.creator_id=audit_events.metadata->>'creatorId'
					))
				)
				ORDER BY occurred_at,id LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
			) DELETE FROM audit_events events USING candidates
			WHERE events.id=candidates.id RETURNING events.id
		`);
		return deleted.rows.length;
	});
}
