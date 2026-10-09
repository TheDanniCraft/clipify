import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/db/auth-schema";
import { createMcpPlugins } from "@/auth/mcp-options";
import { withResourceSeedErrorCompatibility } from "@/auth/resource-seed-adapter";
import { createMcpPostgresFixture } from "./postgres";

async function main() {
	const fixture = await createMcpPostgresFixture();
	try {
		// Fixture DDL uses PostgreSQL's default name; production uses Drizzle's name.
		await fixture.pool.query("ALTER TABLE auth.oauth_resource RENAME CONSTRAINT oauth_resource_identifier_key TO oauth_resource_identifier_unique");
		const factory = drizzleAdapter(fixture.db, { provider: "pg", schema });
		let arrived = 0;
		let release!: () => void;
		const barrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const racing: typeof factory = (options) => {
			const adapter = factory(options);
			return {
				...adapter,
				async findOne<T>(input: Parameters<typeof adapter.findOne>[0]): Promise<T | null> {
					const result = await adapter.findOne<T>(input);
					if (input.model === "oauthResource" && !result) {
						if (++arrived === 2) release();
						await barrier;
					}
					return result;
				},
			};
		};
		const origin = "http://127.0.0.1:3107";
		const database = process.argv[2] === "raw" ? racing : withResourceSeedErrorCompatibility(racing);
		const instances = [0, 1].map(() => betterAuth({ baseURL: origin, secret: "isolated-resource-seed-secret-32chars", database, plugins: createMcpPlugins({ origin }) }));
		const results = await Promise.allSettled(instances.map((auth) => auth.$context));
		const count = await fixture.pool.query("SELECT count(*) FROM auth.oauth_resource");
		const statuses = await Promise.all(instances.map(async (auth, i) => (results[i].status === "fulfilled" ? (await auth.handler(new Request(`${origin}/.well-known/oauth-authorization-server/api/auth`))).status : null)));
		console.log(JSON.stringify({ initialized: results.map((result) => result.status), resources: Number(count.rows[0].count), statuses }));
	} finally {
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
