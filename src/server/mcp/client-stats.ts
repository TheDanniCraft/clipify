import "server-only";
import { db, type QueryClient } from "@/db/client";
import { sql } from "drizzle-orm";
import type { McpClientStats } from "@/app/lib/mcpMetrics";
export type { McpClientGroup, McpClientStats } from "@/app/lib/mcpMetrics";
/** Aggregates provider metadata, not verified vendor identity. Never exports client/user IDs. */
export async function getMcpClientStats(page = 1, pageSize: number | null = 20, client: QueryClient = db): Promise<McpClientStats> {
	if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || (pageSize !== null && (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100))) throw Error("INVALID_INPUT");
	const result = await client.execute(sql`
 WITH usage AS (
  SELECT metadata->>'clientId' AS client_id,count(*) AS calls,max(occurred_at) AS last_used
  FROM audit_events WHERE action LIKE 'sensitive-integration:mcp.%'
   AND occurred_at >= now()-interval '30 days' AND jsonb_typeof(metadata->'clientId')='string'
  GROUP BY metadata->>'clientId'
 ), grants AS (
  SELECT client_id,count(*) AS active_connections FROM mcp_connection_grants
  WHERE active AND revoked_at IS NULL AND expires_at>now() GROUP BY client_id
 ), ids AS (
  SELECT client_id FROM auth.oauth_client UNION SELECT client_id FROM usage UNION SELECT client_id FROM grants
 ), groups AS (
  SELECT max(coalesce(nullif(left(btrim(c.name),200),''),'Unavailable app')) AS name,
   count(c.client_id)::int AS registered_clients,
   count(*) FILTER(WHERE g.active_connections>0 AND coalesce(c.disabled,true)=false)::int AS authorized_clients,
   coalesce(sum(CASE WHEN coalesce(c.disabled,true)=false THEN g.active_connections ELSE 0 END),0)::int AS active_connections,
   count(u.client_id)::int AS active_clients,
   coalesce(sum(u.calls),0)::bigint AS calls,max(u.last_used) AS last_used
  FROM ids LEFT JOIN auth.oauth_client c USING(client_id) LEFT JOIN usage u USING(client_id) LEFT JOIN grants g USING(client_id)
  GROUP BY lower(coalesce(nullif(left(btrim(c.name),200),''),'Unavailable app'))
 ), page AS (
  SELECT * FROM groups ORDER BY calls DESC,name ASC LIMIT ${pageSize} OFFSET ${(page - 1) * (pageSize ?? 0)}
 )
 SELECT jsonb_build_object(
  'summary',(SELECT jsonb_build_object('registeredClients',coalesce(sum(registered_clients),0),'authorizedClients',coalesce(sum(authorized_clients),0),'activeClients30d',coalesce(sum(active_clients),0),'calls30d',coalesce(sum(calls),0),'applicationNames',count(*)) FROM groups),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('name',name,'registeredClients',registered_clients,'authorizedClients',authorized_clients,'activeConnections',active_connections,'activeClients30d',active_clients,'calls30d',calls,'lastUsedAt',last_used) ORDER BY calls DESC,name ASC) FROM page),'[]'::jsonb)
 ) AS data`);
	const data = result.rows[0]?.data as Pick<McpClientStats, "summary" | "items"> | undefined;
	if (!data) throw Error("SERVICE_UNAVAILABLE");
	return { ...data, page, pageSize: pageSize ?? data.items.length, sampledAt: new Date().toISOString() };
}
let cache: { value: McpClientStats; expires: number } | undefined;
let pending: Promise<McpClientStats> | undefined;
/** All application groups, coalesced and cached for one minute; audit queries never run per tool call. */
export async function getMcpClientHealthStats(client: QueryClient = db): Promise<McpClientStats> {
	if (cache && cache.expires > Date.now()) return structuredClone(cache.value);
	pending ??= getMcpClientStats(1, null, client)
		.then((value) => {
			cache = { value, expires: Date.now() + 60000 };
			return value;
		})
		.finally(() => {
			pending = undefined;
		});
	return structuredClone(await pending);
}
