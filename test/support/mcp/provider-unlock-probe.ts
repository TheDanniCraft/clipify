import { Pool } from "pg";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	const fault = process.argv[2] === "failure";
	let injected = false;
	const observer = new Pool({ connectionString: fixture.url, max: 1 });
	try {
		fixture.pool.on("acquire", (client) => {
			const query = client.query.bind(client);
			Object.defineProperty(client, "query", {
				configurable: true,
				value: (...args: unknown[]) => {
					if (fault && !injected && typeof args[0] === "string" && args[0].startsWith("SELECT pg_advisory_unlock")) {
						injected = true;
						return Promise.reject(new Error("Isolated unlock transport fault"));
					}
					return Reflect.apply(query, client, args);
				},
			});
		});
		const { withSerializedProviderCredential } = await import("@/server/provider-credentials");
		const completed = await withSerializedProviderCredential(fixture.pool, "fixture-account", async () => true);
		let lockReleased = false;
		const deadline = performance.now() + 500;
		while (performance.now() < deadline) {
			const acquired = (await observer.query("SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired", ["clipify:twitch:fixture-account"])).rows[0].acquired;
			if (acquired) {
				await observer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", ["clipify:twitch:fixture-account"]);
				lockReleased = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		const healthy = (await fixture.pool.query("SELECT 1 AS healthy")).rows[0].healthy === 1;
		console.log(JSON.stringify({ completed, injected, lockReleased, healthy }));
	} finally {
		await observer.end();
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
