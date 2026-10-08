import "server-only";
import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { db, type QueryClient } from "@/db/client";
import * as auth from "@/db/auth-schema";
import * as schema from "@/db/schema";

type SchemaColumn = { table_schema: string; table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null };

const tables = [
	auth.user,
	auth.session,
	auth.member,
	auth.organizationRole,
	auth.verification,
	auth.rateLimit,
	auth.jwks,
	auth.oauthClient,
	auth.oauthResource,
	auth.oauthClientResource,
	auth.oauthAccessToken,
	auth.oauthRefreshToken,
	auth.oauthConsent,
	schema.mcpConnectionGrantsTable,
	schema.mcpGrantCreatorsTable,
	schema.mcpMutationRetriesTable,
	schema.creatorAccountsTable,
	schema.agencyCreatorLinksTable,
	schema.agencyLicenseAllocationsTable,
	schema.entitlementGrantsTable,
	schema.auditEventsTable,
	schema.overlaysTable,
	schema.playlistsTable,
].map(getTableConfig);

/** Read-only schema-first rollout gate; never performs DDL or exposes database errors. */
export async function isMcpSchemaReady(client: QueryClient = db): Promise<boolean> {
	try {
		const result = await client.execute<SchemaColumn>(
			sql`SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE (table_schema || '.' || table_name) IN (${sql.join(
				tables.map((table) => sql`${(table.schema ?? "public") + "." + table.name}`),
				sql`, `,
			)})`,
		);
		const columns = new Map(result.rows.map((row) => [`${row.table_schema}.${row.table_name}.${row.column_name}`, row] as const));
		for (const table of tables) {
			for (const column of table.columns) {
				const actual = columns.get(`${table.schema ?? "public"}.${table.name}.${column.name}`);
				if (!actual) return false;
				if (column.name === "configuration_revision" && (actual.data_type !== "integer" || actual.is_nullable !== "NO" || !/^\(?1\)?(?:::integer)?$/.test(actual.column_default ?? ""))) return false;
			}
		}
		return true;
	} catch {
		return false;
	}
}
