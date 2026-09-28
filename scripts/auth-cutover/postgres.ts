import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { symmetricEncrypt } from "better-auth/crypto";
import { decryptToken } from "../../src/app/lib/tokenCrypto";
import { buildManifest, signManifest, verifyManifest, verifyManifestSignature, type CutoverManifest } from "./manifest";
import { installCreatorOnboardingTriggers } from "./onboarding-trigger";
import { verifyBackupAttestation, type BackupAttestation } from "./preflight";

export type CutoverCounts = {
	creators: number;
	legacyEditors: number;
	legacyTokens: number;
	resources: number;
	subscriptions: number;
	entitlements: number;
};

type SourceInspection = {
	database: string;
	postgresVersion: string;
	counts: CutoverCounts;
	sourceFingerprint: string;
};

function requiredSetting(environment: NodeJS.ProcessEnv, name: string): string {
	const value = environment[name]?.trim();
	if (!value) throw new Error(`${name}_REQUIRED`);
	return value;
}

function assertCutoverTarget(databaseUrl: string, environment: NodeJS.ProcessEnv): URL {
	const cutoverEnvironment = environment.AUTH_CUTOVER_ENV;
	if (cutoverEnvironment !== "rehearsal" && cutoverEnvironment !== "production") throw new Error("CUTOVER_ENVIRONMENT_REQUIRED");
	if (cutoverEnvironment === "production" && environment.AUTH_CUTOVER_PRODUCTION_APPROVED !== "1") throw new Error("PRODUCTION_TARGET_APPROVAL_REQUIRED");
	const parsed = new URL(databaseUrl);
	if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) throw new Error("POSTGRES_TARGET_REQUIRED");
	const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
	if (!database) throw new Error("DATABASE_NAME_REQUIRED");
	const looksDisposable = /(?:rehearsal|test|dev|development|scratch|sandbox)/i.test(database);
	if (cutoverEnvironment === "rehearsal" && !looksDisposable && environment.AUTH_CUTOVER_ALLOW_DEFAULT_DATABASE !== "1") throw new Error("DISPOSABLE_DATABASE_NAME_REQUIRED");
	return parsed;
}

async function inReadOnlySnapshot<T>(client: PoolClient, operation: () => Promise<T>): Promise<T> {
	await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
	try {
		return await operation();
	} finally {
		await client.query("ROLLBACK");
	}
}

function numeric(value: string | number): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("INVALID_DATABASE_COUNT");
	return parsed;
}

export class PostgresCutoverRepository {
	readonly #pool: Pool;
	readonly #databaseName: string;

	constructor(databaseUrl: string, environment: NodeJS.ProcessEnv = process.env) {
		const parsed = assertCutoverTarget(databaseUrl, environment);
		this.#databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
		this.#pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 15_000, application_name: "clipify-auth-cutover" });
	}

	async close(): Promise<void> {
		await this.#pool.end();
	}

	async inspectSource(): Promise<SourceInspection> {
		const client = await this.#pool.connect();
		try {
			return await inReadOnlySnapshot(client, async () => {
				const metadata = await client.query<{ database: string; postgres_version: string }>("SELECT current_database() AS database, current_setting('server_version') AS postgres_version");
				if (metadata.rows[0]?.database !== this.#databaseName) throw new Error("DATABASE_IDENTITY_MISMATCH");

				const countResult = await client.query<Record<keyof CutoverCounts, string>>(`
					SELECT
						(SELECT count(*) FROM public.users)::text AS "creators",
						(SELECT count(*) FROM public.editors)::text AS "legacyEditors",
						(SELECT count(*) FROM public.tokens)::text AS "legacyTokens",
						((SELECT count(*) FROM public.overlays) + (SELECT count(*) FROM public.playlists) + (SELECT count(*) FROM public.galleries) + (SELECT count(*) FROM public.runners))::text AS "resources",
						(SELECT count(*) FROM public.billing_subscriptions)::text AS "subscriptions",
						(SELECT count(*) FROM public.entitlement_grants)::text AS "entitlements"
				`);
				const row = countResult.rows[0];
				if (!row) throw new Error("SOURCE_COUNT_QUERY_EMPTY");
				const counts: CutoverCounts = {
					creators: numeric(row.creators),
					legacyEditors: numeric(row.legacyEditors),
					legacyTokens: numeric(row.legacyTokens),
					resources: numeric(row.resources),
					subscriptions: numeric(row.subscriptions),
					entitlements: numeric(row.entitlements),
				};

				const source = await client.query<{ snapshot: unknown }>(`
					SELECT jsonb_build_object(
						'schema', (SELECT coalesce(jsonb_agg(jsonb_build_array(table_schema, table_name, column_name, data_type, is_nullable) ORDER BY table_schema, table_name, ordinal_position), '[]'::jsonb) FROM information_schema.columns WHERE table_schema IN ('public', 'auth', 'drizzle')),
						'migrations', (SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id), '[]'::jsonb) FROM drizzle.__drizzle_migrations m),
						'users', (SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id), '[]'::jsonb) FROM public.users u),
						'editors', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.user_id, e.editor_id), '[]'::jsonb) FROM public.editors e),
						'tokens', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.tokens t),
						'overlays', (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id), '[]'::jsonb) FROM public.overlays o),
						'playlists', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb) FROM public.playlists p),
						'galleries', (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.id), '[]'::jsonb) FROM public.galleries g),
						'runners', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM public.runners r),
						'subscriptions', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id), '[]'::jsonb) FROM public.billing_subscriptions s),
						'entitlements', (SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id), '[]'::jsonb) FROM public.entitlement_grants e)
					) AS snapshot
				`);
				const snapshot = source.rows[0]?.snapshot;
				if (!snapshot) throw new Error("SOURCE_SNAPSHOT_EMPTY");
				const sourceFingerprint = `sha256:${createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex")}`;
				return { database: metadata.rows[0].database, postgresVersion: metadata.rows[0].postgres_version, counts, sourceFingerprint };
			});
		} finally {
			client.release();
		}
	}

	async applyBackfill(input: { runId: string; sourceFingerprint: string; manifestChecksum: string; betterAuthSecret: string }): Promise<{ creators: number; owners: number; operations: number; credentials: number; anomalies: number }> {
		const client = await this.#pool.connect();
		const id = (prefix: string, value: string) => `${prefix}:${createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24)}`;
		const checkpoint = async (phase: string, processedCount: number) => {
			const checksum = `sha256:${createHash("sha256").update(`${input.runId}\u0000${phase}\u0000${processedCount}`, "utf8").digest("hex")}`;
			await client.query(
				`INSERT INTO public.migration_checkpoints (run_id, phase, cursor, checksum, status, processed_count, completed_at)
				 VALUES ($1, $2, $3, $4, 'completed', $5, now())
				 ON CONFLICT (run_id, phase, cursor) DO UPDATE SET checksum = EXCLUDED.checksum, status = 'completed', processed_count = EXCLUDED.processed_count, completed_at = now()`,
				[input.runId, phase, String(processedCount), checksum, processedCount],
			);
		};
		try {
			await client.query(
				`INSERT INTO public.migration_runs (id, status, source_fingerprint, manifest_checksum)
				 VALUES ($1, 'created', $2, $3)
				 ON CONFLICT (id) DO NOTHING`,
				[input.runId, input.sourceFingerprint, input.manifestChecksum],
			);
			const existing = await client.query<{ source_fingerprint: string; manifest_checksum: string }>("SELECT source_fingerprint, manifest_checksum FROM public.migration_runs WHERE id = $1", [input.runId]);
			if (existing.rows[0]?.source_fingerprint !== input.sourceFingerprint || existing.rows[0]?.manifest_checksum !== input.manifestChecksum) throw new Error("RUN_ID_BINDING_MISMATCH");
			await client.query("UPDATE public.migration_runs SET status = 'preflighted', updated_at = now() WHERE id = $1", [input.runId]);
			await client.query("UPDATE public.migration_runs SET status = 'backup_verified', updated_at = now() WHERE id = $1", [input.runId]);
			await client.query("UPDATE public.migration_runs SET status = 'migrating', updated_at = now() WHERE id = $1", [input.runId]);

			await client.query("BEGIN");
			await installCreatorOnboardingTriggers(client);
			await client.query("SELECT set_config('clipify.auth_cutover_backfill', '1', true)");
			const creators = await client.query<{ id: string; email: string; username: string; avatar: string; created_at: Date }>("SELECT id, email, username, avatar, created_at FROM public.users ORDER BY id");
			let credentials = 0;
			for (const creator of creators.rows) {
				const authUserId = id("auth-twitch", creator.id);
				const accountId = id("account-twitch", creator.id);
				const organizationId = id("creator", creator.id);
				const ownerMemberId = id("member-owner", `${organizationId}:${authUserId}`);
				await client.query(
					`INSERT INTO auth.user (id, name, email, email_verified, image, created_at, updated_at)
					 VALUES ($1, $2, lower($3), true, $4, $5, now())
					 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, email_verified = true, image = EXCLUDED.image, updated_at = now()`,
					[authUserId, creator.username, creator.email, creator.avatar, creator.created_at],
				);
				const token = await client.query<{ access_token: string; refresh_token: string; expires_at: Date; scope: string[]; token_type: string }>("SELECT access_token, refresh_token, expires_at, scope, token_type FROM public.tokens WHERE id = $1", [creator.id]);
				let accessToken: string | null = null;
				let refreshToken: string | null = null;
				let expiresAt: Date | null = null;
				let scope: string | null = null;
				if (token.rows[0]) {
					const aad = `twitchUser:${creator.id}:oauth`;
					const legacyAccess = decryptToken(token.rows[0].access_token, aad);
					const legacyRefresh = decryptToken(token.rows[0].refresh_token, aad);
					accessToken = await symmetricEncrypt({ key: input.betterAuthSecret, data: legacyAccess });
					refreshToken = await symmetricEncrypt({ key: input.betterAuthSecret, data: legacyRefresh });
					expiresAt = token.rows[0].expires_at;
					scope = token.rows[0].scope.join(" ");
					credentials += 1;
				}
				await client.query(
					`INSERT INTO auth.account (id, account_id, provider_id, user_id, access_token, refresh_token, access_token_expires_at, scope, created_at, updated_at)
					 VALUES ($1, $2, 'twitch', $3, $4, $5, $6, $7, now(), now())
					 ON CONFLICT (provider_id, account_id) DO UPDATE SET user_id = EXCLUDED.user_id, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, access_token_expires_at = EXCLUDED.access_token_expires_at, scope = EXCLUDED.scope, updated_at = now()`,
					[accountId, creator.id, authUserId, accessToken, refreshToken, expiresAt, scope],
				);
				await client.query(
					`INSERT INTO auth.organization (id, name, slug, created_at, metadata)
					 VALUES ($1, $2, $3, $4, $5)
					 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata`,
					[organizationId, creator.username, `creator-${createHash("sha256").update(creator.id).digest("hex").slice(0, 20)}`, creator.created_at, JSON.stringify({ kind: "creator", creatorId: creator.id })],
				);
				await client.query("INSERT INTO auth.member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'owner', $4) ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner'", [ownerMemberId, organizationId, authUserId, creator.created_at]);
				await client.query("INSERT INTO public.creator_accounts (organization_id, creator_id) VALUES ($1, $2) ON CONFLICT (creator_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = now()", [organizationId, creator.id]);
				await client.query("INSERT INTO public.creator_identity_links (creator_id, auth_user_id, source) VALUES ($1, $2, 'migration') ON CONFLICT (creator_id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, source = 'migration', updated_at = now()", [creator.id, authUserId]);
			}
			await checkpoint("identity", creators.rowCount ?? creators.rows.length);

			const editors = await client.query<{ user_id: string; editor_id: string }>("SELECT user_id, editor_id FROM public.editors ORDER BY user_id, editor_id");
			let operations = 0;
			let anomalies = 0;
			for (const editor of editors.rows) {
				const editorUser = await client.query<{ auth_user_id: string }>("SELECT auth_user_id FROM public.creator_identity_links WHERE creator_id = $1", [editor.editor_id]);
				const creatorAccount = await client.query<{ organization_id: string }>("SELECT organization_id FROM public.creator_accounts WHERE creator_id = $1", [editor.user_id]);
				if (editorUser.rows[0] && creatorAccount.rows[0]) {
					const memberId = id("member-operations", `${creatorAccount.rows[0].organization_id}:${editorUser.rows[0].auth_user_id}`);
					await client.query("INSERT INTO auth.member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'operations', now()) ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'operations'", [memberId, creatorAccount.rows[0].organization_id, editorUser.rows[0].auth_user_id]);
					operations += 1;
				} else {
					const sourceHash = createHash("sha256").update(`${editor.user_id}\u0000${editor.editor_id}`, "utf8").digest("hex");
					await client.query("INSERT INTO public.migration_anomalies (run_id, source_hash, category, blocking) VALUES ($1, $2, 'unresolved-editor', true) ON CONFLICT (run_id, source_hash, category) DO NOTHING", [input.runId, sourceHash]);
					anomalies += 1;
				}
			}
			await checkpoint("membership", editors.rowCount ?? editors.rows.length);
			await checkpoint("credentials", credentials);
			await client.query("COMMIT");
			return { creators: creators.rowCount ?? creators.rows.length, owners: creators.rowCount ?? creators.rows.length, operations, credentials, anomalies };
		} catch (error) {
			await client.query("ROLLBACK").catch(() => undefined);
			await client.query("UPDATE public.migration_runs SET status = 'maintenance_blocked', updated_at = now() WHERE id = $1", [input.runId]).catch(() => undefined);
			throw error;
		} finally {
			client.release();
		}
	}

	async validateBackfill(runId: string, expected: CutoverCounts): Promise<{ creators: number; owners: number; operations: number; credentials: number; anomalies: number; valid: true }> {
		const result = await this.#pool.query<{ creators: string; owners: string; operations: string; credentials: string; anomalies: string; invalid_credentials: string; broken_links: string }>(
			`SELECT
				(SELECT count(*) FROM public.creator_accounts)::text AS creators,
				(SELECT count(*) FROM auth.member WHERE role = 'owner')::text AS owners,
				(SELECT count(*) FROM auth.member WHERE role = 'operations')::text AS operations,
				(SELECT count(*) FROM auth.account WHERE provider_id = 'twitch' AND refresh_token IS NOT NULL)::text AS credentials,
				(SELECT count(*) FROM public.migration_anomalies WHERE run_id = $1 AND blocking = true AND status = 'open')::text AS anomalies,
				(SELECT count(*) FROM auth.account WHERE provider_id = 'twitch' AND (access_token IS NULL OR refresh_token IS NULL OR access_token !~ '^[0-9a-f]+$' OR refresh_token !~ '^[0-9a-f]+$'))::text AS invalid_credentials,
				(SELECT count(*) FROM public.creator_accounts ca LEFT JOIN public.creator_identity_links cil ON cil.creator_id = ca.creator_id LEFT JOIN auth.member m ON m.organization_id = ca.organization_id AND m.user_id = cil.auth_user_id AND m.role = 'owner' WHERE cil.creator_id IS NULL OR m.id IS NULL)::text AS broken_links`,
			[runId],
		);
		const row = result.rows[0];
		if (!row) throw new Error("VALIDATION_QUERY_EMPTY");
		const values = { creators: numeric(row.creators), owners: numeric(row.owners), operations: numeric(row.operations), credentials: numeric(row.credentials), anomalies: numeric(row.anomalies) };
		const valid = values.creators === expected.creators && values.owners === expected.creators && values.operations === expected.legacyEditors && values.credentials === expected.legacyTokens && values.anomalies === 0 && numeric(row.invalid_credentials) === 0 && numeric(row.broken_links) === 0;
		if (!valid) {
			await this.#pool.query("UPDATE public.migration_runs SET status = 'maintenance_blocked', updated_at = now() WHERE id = $1", [runId]);
			throw new Error("CUTOVER_INVARIANT_FAILED");
		}
		await this.#pool.query("UPDATE public.migration_runs SET status = 'validated', updated_at = now() WHERE id = $1", [runId]);
		return { ...values, valid: true };
	}

	async runSmoke(runId: string, expected: CutoverCounts): Promise<Record<string, true>> {
		const result = await this.#pool.query<Record<string, boolean>>(
			`SELECT
				NOT EXISTS (SELECT 1 FROM public.creator_accounts ca LEFT JOIN public.creator_identity_links cil ON cil.creator_id = ca.creator_id LEFT JOIN auth.account a ON a.user_id = cil.auth_user_id AND a.provider_id = 'twitch' WHERE cil.creator_id IS NULL OR a.id IS NULL) AS "sign-in",
				NOT EXISTS (SELECT 1 FROM public.creator_accounts ca LEFT JOIN public.creator_identity_links cil ON cil.creator_id = ca.creator_id LEFT JOIN auth.member m ON m.organization_id = ca.organization_id AND m.user_id = cil.auth_user_id AND m.role = 'owner' WHERE m.id IS NULL) AS "allow-deny",
				NOT EXISTS (SELECT 1 FROM public.overlays o LEFT JOIN public.users u ON u.id = o.owner_id WHERE u.id IS NULL) AS overlay,
				(SELECT count(*) FROM auth.account WHERE provider_id = 'twitch' AND refresh_token IS NOT NULL AND refresh_token ~ '^[0-9a-f]+$') = $1 AS refresh,
				(SELECT count(*) FROM public.billing_subscriptions) = $2 AS subscription,
				(SELECT count(*) FROM public.entitlement_grants) = $3 AS entitlement,
				NOT EXISTS (SELECT 1 FROM public.notification_outbox WHERE payload::text ~* '"[^"]*(secret|token|password|credential|authorization|cookie|otp)[^"]*"[[:space:]]*:') AS outbox`,
			[expected.legacyTokens, expected.subscriptions, expected.entitlements],
		);
		const row = result.rows[0];
		if (!row || Object.values(row).some((value) => value !== true)) {
			await this.#pool.query("UPDATE public.migration_runs SET status = 'maintenance_blocked', updated_at = now() WHERE id = $1", [runId]);
			throw new Error("CUTOVER_SMOKE_FAILED");
		}
		return row as Record<string, true>;
	}

	async reopen(runId: string): Promise<void> {
		const client = await this.#pool.connect();
		try {
			await client.query("BEGIN");
			const result = await client.query<{ status: string }>("SELECT status::text FROM public.migration_runs WHERE id = $1 FOR UPDATE", [runId]);
			if (result.rows[0]?.status !== "validated") throw new Error("CUTOVER_NOT_VALIDATED");
			await client.query("UPDATE public.migration_runs SET status = 'switched', updated_at = now() WHERE id = $1", [runId]);
			await client.query("UPDATE public.migration_runs SET status = 'reopened', updated_at = now(), completed_at = now() WHERE id = $1", [runId]);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK").catch(() => undefined);
			throw error;
		} finally {
			client.release();
		}
	}

	async getRunStatus(runId: string): Promise<string | null> {
		const result = await this.#pool.query<{ status: string }>("SELECT status::text FROM public.migration_runs WHERE id = $1", [runId]);
		return result.rows[0]?.status ?? null;
	}
}

export async function runPostgresDryRun(environment: NodeJS.ProcessEnv = process.env) {
	const databaseUrl = requiredSetting(environment, "AUTH_CUTOVER_DATABASE_URL");
	const artifactDir = resolve(requiredSetting(environment, "AUTH_CUTOVER_ARTIFACT_DIR"));
	const repository = new PostgresCutoverRepository(databaseUrl, environment);
	try {
		const inspection = await repository.inspectSource();
		const runId = randomUUID();
		const manifest = buildManifest({
			runId,
			sourceFingerprint: inspection.sourceFingerprint,
			versions: { app: environment.npm_package_version ?? "unknown", postgres: inspection.postgresVersion },
			createdAt: new Date().toISOString(),
			mode: "dry-run",
			counts: inspection.counts,
		});
		mkdirSync(artifactDir, { recursive: true });
		const manifestPath = resolve(artifactDir, `${runId}.manifest.json`);
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
		return { mode: "dry-run" as const, runId, sourceFingerprint: inspection.sourceFingerprint, manifestPath, counts: inspection.counts };
	} finally {
		await repository.close();
	}
}

export async function runPostgresApply(environment: NodeJS.ProcessEnv = process.env) {
	if (environment.AUTH_CUTOVER_OPERATOR_APPROVED !== "1") throw new Error("OPERATOR_APPROVAL_REQUIRED");
	const databaseUrl = requiredSetting(environment, "AUTH_CUTOVER_DATABASE_URL");
	const runId = requiredSetting(environment, "AUTH_CUTOVER_RUN_ID");
	const manifestPath = resolve(requiredSetting(environment, "AUTH_CUTOVER_MANIFEST_PATH"));
	const attestationPath = resolve(requiredSetting(environment, "AUTH_CUTOVER_BACKUP_ATTESTATION"));
	const betterAuthSecret = requiredSetting(environment, "BETTER_AUTH_SECRET");
	if (!requiredSetting(environment, "DB_SECRET_KEY")) throw new Error("DB_SECRET_KEY_REQUIRED");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CutoverManifest;
	if (!verifyManifest(manifest) || manifest.runId !== runId) throw new Error("MANIFEST_INVALID");
	const attestation = JSON.parse(readFileSync(attestationPath, "utf8")) as BackupAttestation;
	verifyBackupAttestation(attestation, { sourceFingerprint: manifest.sourceFingerprint, maximumAgeMs: 24 * 60 * 60 * 1000 });
	const repository = new PostgresCutoverRepository(databaseUrl, environment);
	try {
		const inspection = await repository.inspectSource();
		if (inspection.sourceFingerprint !== manifest.sourceFingerprint) throw new Error("SOURCE_FINGERPRINT_MISMATCH");
		const result = await repository.applyBackfill({ runId, sourceFingerprint: manifest.sourceFingerprint, manifestChecksum: manifest.checksum, betterAuthSecret });
		return { mode: "apply" as const, runId, sourceFingerprint: manifest.sourceFingerprint, maintenance: true, status: "migrating" as const, ...result };
	} finally {
		await repository.close();
	}
}

export async function runPostgresValidate(environment: NodeJS.ProcessEnv = process.env) {
	const databaseUrl = requiredSetting(environment, "AUTH_CUTOVER_DATABASE_URL");
	const runId = requiredSetting(environment, "AUTH_CUTOVER_RUN_ID");
	const manifestPath = resolve(requiredSetting(environment, "AUTH_CUTOVER_MANIFEST_PATH"));
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CutoverManifest;
	if (!verifyManifest(manifest) || manifest.runId !== runId || !manifest.counts) throw new Error("MANIFEST_INVALID");
	const repository = new PostgresCutoverRepository(databaseUrl, environment);
	try {
		const inspection = await repository.inspectSource();
		if (inspection.sourceFingerprint !== manifest.sourceFingerprint) throw new Error("SOURCE_FINGERPRINT_MISMATCH");
		const validation = await repository.validateBackfill(runId, manifest.counts as CutoverCounts);
		return { mode: "validate" as const, runId, sourceFingerprint: manifest.sourceFingerprint, maintenance: true, status: "validated" as const, ...validation };
	} finally {
		await repository.close();
	}
}

export async function runPostgresSmoke(environment: NodeJS.ProcessEnv = process.env) {
	if (environment.AUTH_CUTOVER_REOPEN_APPROVED !== "1") throw new Error("REOPEN_APPROVAL_REQUIRED");
	const databaseUrl = requiredSetting(environment, "AUTH_CUTOVER_DATABASE_URL");
	const runId = requiredSetting(environment, "AUTH_CUTOVER_RUN_ID");
	const artifactDir = resolve(requiredSetting(environment, "AUTH_CUTOVER_ARTIFACT_DIR"));
	const manifestPath = resolve(requiredSetting(environment, "AUTH_CUTOVER_MANIFEST_PATH"));
	const signingSecret = requiredSetting(environment, "BETTER_AUTH_SECRET");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as CutoverManifest;
	if (!verifyManifest(manifest) || manifest.runId !== runId || !manifest.counts) throw new Error("MANIFEST_INVALID");
	const repository = new PostgresCutoverRepository(databaseUrl, environment);
	try {
		const finalManifestPath = resolve(artifactDir, `${runId}.final-manifest.json`);
		if ((await repository.getRunStatus(runId)) === "reopened") {
			if (!existsSync(finalManifestPath)) throw new Error("FINAL_MANIFEST_MISSING");
			const persisted = JSON.parse(readFileSync(finalManifestPath, "utf8")) as CutoverManifest & { signature?: string };
			if (!persisted.signature || persisted.runId !== runId || persisted.status !== "reopened" || !verifyManifest(persisted) || !verifyManifestSignature(persisted, persisted.signature, signingSecret)) throw new Error("FINAL_MANIFEST_INVALID");
			return { mode: "smoke" as const, runId, status: "reopened" as const, maintenance: false, manifestPath: finalManifestPath, manifestChecksum: persisted.checksum, manifestSignature: persisted.signature };
		}
		const inspection = await repository.inspectSource();
		if (inspection.sourceFingerprint !== manifest.sourceFingerprint) throw new Error("SOURCE_FINGERPRINT_MISMATCH");
		const smoke = { passed: true as const, checks: await repository.runSmoke(runId, manifest.counts as CutoverCounts) };
		await repository.reopen(runId);
		const finalManifest = buildManifest({
			runId,
			sourceFingerprint: manifest.sourceFingerprint,
			versions: manifest.versions,
			createdAt: new Date().toISOString(),
			mode: "smoke",
			counts: manifest.counts,
			status: "reopened",
			smoke,
		});
		const signature = signManifest(finalManifest, signingSecret);
		mkdirSync(artifactDir, { recursive: true });
		writeFileSync(finalManifestPath, `${JSON.stringify({ ...finalManifest, signature }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
		return { mode: "smoke" as const, runId, status: "reopened" as const, maintenance: false, manifestPath: finalManifestPath, manifestChecksum: finalManifest.checksum, manifestSignature: signature };
	} finally {
		await repository.close();
	}
}
