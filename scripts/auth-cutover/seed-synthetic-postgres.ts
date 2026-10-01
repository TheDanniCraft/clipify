import { Pool } from "pg";
import { encryptToken } from "../../src/app/lib/tokenCrypto";

const required = (name: string) => {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name}_REQUIRED`);
	return value;
};

export function validateSyntheticTarget(databaseUrl: string, environment = process.env.AUTH_CUTOVER_ENV) {
	if (environment !== "rehearsal") throw new Error("SYNTHETIC_REHEARSAL_ENV_REQUIRED");
	const target = new URL(databaseUrl);
	const database = target.pathname.slice(1);
	if (!database.includes("auth_rehearsal_synthetic_2x")) throw new Error("SYNTHETIC_DATABASE_NAME_REQUIRED");
	return database;
}

export function deterministicUuid(namespace: number, sequence: number) {
	if (!Number.isInteger(namespace) || namespace < 0 || namespace > 0xffff) throw new Error("INVALID_UUID_NAMESPACE");
	if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999_999_999) throw new Error("INVALID_UUID_SEQUENCE");
	return `${namespace.toString(16).padStart(8, "0")}-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

export async function seedSyntheticPostgres(databaseUrl: string, creatorCount: number) {
	validateSyntheticTarget(databaseUrl);
	if (!Number.isInteger(creatorCount) || creatorCount < 1) throw new Error("SYNTHETIC_CREATOR_COUNT_INVALID");
	const editorCount = Math.max(1, Math.ceil(creatorCount * (3 / 114)));
	const resourceCount = Math.ceil(creatorCount * (99 / 114));
	const subscriptionCount = Math.ceil(creatorCount * (2 / 114));
	const entitlementCount = Math.ceil(creatorCount * (118 / 114));
	const pool = new Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		const existing = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM public.users");
		if (Number(existing.rows[0]?.count ?? 0) !== 0) throw new Error("SYNTHETIC_TARGET_NOT_EMPTY");

		for (let index = 1; index <= creatorCount; index += 1) {
			const sequence = String(index).padStart(6, "0");
			const creatorId = `synthetic-twitch-${sequence}`;
			const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, index));
			await client.query("INSERT INTO public.users (id,email,username,avatar,role,plan,created_at,updated_at,last_login,twitch_created_at) VALUES ($1,$2,$3,'','user','free',$4,$4,$4,$4)", [creatorId, `creator-${sequence}@example.invalid`, `Synthetic Creator ${sequence}`, createdAt]);
			const aad = `twitchUser:${creatorId}:oauth`;
			await client.query("INSERT INTO public.tokens (id,access_token,refresh_token,expires_at,scope,token_type) VALUES ($1,$2,$3,$4,$5,'bearer')", [creatorId, encryptToken(`non-routable-access-${sequence}`, aad), encryptToken(`non-routable-refresh-${sequence}`, aad), new Date("2030-01-01T00:00:00.000Z"), ["channel:read:redemptions", "user:read:email"]]);
		}

		for (let index = 1; index <= editorCount; index += 1) {
			const ownerId = `synthetic-twitch-${String(index).padStart(6, "0")}`;
			const editorId = `synthetic-twitch-${String(index + editorCount).padStart(6, "0")}`;
			await client.query("INSERT INTO public.editors (user_id,editor_id) VALUES ($1,$2)", [ownerId, editorId]);
		}

		for (let index = 1; index <= resourceCount; index += 1) {
			const ownerIndex = ((index - 1) % creatorCount) + 1;
			const ownerId = `synthetic-twitch-${String(ownerIndex).padStart(6, "0")}`;
			await client.query("INSERT INTO public.overlays (id,owner_id,secret,name,status,type) VALUES ($1,$2,$3,$4,'active','All')", [deterministicUuid(1, index), ownerId, `non-routable-overlay-${String(index).padStart(6, "0")}`, `Synthetic Overlay ${String(index).padStart(6, "0")}`]);
		}

		for (let index = 1; index <= subscriptionCount; index += 1) {
			const creatorId = `synthetic-twitch-${String(index).padStart(6, "0")}`;
			await client.query("INSERT INTO public.billing_subscriptions (id,user_id,stripe_customer_id,status,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at) VALUES ($1,$2,$3,'active',$4,$5,false,$4,$4)", [`sub_synthetic_${String(index).padStart(6, "0")}`, creatorId, `cus_synthetic_${String(index).padStart(6, "0")}`, new Date("2026-01-01T00:00:00.000Z"), new Date("2030-01-01T00:00:00.000Z")]);
		}

		for (let index = 1; index <= entitlementCount; index += 1) {
			const ownerIndex = ((index - 1) % creatorCount) + 1;
			const creatorId = `synthetic-twitch-${String(ownerIndex).padStart(6, "0")}`;
			await client.query("INSERT INTO public.entitlement_grants (id,user_id,entitlement,source,reason,external_reference,starts_at,created_at,updated_at) VALUES ($1,$2,'pro_access','system','synthetic rehearsal',$3,$4,$4,$4)", [deterministicUuid(2, index), creatorId, `synthetic-entitlement-${String(index).padStart(6, "0")}`, new Date("2026-01-01T00:00:00.000Z")]);
		}

		await client.query("COMMIT");
		return { creators: creatorCount, editors: editorCount, tokens: creatorCount, resources: resourceCount, subscriptions: subscriptionCount, entitlements: entitlementCount };
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

async function main() {
	const databaseUrl = required("AUTH_CUTOVER_DATABASE_URL");
	const creatorCount = Number(required("AUTH_SYNTHETIC_CREATOR_COUNT"));
	process.stdout.write(`${JSON.stringify(await seedSyntheticPostgres(databaseUrl, creatorCount))}\n`);
}

if (import.meta.main) {
	void main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : "SYNTHETIC_SEED_FAILED"}\n`);
		process.exitCode = 1;
	});
}
