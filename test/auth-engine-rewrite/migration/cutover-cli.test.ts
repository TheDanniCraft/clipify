/** @jest-environment node */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";

const databaseUrl = process.env.AUTH_CUTOVER_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

type DryRunResult = {
	mode: "dry-run";
	runId: string;
	sourceFingerprint: string;
	manifestPath: string;
	counts: {
		creators: number;
		legacyEditors: number;
		legacyTokens: number;
		resources: number;
		subscriptions: number;
		entitlements: number;
	};
};

function invokeCli(args: string[], artifactDir: string, environment: Partial<NodeJS.ProcessEnv> = {}) {
	return spawnSync("bun", ["scripts/auth-cutover.ts", ...args], {
		cwd: process.cwd(),
		encoding: "utf8",
		env: {
			...process.env,
			AUTH_CUTOVER_DATABASE_URL: databaseUrl,
			AUTH_CUTOVER_ENV: "rehearsal",
			AUTH_CUTOVER_ARTIFACT_DIR: artifactDir,
			...environment,
		},
	});
}

describePostgres("TDD-US6-004 real cutover CLI", () => {
	let artifacts: string;
	let pool: Pool;
	let dryRun: DryRunResult;

	beforeAll(() => {
		artifacts = mkdtempSync(join(tmpdir(), "clipify-auth-cutover-"));
		pool = new Pool({ connectionString: databaseUrl, max: 1 });
	});

	afterAll(async () => {
		await pool.end();
		rmSync(artifacts, { recursive: true, force: true });
	});

	it("runs a read-only dry-run against PostgreSQL and writes a checksum-bound manifest", async () => {
		const before = await pool.query<{ runs: string; checkpoints: string }>("SELECT (SELECT count(*) FROM public.migration_runs)::text AS runs, (SELECT count(*) FROM public.migration_checkpoints)::text AS checkpoints");
		const result = invokeCli(["dry-run"], artifacts);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		const output = JSON.parse(result.stdout.trim()) as DryRunResult;
		dryRun = output;
		expect(output).toEqual({
			mode: "dry-run",
			runId: expect.stringMatching(/^[0-9a-f-]{36}$/),
			sourceFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
			manifestPath: expect.any(String),
			counts: {
				creators: expect.any(Number),
				legacyEditors: expect.any(Number),
				legacyTokens: expect.any(Number),
				resources: expect.any(Number),
				subscriptions: expect.any(Number),
				entitlements: expect.any(Number),
			},
		});
		expect(output.manifestPath).toContain(output.runId);
		const manifest = JSON.parse(readFileSync(output.manifestPath, "utf8")) as Record<string, unknown>;
		expect(manifest).toEqual(expect.objectContaining({ runId: output.runId, sourceFingerprint: output.sourceFingerprint, checksum: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) }));

		const after = await pool.query<{ runs: string; checkpoints: string }>("SELECT (SELECT count(*) FROM public.migration_runs)::text AS runs, (SELECT count(*) FROM public.migration_checkpoints)::text AS checkpoints");
		expect(after.rows).toEqual(before.rows);
	});

	it("blocks apply without explicit operator approval", () => {
		const result = invokeCli(["apply"], artifacts, { AUTH_CUTOVER_RUN_ID: dryRun.runId, AUTH_CUTOVER_MANIFEST_PATH: dryRun.manifestPath });
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("OPERATOR_APPROVAL_REQUIRED");
		expect(result.stderr).not.toContain(databaseUrl);
	});

	it("applies, checkpoints, and reruns the real PostgreSQL backfill idempotently", async () => {
		const attestationPath = join(artifacts, `${dryRun.runId}.backup-attestation.json`);
		writeFileSync(
			attestationPath,
			JSON.stringify({
				createdAt: new Date().toISOString(),
				checksum: "sha256:6f83926a1f7c1bf1139d07a726f3976c3f98ef5731b36262888aaa03d15155ce",
				checksumVerified: true,
				restoreDrillReference: "clipify_auth_rehearsal_restore_20260928_215758",
				sourceFingerprint: dryRun.sourceFingerprint,
				versions: { postgres: "17.10", pgDump: "17.4" },
				availableBytes: 1_000_000,
				requiredBytes: 196_998,
			}),
			"utf8",
		);
		const environment = {
			AUTH_CUTOVER_OPERATOR_APPROVED: "1",
			AUTH_CUTOVER_RUN_ID: dryRun.runId,
			AUTH_CUTOVER_MANIFEST_PATH: dryRun.manifestPath,
			AUTH_CUTOVER_BACKUP_ATTESTATION: attestationPath,
		};
		const first = invokeCli(["apply"], artifacts, environment);
		expect(first.status).toBe(0);
		expect(first.stderr).toBe("");
		expect(JSON.parse(first.stdout)).toEqual(expect.objectContaining({ mode: "apply", runId: dryRun.runId, maintenance: true, status: "migrating", creators: dryRun.counts.creators, owners: dryRun.counts.creators, credentials: dryRun.counts.legacyTokens, anomalies: 0 }));

		const persisted = await pool.query<{ auth_users: string; accounts: string; owners: string; operations: string; checkpoints: string; status: string }>(
			`
			SELECT
				(SELECT count(*) FROM auth.user)::text AS auth_users,
				(SELECT count(*) FROM auth.account WHERE provider_id = 'twitch')::text AS accounts,
				(SELECT count(*) FROM auth.member WHERE role = 'owner')::text AS owners,
				(SELECT count(*) FROM auth.member WHERE role = 'operations')::text AS operations,
				(SELECT count(*) FROM public.migration_checkpoints WHERE run_id = $1)::text AS checkpoints,
				(SELECT status::text FROM public.migration_runs WHERE id = $1) AS status
		`,
			[dryRun.runId],
		);
		expect(persisted.rows[0]).toEqual({ auth_users: String(dryRun.counts.creators), accounts: String(dryRun.counts.creators), owners: String(dryRun.counts.creators), operations: String(dryRun.counts.legacyEditors), checkpoints: "3", status: "migrating" });

		const second = invokeCli(["resume"], artifacts, environment);
		expect(second.status).toBe(0);
		const rerun = await pool.query("SELECT (SELECT count(*) FROM auth.user)::int AS auth_users, (SELECT count(*) FROM auth.member)::int AS members, (SELECT count(*) FROM public.migration_checkpoints WHERE run_id = $1)::int AS checkpoints", [dryRun.runId]);
		expect(rerun.rows[0]).toEqual({ auth_users: dryRun.counts.creators, members: dryRun.counts.creators + dryRun.counts.legacyEditors, checkpoints: 3 });
	});

	it("validates every persisted identity, membership, credential, and anomaly invariant", async () => {
		const result = invokeCli(["validate"], artifacts, { AUTH_CUTOVER_RUN_ID: dryRun.runId, AUTH_CUTOVER_MANIFEST_PATH: dryRun.manifestPath });
		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({ mode: "validate", runId: dryRun.runId, status: "validated", maintenance: true, valid: true, creators: dryRun.counts.creators, owners: dryRun.counts.creators, operations: dryRun.counts.legacyEditors, credentials: dryRun.counts.legacyTokens, anomalies: 0 }));
		const persisted = await pool.query<{ status: string }>("SELECT status::text FROM public.migration_runs WHERE id = $1", [dryRun.runId]);
		expect(persisted.rows[0]?.status).toBe("validated");
	});

	it("rejects a database that is not explicitly marked as a rehearsal target", () => {
		const result = spawnSync("bun", ["scripts/auth-cutover.ts", "dry-run"], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: { ...process.env, AUTH_CUTOVER_DATABASE_URL: databaseUrl, AUTH_CUTOVER_ENV: "production", AUTH_CUTOVER_ARTIFACT_DIR: artifacts },
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("REHEARSAL_TARGET_REQUIRED");
		expect(result.stderr).not.toContain(databaseUrl);
	});
});
