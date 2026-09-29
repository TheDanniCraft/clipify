/** @jest-environment node */

import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";

// Jest cannot load Better Auth's ESM-only crypto entrypoint. Keep this repository
// test in process for coverage, but delegate encryption to Bun so the disposable
// database always receives production-compatible Better Auth ciphertext.
jest.mock("better-auth/crypto", () => ({
	symmetricEncrypt: async (input: { data: string; key: string }) => {
		const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
		const result = spawnSync("bun", ["-e", 'import { symmetricEncrypt } from "better-auth/crypto"; const input = await Bun.stdin.json(); process.stdout.write(await symmetricEncrypt(input));'], { encoding: "utf8", input: JSON.stringify(input) });
		if (result.status !== 0) throw new Error(result.stderr || "BETTER_AUTH_ENCRYPTION_SUBPROCESS_FAILED");
		return result.stdout;
	},
}));

import { PostgresCutoverRepository, runPostgresApply, runPostgresDryRun, runPostgresSmoke, runPostgresValidate } from "../../../scripts/auth-cutover/postgres";

const databaseUrl = process.env.AUTH_CUTOVER_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const environment = (values: Record<string, string> = {}): NodeJS.ProcessEnv => ({ NODE_ENV: "test", ...values }) as NodeJS.ProcessEnv;

describePostgres("TDD-US6-006 direct PostgreSQL cutover repository", () => {
	let artifacts: string;

	beforeAll(() => {
		artifacts = mkdtempSync(join(tmpdir(), "clipify-auth-cutover-direct-"));
	});

	afterAll(() => {
		rmSync(artifacts, { recursive: true, force: true });
	});

	it("runs dry-run, apply, validate, idempotent resume, and approved smoke in process", async () => {
		const baseEnvironment: NodeJS.ProcessEnv = {
			...process.env,
			AUTH_CUTOVER_DATABASE_URL: databaseUrl,
			AUTH_CUTOVER_ENV: "rehearsal",
			AUTH_CUTOVER_ARTIFACT_DIR: artifacts,
		};
		const dryRun = await runPostgresDryRun(baseEnvironment);
		expect(dryRun).toEqual(expect.objectContaining({ mode: "dry-run", runId: expect.any(String), sourceFingerprint: expect.stringMatching(/^sha256:/), manifestPath: expect.any(String) }));

		const attestationPath = join(artifacts, `${dryRun.runId}.backup-attestation.json`);
		writeFileSync(
			attestationPath,
			JSON.stringify({
				createdAt: new Date().toISOString(),
				checksum: "sha256:6f83926a1f7c1bf1139d07a726f3976c3f98ef5731b36262888aaa03d15155ce",
				checksumVerified: true,
				restoreDrillReference: "clipify_auth_direct_coverage_restore",
				sourceFingerprint: dryRun.sourceFingerprint,
				versions: { postgres: "17.10", pgDump: "17.4" },
				availableBytes: 1_000_000,
				requiredBytes: 196_998,
			}),
			"utf8",
		);
		const approvedEnvironment = {
			...baseEnvironment,
			AUTH_CUTOVER_OPERATOR_APPROVED: "1",
			AUTH_CUTOVER_RUN_ID: dryRun.runId,
			AUTH_CUTOVER_MANIFEST_PATH: dryRun.manifestPath,
			AUTH_CUTOVER_BACKUP_ATTESTATION: attestationPath,
		};

		await expect(runPostgresApply(approvedEnvironment)).resolves.toEqual(expect.objectContaining({ mode: "apply", runId: dryRun.runId, maintenance: true, anomalies: 0 }));
		await expect(runPostgresApply(approvedEnvironment)).resolves.toEqual(expect.objectContaining({ mode: "apply", runId: dryRun.runId, maintenance: true, anomalies: 0 }));
		await expect(runPostgresValidate(approvedEnvironment)).resolves.toEqual(expect.objectContaining({ mode: "validate", runId: dryRun.runId, valid: true, maintenance: true }));
		const smokeEnvironment = { ...approvedEnvironment, AUTH_CUTOVER_REOPEN_APPROVED: "1" };
		const smoke = await runPostgresSmoke(smokeEnvironment);
		expect(smoke).toEqual(expect.objectContaining({ mode: "smoke", runId: dryRun.runId, status: "reopened", maintenance: false, manifestSignature: expect.stringMatching(/^hmac-sha256:/) }));
		await expect(runPostgresSmoke(smokeEnvironment)).resolves.toEqual(smoke);
	}, 30_000);

	it("rejects missing approvals, settings, unsafe targets, and invalid protocols before connecting", async () => {
		await expect(runPostgresDryRun()).rejects.toThrow("AUTH_CUTOVER_DATABASE_URL_REQUIRED");
		await expect(runPostgresDryRun(environment())).rejects.toThrow("AUTH_CUTOVER_DATABASE_URL_REQUIRED");
		await expect(runPostgresApply()).rejects.toThrow("OPERATOR_APPROVAL_REQUIRED");
		await expect(runPostgresApply(environment())).rejects.toThrow("OPERATOR_APPROVAL_REQUIRED");
		await expect(runPostgresValidate()).rejects.toThrow("AUTH_CUTOVER_DATABASE_URL_REQUIRED");
		await expect(runPostgresSmoke()).rejects.toThrow("REOPEN_APPROVAL_REQUIRED");
		await expect(runPostgresSmoke(environment())).rejects.toThrow("REOPEN_APPROVAL_REQUIRED");
		expect(() => new PostgresCutoverRepository("postgres://localhost/test")).toThrow("CUTOVER_ENVIRONMENT_REQUIRED");
		expect(() => new PostgresCutoverRepository("postgres://localhost/test", environment())).toThrow("CUTOVER_ENVIRONMENT_REQUIRED");
		expect(() => new PostgresCutoverRepository("postgres://localhost/test", environment({ AUTH_CUTOVER_ENV: "production" }))).toThrow("PRODUCTION_TARGET_APPROVAL_REQUIRED");
		expect(() => new PostgresCutoverRepository("https://localhost/test", environment({ AUTH_CUTOVER_ENV: "rehearsal" }))).toThrow("POSTGRES_TARGET_REQUIRED");
		expect(() => new PostgresCutoverRepository("postgres://localhost", environment({ AUTH_CUTOVER_ENV: "rehearsal" }))).toThrow("DATABASE_NAME_REQUIRED");
		expect(() => new PostgresCutoverRepository("postgres://localhost/clipify", environment({ AUTH_CUTOVER_ENV: "rehearsal" }))).toThrow("DISPOSABLE_DATABASE_NAME_REQUIRED");
	});

	it("removes an approved orphan editor relationship only at successful reopen", async () => {
		const runId = randomUUID();
		const editorId = `orphan-editor-${runId}`;
		const pool = new Pool({ connectionString: databaseUrl, max: 1 });
		const repository = new PostgresCutoverRepository(databaseUrl!, { ...process.env, AUTH_CUTOVER_ENV: "rehearsal", AUTH_CUTOVER_ALLOW_DEFAULT_DATABASE: "1" });
		try {
			const owner = await pool.query<{ id: string }>("SELECT id FROM public.users ORDER BY id LIMIT 1");
			expect(owner.rows[0]?.id).toBeTruthy();
			const ownerId = owner.rows[0]!.id;
			const sourceHash = createHash("sha256").update(`${ownerId}\u0000${editorId}`, "utf8").digest("hex");
			await pool.query("INSERT INTO public.editors (user_id, editor_id) VALUES ($1, $2)", [ownerId, editorId]);
			await pool.query("INSERT INTO public.migration_runs (id, status, source_fingerprint, manifest_checksum) VALUES ($1, 'validated', 'sha256:orphan-test', 'sha256:orphan-test')", [runId]);
			await pool.query("INSERT INTO public.migration_anomalies (run_id, source_hash, category, blocking, status, resolution, resolved_at) VALUES ($1, $2, 'orphan-editor-pruned', false, 'accepted', 'test-approved stale relationship', now())", [runId, sourceHash]);

			await repository.reopen(runId);

			const relationship = await pool.query("SELECT 1 FROM public.editors WHERE user_id = $1 AND editor_id = $2", [ownerId, editorId]);
			expect(relationship.rowCount).toBe(0);
			await expect(repository.getRunStatus(runId)).resolves.toBe("reopened");
		} finally {
			await pool.query("DELETE FROM public.editors WHERE editor_id = $1", [editorId]);
			await pool.query("DELETE FROM public.migration_runs WHERE id = $1", [runId]);
			await pool.end();
			await repository.close();
		}
	}, 30_000);

	it("fails closed for invalid invariants, smoke results, reopen state, and run binding", async () => {
		const environment = { ...process.env, AUTH_CUTOVER_ENV: "rehearsal", AUTH_CUTOVER_ALLOW_DEFAULT_DATABASE: "1" };
		const repository = new PostgresCutoverRepository(databaseUrl!, environment);
		const emptyCounts = { creators: 0, legacyEditors: 0, legacyTokens: 0, resources: 0, subscriptions: 0, entitlements: 0 };
		await expect(repository.validateBackfill(randomUUID(), emptyCounts)).rejects.toThrow("CUTOVER_INVARIANT_FAILED");
		await expect(repository.runSmoke(randomUUID(), emptyCounts)).rejects.toThrow("CUTOVER_SMOKE_FAILED");
		await expect(repository.reopen(randomUUID())).rejects.toThrow("CUTOVER_NOT_VALIDATED");
		await expect(repository.getRunStatus(randomUUID())).resolves.toBeNull();

		const runId = randomUUID();
		const pool = new Pool({ connectionString: databaseUrl, max: 1 });
		try {
			await pool.query("INSERT INTO public.migration_runs (id, status, source_fingerprint, manifest_checksum) VALUES ($1, 'created', 'sha256:original', 'sha256:original')", [runId]);
			await expect(repository.applyBackfill({ runId, sourceFingerprint: "sha256:different", manifestChecksum: "sha256:different", betterAuthSecret: process.env.BETTER_AUTH_SECRET! })).rejects.toThrow("RUN_ID_BINDING_MISMATCH");
			const status = await pool.query<{ status: string }>("SELECT status::text FROM public.migration_runs WHERE id = $1", [runId]);
			expect(status.rows[0]?.status).toBe("maintenance_blocked");
		} finally {
			await pool.query("DELETE FROM public.migration_runs WHERE id = $1", [runId]);
			await pool.end();
			await repository.close();
		}
	}, 30_000);
});
