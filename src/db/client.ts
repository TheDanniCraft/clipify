import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

declare global {
	var __dbPool: Pool | undefined;
}

const pool =
	globalThis.__dbPool ??
	new Pool({
		connectionString: process.env.DATABASE_URL,
	});

globalThis.__dbPool = pool;

export const dbPool = pool;
export const db = drizzle(pool);
export type DatabaseClient = typeof db;
export type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
export type QueryClient = DatabaseClient | TransactionClient;
