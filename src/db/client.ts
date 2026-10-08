import { drizzle } from "drizzle-orm/node-postgres";
import * as domainSchema from "./schema";
import * as authSchema from "./auth-schema";
import type { Pool } from "pg";
import { RequestAwarePool } from "./request-scope";

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

globalThis.__dbPool = pool;

export const dbPool = pool;
export const schema = { ...domainSchema, ...authSchema };
export const db = drizzle(pool, { schema });
export type DatabaseClient = typeof db;
export type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
export type QueryClient = DatabaseClient | TransactionClient;
