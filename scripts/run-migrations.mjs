import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is required to run database migrations.");
}

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const pool = new pg.Pool({
	connectionString: databaseUrl,
	max: 1,
	connectionTimeoutMillis: 15_000,
});

try {
	console.log("Applying database migrations...");
	await migrate(drizzle(pool), { migrationsFolder });
	console.log("Database migrations applied successfully.");
} catch (error) {
	console.error("Database migration failed.", error);
	process.exitCode = 1;
} finally {
	await pool.end();
}
