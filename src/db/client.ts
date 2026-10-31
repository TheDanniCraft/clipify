import { drizzle } from "drizzle-orm/node-postgres";
import * as domainSchema from "./schema";
import * as authSchema from "./auth-schema";
import type { Pool } from "pg";
import { RequestAwarePool } from "./request-scope";
import { captureUnexpectedError } from "@/app/lib/sentryServer";

declare global {
	var __dbPool: Pool | undefined;
}

const pool =
	globalThis.__dbPool ??
	new RequestAwarePool({
		connectionString: process.env.DATABASE_URL,
		// Bound connection acquisition and cancel slow SQL in PostgreSQL itself.
		connectionTimeoutMillis: 10_000,
		statement_timeout: 10_000,
	});

if (!globalThis.__dbPool) {
	// Handle disconnects while idle or leased, without hiding query failures.
	const reportConnectionError = (error: Error) => captureUnexpectedError(error, "database", "connection");
	pool.on("error", reportConnectionError);
	pool.on("acquire", (client) => client.on("error", reportConnectionError));
	pool.on("release", (_error, client) => client.removeListener("error", reportConnectionError));
	globalThis.__dbPool = pool;
}

export const dbPool = pool;
export const schema = { ...domainSchema, ...authSchema };
export const db = drizzle(pool, { schema });
export type DatabaseClient = typeof db;
export type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
export type QueryClient = DatabaseClient | TransactionClient;
