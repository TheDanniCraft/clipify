import type { drizzleAdapter } from "better-auth/adapters/drizzle";

type AdapterFactory = ReturnType<typeof drizzleAdapter>;

/** Let Better Auth's resource-seeding race handler recognize Drizzle's wrapped PG error. */
export function withResourceSeedErrorCompatibility(factory: AdapterFactory): AdapterFactory {
	return (options) => {
		const adapter = factory(options);
		const create = adapter.create.bind(adapter);
		return {
			...adapter,
			async create(input) {
				try {
					return await create(input);
				} catch (error) {
					if (input.model === "oauthResource") {
						const seen = new Set<unknown>();
						let cause: unknown = error;
						while (cause instanceof Error && !seen.has(cause)) {
							seen.add(cause);
							const pg = cause as Error & { code?: string; constraint?: string };
							if (pg.code === "23505" && pg.constraint === "oauth_resource_identifier_unique") {
								throw new Error("Duplicate OAuth resource identifier", { cause: error });
							}
							cause = cause.cause;
						}
					}
					throw error;
				}
			},
		};
	};
}
