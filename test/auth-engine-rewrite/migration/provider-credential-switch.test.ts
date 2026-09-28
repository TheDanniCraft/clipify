/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { withSerializedProviderCredential } from "../../../src/server/provider-credentials";

const databaseUrl = process.env.AUTH_CUTOVER_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("TDD-US6-005 Better Auth provider credential switch", () => {
	let pool: Pool;

	beforeAll(() => {
		pool = new Pool({ connectionString: databaseUrl, max: 4 });
	});

	afterAll(async () => {
		await pool.end();
	});

	it("reads a migrated Twitch credential with Better Auth encryption", async () => {
		const result = await pool.query<{ access_token: string; refresh_token: string }>("SELECT access_token, refresh_token FROM auth.account WHERE provider_id = 'twitch' AND access_token IS NOT NULL AND refresh_token IS NOT NULL ORDER BY id LIMIT 1");
		const row = result.rows[0];
		expect(row).toBeDefined();
		const secret = process.env.BETTER_AUTH_SECRET;
		expect(secret).toBeTruthy();
		const decryption = spawnSync("bun", ["-e", 'import { symmetricDecrypt } from "better-auth/crypto"; const input = await new Response(Bun.stdin.stream()).json(); const access = await symmetricDecrypt({key: input.secret, data: input.access}); const refresh = await symmetricDecrypt({key: input.secret, data: input.refresh}); process.stdout.write(JSON.stringify({readable: access.length > 0 && refresh.length > 0}));'], {
			cwd: process.cwd(),
			encoding: "utf8",
			input: JSON.stringify({ secret, access: row.access_token, refresh: row.refresh_token }),
		});
		expect(decryption.stderr).toBe("");
		expect(decryption.status).toBe(0);
		expect(JSON.parse(decryption.stdout)).toEqual({ readable: true });
	});

	it("serializes concurrent refresh decisions across database clients", async () => {
		const account = await pool.query<{ id: string }>("SELECT id FROM auth.account WHERE provider_id = 'twitch' ORDER BY id LIMIT 1");
		const accountId = account.rows[0]?.id;
		expect(accountId).toBeTruthy();
		let active = 0;
		let maximumActive = 0;
		let refreshes = 0;
		let expired = true;
		const refresh = () =>
			withSerializedProviderCredential(pool, accountId!, async () => {
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				await new Promise((resolve) => setTimeout(resolve, 75));
				if (expired) {
					refreshes += 1;
					expired = false;
				}
				active -= 1;
			});

		await Promise.all([refresh(), refresh(), refresh()]);
		expect(maximumActive).toBe(1);
		expect(refreshes).toBe(1);
	});

	it("has no runtime flag, legacy token-table fallback, or custom refresh call", () => {
		const tokenRuntime = readFileSync(join(process.cwd(), "src/server/tokens.ts"), "utf8");
		const twitchRuntime = readFileSync(join(process.cwd(), "src/server/twitch-auth.ts"), "utf8");
		const twitchActions = readFileSync(join(process.cwd(), "src/app/actions/twitch.ts"), "utf8");
		expect(`${tokenRuntime}\n${twitchRuntime}\n${twitchActions}`).not.toMatch(/AUTH_CUTOVER_RUNTIME|refreshAccessTokenWithContextInternal/);
		expect(tokenRuntime).not.toMatch(/\btokenTable\b|decryptToken\(|encryptToken\(/);
	});
});
