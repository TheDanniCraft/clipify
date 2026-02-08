import { Client } from "pg";
import { encryptToken } from "@lib/tokenCrypto";

// Heuristic: your encrypted format is "v1.<iv>.<tag>.<ct>" => starts with "v1."
const looksEncrypted = (v: unknown) => typeof v === "string" && v.startsWith("v1.");

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("Missing DATABASE_URL");
	if (!process.env.DB_SECRET_KEY) throw new Error("Missing DB_SECRET_KEY");

	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	// Read tokens (only needed columns)
	const { rows } = await client.query<{
		id: string;
		access_token: string;
		refresh_token: string;
	}>(`SELECT id, access_token, refresh_token FROM tokens`);

	let updated = 0;
	let skipped = 0;

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

	await client.end();
	console.log(`Done. Updated: ${updated}, Skipped (already encrypted): ${skipped}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
