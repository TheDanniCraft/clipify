import { Client } from "pg";
import { encryptToken } from "@lib/tokenCrypto";

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

			for (const r of rows) {
				// Skip rows already encrypted
				if (looksEncrypted(r.access_token) && looksEncrypted(r.refresh_token)) {
					skipped++;
					continue;
				}

				const aad = `twitchUser:${r.id}:oauth`;

				const accessEnc = looksEncrypted(r.access_token) ? r.access_token : encryptToken(r.access_token, aad);
				const refreshEnc = looksEncrypted(r.refresh_token) ? r.refresh_token : encryptToken(r.refresh_token, aad);

				await client.query(
					`UPDATE tokens
         SET access_token = $1, refresh_token = $2
         WHERE id = $3`,
					[accessEnc, refreshEnc, r.id],
				);

				updated++;
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
