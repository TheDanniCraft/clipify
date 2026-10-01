import type { PGlite as PGliteDatabase, PGliteInterface, Transaction } from "@electric-sql/pglite";

export type AuthTestDatabase = PGliteDatabase;

declare const PGlite: typeof import("@electric-sql/pglite").PGlite;

export async function createAuthTestDatabase(seed?: (database: AuthTestDatabase) => Promise<void>): Promise<AuthTestDatabase> {
	const database = new PGlite();
	await database.exec("CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS public;");
	await seed?.(database);
	return database;
}

export async function resetAuthTestDatabase(database: PGliteInterface): Promise<void> {
	await database.exec(`
		DROP SCHEMA IF EXISTS auth CASCADE;
		DROP SCHEMA IF EXISTS public CASCADE;
		CREATE SCHEMA auth;
		CREATE SCHEMA public;
	`);
}

export function inAuthTestTransaction<T>(database: AuthTestDatabase, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
	return database.transaction(operation);
}

export class FixtureBuilder<T extends object> {
	readonly #value: T;

	constructor(value: T) {
		this.#value = structuredClone(value);
	}

	with(overrides: Partial<T>): FixtureBuilder<T> {
		return new FixtureBuilder({ ...this.#value, ...structuredClone(overrides) });
	}

	build(): T {
		return structuredClone(this.#value);
	}
}
