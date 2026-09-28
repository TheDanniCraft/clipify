/** @jest-environment node */
import { buildManifest, checkpointIdempotencyKey, executeCheckpointBatch, parseCutoverCommand, transitionCutover, type CutoverRun } from "../../../scripts/auth-cutover/state-machine";

const run = (): CutoverRun => ({ id: "run-001", status: "created", maintenance: false, checkpoints: {} });

describe("TDD-US6-001 cutover state machine", () => {
	it.each([
		["created", "preflighted"],
		["preflighted", "backup_verified"],
		["backup_verified", "migrating"],
		["migrating", "validated"],
		["validated", "switched"],
		["switched", "reopened"],
		["reopened", "contracted"],
	] as const)("permits %s -> %s", (from, to) => {
		expect(transitionCutover({ ...run(), status: from }, to).status).toBe(to);
	});

	it.each([
		["created", "migrating"],
		["preflighted", "switched"],
		["migrating", "reopened"],
		["maintenance_blocked", "reopened"],
	] as const)("rejects illegal %s -> %s", (from, to) => {
		expect(() => transitionCutover({ ...run(), status: from }, to)).toThrow("ILLEGAL_CUTOVER_TRANSITION");
	});

	it("enters maintenance before migration and only leaves it on explicit reopen", () => {
		const migrating = transitionCutover({ ...run(), status: "backup_verified" }, "migrating");
		expect(migrating.maintenance).toBe(true);
		const switched = transitionCutover({ ...migrating, status: "validated" }, "switched");
		expect(switched.maintenance).toBe(true);
		expect(transitionCutover(switched, "reopened").maintenance).toBe(false);
	});

	it("rolls a partial batch back and advances its cursor only after commit", async () => {
		let rows: number[] = [];
		let cursor = 0;
		const execute = (values: number[], fail = false) =>
			executeCheckpointBatch({
				runId: "run-001",
				phase: "identity",
				cursor,
				values,
				transaction: async (operation) => {
					const draft = [...rows];
					const result = await operation({
						write: (value) => {
							draft.push(value);
							if (fail && value === 2) throw new Error("injected");
						},
					});
					rows = draft;
					return result;
				},
				onCommitted: (next) => {
					cursor = next;
				},
			});
		await expect(execute([1, 2], true)).rejects.toThrow("injected");
		expect(rows).toEqual([]);
		expect(cursor).toBe(0);
		await execute([1, 2]);
		expect(rows).toEqual([1, 2]);
		expect(cursor).toBe(2);
	});

	it("uses deterministic checkpoint idempotency keys", () => {
		expect(checkpointIdempotencyKey("run-001", "identity", 50)).toBe(checkpointIdempotencyKey("run-001", "identity", 50));
		expect(checkpointIdempotencyKey("run-001", "identity", 50)).not.toBe(checkpointIdempotencyKey("run-001", "identity", 51));
	});

	it("skips an already committed batch on rerun", async () => {
		const writes: number[] = [];
		const committed = new Set<string>();
		const input = {
			runId: "run-001",
			phase: "identity",
			cursor: 0,
			values: [1, 2],
			transaction: async <R>(operation: (writer: { write: (value: number) => void }) => Promise<R>) =>
				operation({
					write: (value) => {
						writes.push(value);
					},
				}),
			onCommitted: (_next: number, key: string) => {
				committed.add(key);
			},
			isCommitted: (key: string) => committed.has(key),
		};
		expect((await executeCheckpointBatch(input)).skipped).toBe(false);
		expect((await executeCheckpointBatch(input)).skipped).toBe(true);
		expect(writes).toEqual([1, 2]);
	});

	it("builds an immutable checksum-bound manifest", () => {
		const manifest = buildManifest({ runId: "run-001", sourceFingerprint: "sha256:source", versions: { app: "abc123" }, createdAt: "2026-09-28T12:00:00.000Z" });
		expect(manifest.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(Object.isFrozen(manifest)).toBe(true);
		expect(() => {
			(manifest as { checksum: string }).checksum = "tampered";
		}).toThrow();
	});

	it.each(["dry-run", "apply", "resume", "validate", "smoke"] as const)("parses the %s mode", (mode) => {
		expect(parseCutoverCommand([mode])).toEqual({ mode });
	});

	it.each(["--password=secret", "--token=secret", "--database-url=postgres://secret"])("forbids credentials in command arguments: %s", (argument) => {
		expect(() => parseCutoverCommand(["apply", argument])).toThrow("CREDENTIAL_ARGUMENT_FORBIDDEN");
	});
});
