import { Client } from "pg";
import { encryptToken } from "../src/app/lib/tokenCrypto";

// Heuristic: your encrypted format is "v1.<iv>.<tag>.<ct>"
const ENCRYPTED_TOKEN_REGEX = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const looksEncrypted = (v: unknown) => typeof v === "string" && ENCRYPTED_TOKEN_REGEX.test(v);

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("Missing DATABASE_URL");
	if (!process.env.DB_SECRET_KEY) throw new Error("Missing DB_SECRET_KEY");

	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	try {
		const batchSize = 1000;
		let updated = 0;
		let skipped = 0;
		let lastId: string | null = null;

		while (true) {
			const params: unknown[] = [batchSize];
			let whereClause = "";
			if (lastId !== null) {
				whereClause = "WHERE id > $2";
				params.push(lastId);
			}

			// Read tokens (only needed columns)
			const { rows } = await client.query<{
				id: string;
				access_token: string;
				refresh_token: string;
			}>(
				`SELECT id, access_token, refresh_token
         FROM tokens
         ${whereClause}
         ORDER BY id
         LIMIT $1`,
				params,
			);

			if (rows.length === 0) break;

			const updates: Array<{ id: string; accessEnc: string; refreshEnc: string }> = [];

			for (const r of rows) {
				// Skip rows already encrypted
				if (looksEncrypted(r.access_token) && looksEncrypted(r.refresh_token)) {
					skipped++;
					continue;
				}

				const aad = `twitchUser:${r.id}:oauth`;

				const accessEnc = looksEncrypted(r.access_token) ? r.access_token : encryptToken(r.access_token, aad);
				const refreshEnc = looksEncrypted(r.refresh_token) ? r.refresh_token : encryptToken(r.refresh_token, aad);

				updates.push({ id: r.id, accessEnc, refreshEnc });
			}

			if (updates.length > 0) {
				await client.query("BEGIN");
				try {
					const values = updates
						.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
						.join(", ");
					const params = updates.flatMap((u) => [u.accessEnc, u.refreshEnc, u.id]);

					await client.query(
						`UPDATE tokens AS t
         SET access_token = v.access_token,
             refresh_token = v.refresh_token
         FROM (VALUES ${values}) AS v(access_token, refresh_token, id)
         WHERE t.id = v.id`,
						params,
					);

					await client.query("COMMIT");
					updated += updates.length;
				} catch (e) {
					await client.query("ROLLBACK");
					throw e;
				}
			}

			lastId = rows[rows.length - 1]!.id;
		}

		console.log(`Done. Updated: ${updated}, Skipped (already encrypted): ${skipped}`);
	} finally {
		await client.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
