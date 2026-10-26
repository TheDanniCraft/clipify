import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { ExecutionJournal, type ExecutionRecord } from "../execution-journal";
import { RunnerScheduleCache } from "../schedule-cache";
import { scheduleAuthorizationFixture } from "../../test/support/schedule-fixture";
import { tmpdir } from "node:os";
import { join } from "node:path";

function executionRecord(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
	return { admissionId: "11111111-1111-4111-8111-111111111111", ownerId: "creator", runnerId: "22222222-2222-4222-8222-222222222222", sessionId: "33333333-3333-4333-8333-333333333333", executionGeneration: "44444444-4444-4444-8444-444444444444", leaseId: "55555555-5555-4555-8555-555555555555", configurationRevision: 2, state: "stopped" as const, allOutputsClosed: true as const, updatedAt: 1000, ...overrides };
}

test("TDD-US1-FR004: a closed-output receipt survives restart until server acknowledgement", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-execution-journal-"));
	try {
		const receipt = executionRecord();
		const first = new ExecutionJournal(directory);
		first.save(receipt);
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([receipt]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: only a matching terminal acknowledgment retires a persisted receipt", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-ack-"));
	try {
		const receipt = executionRecord();
		const journal = new ExecutionJournal(directory);
		journal.save(receipt);
		expect(journal.acknowledge(receipt.admissionId, "66666666-6666-4666-8666-666666666666")).toBe(false);
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([receipt]);
		expect(journal.acknowledge(receipt.admissionId, receipt.executionGeneration)).toBe(true);
		expect(journal.acknowledge(receipt.admissionId, receipt.executionGeneration)).toBe(true);
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: invalid records cannot replace durable closure proof", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-validation-"));
	try {
		const journal = new ExecutionJournal(directory),
			receipt = executionRecord();
		journal.save(receipt);
		const occurrence = { occurrenceId: "captured-occurrence", start: 1000, end: 2000 };
		const invalid = [
			{ ...receipt, playbackOutcome: "invented" },
			{ ...receipt, state: "pending", allOutputsClosed: undefined },
			{ ...receipt, occurrence: null },
			{ ...receipt, occurrence: [] },
			{ ...receipt, occurrence: { ...occurrence, occurrenceId: "" } },
			{ ...receipt, occurrence: { ...occurrence, end: 1000 } },
			{ ...receipt, occurrence: { ...occurrence, suppressed: "yes" } },
			{ ...receipt, occurrence: { ...occurrence, explicitResume: false } },
			null,
			[],
			{ ...receipt, runnerId: "invalid" },
			{ ...receipt, ownerId: "" },
			{ ...receipt, ownerId: "x".repeat(257) },
			{ ...receipt, configurationRevision: 0 },
			{ ...receipt, configurationRevision: 1.5 },
			{ ...receipt, updatedAt: -1 },
			{ ...receipt, updatedAt: NaN },
			{ ...receipt, state: "unknown" },
			{ ...receipt, allOutputsClosed: undefined },
		];
		for (const value of invalid) {
			expect(() => journal.save(value as ExecutionRecord)).toThrow();
			expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([receipt]);
		}
		expect(journal.get("unknown")).toBeUndefined();
		const copy = journal.get(receipt.admissionId)!;
		copy.ownerId = "mutated";
		expect(journal.get(receipt.admissionId)?.ownerId).toBe(receipt.ownerId);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: unsupported and oversized snapshots fail closed", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-snapshot-"));
	try {
		for (const snapshot of [JSON.stringify({ version: 2, executions: [] }), JSON.stringify({ version: 1, executions: {} }), JSON.stringify({ version: 1, executions: [null] }), " ".repeat(2 * 1024 * 1024 + 1)]) {
			writeFileSync(join(directory, "execution-journal.json"), snapshot);
			expect(() => new ExecutionJournal(directory)).toThrow("Execution journal snapshot invalid");
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: failed atomic replacement preserves the previous journal and removes the temporary file", async () => {
	const fs = await import("node:fs");
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-atomic-"));
	try {
		const previous = executionRecord({ state: "starting", allOutputsClosed: undefined });
		const journal = new ExecutionJournal(directory);
		journal.save(previous);
		const path = join(directory, "execution-journal.json"),
			original = fs.readFileSync(path, "utf8");
		const rename = jest.spyOn(jest.requireActual("node:fs"), "renameSync").mockImplementationOnce(() => {
			throw new Error("controlled disk failure");
		});
		try {
			expect(() => journal.save({ ...previous, state: "active", updatedAt: 2000 })).toThrow("controlled disk failure");
		} finally {
			rename.mockRestore();
		}
		expect(fs.readFileSync(path, "utf8")).toBe(original);
		expect(fs.readdirSync(directory)).toEqual(["execution-journal.json"]);
		if (process.platform !== "win32") expect(fs.statSync(path).mode & 0o777).toBe(0o600);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: corrupt journal loading fails closed without echoing its contents", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-corrupt-"));
	try {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(join(directory, "execution-journal.json"), "private-fixture-token");
		let failure: unknown;
		try {
			new ExecutionJournal(directory);
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toBe("Execution journal snapshot invalid");
		expect((failure as Error).message).not.toContain("private-fixture-token");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: terminal journal state cannot be reactivated by a replayed execution", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-terminal-"));
	try {
		const journal = new ExecutionJournal(directory),
			receipt = executionRecord();
		journal.save(receipt);
		expect(() => journal.save({ ...receipt, state: "active", allOutputsClosed: undefined })).toThrow("Execution journal transition invalid");
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([receipt]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["ownerId", "runnerId", "sessionId", "executionGeneration", "leaseId", "configurationRevision"] as const)("TDD-US1-FR004: persisted admission cannot change its %s identity", (key) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-binding-"));
	try {
		const journal = new ExecutionJournal(directory),
			original = executionRecord({ state: "starting", allOutputsClosed: undefined });
		journal.save(original);
		const changed = { ...original, [key]: key === "configurationRevision" ? 3 : key === "ownerId" ? "other-owner" : "77777777-7777-4777-8777-777777777777" };
		expect(() => journal.save(changed)).toThrow("Execution journal identity changed");
		journal.save({ ...original, state: "stopped", allOutputsClosed: true });
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([{ ...original, state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["starting", "active"] as const)("TDD-US1-FR004: draining journal state cannot return to %s", (state) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-draining-"));
	try {
		const journal = new ExecutionJournal(directory),
			original = executionRecord({ state: "draining", allOutputsClosed: undefined });
		journal.save(original);
		expect(() => journal.save({ ...original, state })).toThrow("Execution journal transition invalid");
		journal.save({ ...original, state: "stopped", allOutputsClosed: true });
		expect(new ExecutionJournal(directory).pendingTerminals()).toHaveLength(1);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: an active scheduled execution retains its immutable occurrence bounds through restart", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-scheduled-journal-"));
	try {
		const occurrence = { occurrenceId: '["event","2026-10-16"]', start: 1000, end: 60000 };
		const captured = { ...executionRecord({ state: "active", allOutputsClosed: undefined }), occurrence };
		const journal = new ExecutionJournal(directory);
		journal.save(captured);
		expect(new ExecutionJournal(directory).get(captured.admissionId)).toEqual(captured);
		const changed = { ...captured, occurrence: { ...occurrence, end: 120000 } };
		expect(() => journal.save(changed)).toThrow("Execution journal identity changed");
		expect(new ExecutionJournal(directory).get(captured.admissionId)).toEqual(captured);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008 U256: bounded cleanup retains active output and unacknowledged receipts", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-retention-"));
	try {
		const journal = new ExecutionJournal(directory);
		const active = executionRecord({ state: "active", allOutputsClosed: undefined });
		const acknowledged = executionRecord({ admissionId: "66666666-6666-4666-8666-666666666666", acknowledged: true });
		const pending = executionRecord({ admissionId: "77777777-7777-4777-8777-777777777777" });
		journal.save(active);
		journal.save(acknowledged);
		journal.save(pending);
		journal.prune(8 * 86400000);
		const restored = new ExecutionJournal(directory);
		expect(restored.get(acknowledged.admissionId)).toBeUndefined();
		expect(restored.get(active.admissionId)).toEqual(active);
		expect(restored.pendingTerminals()).toEqual([pending]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008 U257: cleanup and restart retain a stopped occurrence's suppression through its full window", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-suppression-"));
	try {
		const journal = new ExecutionJournal(directory);
		const occurrence = { occurrenceId: '["vacation","original"]', start: 1000, end: 10 * 86400000, suppressed: true as const };
		const stopped = { ...executionRecord({ acknowledged: true }), occurrence };
		journal.save(stopped);
		journal.prune(8 * 86400000);
		expect(new ExecutionJournal(directory).get(stopped.admissionId)).toEqual(stopped);
		expect(() => journal.save({ ...stopped, occurrence: { ...occurrence, suppressed: false } })).toThrow("Execution journal identity changed");
		expect(new ExecutionJournal(directory).get(stopped.admissionId)).toEqual(stopped);
		journal.prune(18 * 86400000);
		expect(new ExecutionJournal(directory).get(stopped.admissionId)).toBeUndefined();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: manual Stop can durably suppress an active occurrence without rewriting its bounds", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-stop-"));
	try {
		const journal = new ExecutionJournal(directory);
		const occurrence = { occurrenceId: '["event","anchor"]', start: 1000, end: 60000 };
		const active = { ...executionRecord({ state: "active", allOutputsClosed: undefined }), occurrence };
		journal.save(active);
		const stopped = { ...active, state: "draining" as const, occurrence: { ...occurrence, suppressed: true } };
		expect(() => journal.save(stopped)).not.toThrow();
		const restored = new ExecutionJournal(directory);
		expect(restored.get(active.admissionId)).toEqual(stopped);
		const copy = restored.get(active.admissionId)!;
		copy.occurrence!.end = 120000;
		expect(restored.get(active.admissionId)).toEqual(stopped);
		expect(() => restored.save({ ...stopped, occurrence })).toThrow("Execution journal identity changed");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: a verified future admission can be journaled pending without claiming active output or terminal closure", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-pending-journal-"));
	try {
		const journal = new ExecutionJournal(directory);
		const pending = { ...executionRecord({ allOutputsClosed: undefined }), state: "pending" as const, occurrence: { occurrenceId: '["event","future"]', start: 10000, end: 20000 } };
		expect(() => journal.save(pending)).not.toThrow();
		const restored = new ExecutionJournal(directory);
		expect(restored.get(pending.admissionId)).toEqual(pending);
		expect(restored.pendingTerminals()).toEqual([]);
		restored.prune(20 * 86400000);
		expect(restored.get(pending.admissionId)).toEqual(pending);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: stopping an occurrence suppresses every cached generation atomically within its owner and device", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-occurrence-floor-"));
	try {
		const journal = new ExecutionJournal(directory);
		const occurrence = { occurrenceId: '["event","anchor"]', start: 1000, end: 60000 };
		const active = { ...executionRecord({ state: "active", allOutputsClosed: undefined }), occurrence };
		const next = { ...active, admissionId: "66666666-6666-4666-8666-666666666666", configurationRevision: 3, state: "pending" as const };
		const foreign = { ...next, ownerId: "another-owner", admissionId: "77777777-7777-4777-8777-777777777777", configurationRevision: 999 };
		journal.save(active);
		journal.save(next);
		journal.save(foreign);
		journal.suppressOccurrence({ ownerId: active.ownerId, runnerId: active.runnerId, occurrenceId: occurrence.occurrenceId });
		const restored = new ExecutionJournal(directory);
		expect(restored.get(active.admissionId)).toMatchObject({ occurrence: { suppressed: true } });
		expect(restored.get(next.admissionId)).toMatchObject({ occurrence: { suppressed: true } });
		expect(restored.get(foreign.admissionId)).toEqual(foreign);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: cached response replay cannot roll back the signed revision after process restart", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-replay-"));
	try {
		const fixture = scheduleAuthorizationFixture();
		const options = { directory, runnerId: fixture.runnerId, keys: fixture.keys, clock: () => 1000, keyring: { set: jest.fn().mockResolvedValue(undefined), get: jest.fn().mockResolvedValue(null) } };
		const first = new RunnerScheduleCache(options);
		expect(await first.accept(fixture.response("11111111-1111-4111-8111-111111111111", 2000000, 2).scheduleCache, { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 })).toBe(true);
		const restarted = new RunnerScheduleCache(options);
		expect(await restarted.accept(fixture.response("22222222-2222-4222-8222-222222222222", 1000000, 1).scheduleCache, { requestId: "22222222-2222-4222-8222-222222222222", sentAt: 1000 })).toBe(false);
		expect(restarted.error).toBe("sync_required");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008 U144 baseline: failed cache replacement preserves the previous signed snapshot and protected references", async () => {
	const fs = await import("node:fs");
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-atomic-"));
	try {
		const fixture = scheduleAuthorizationFixture();
		const nonce = "11111111-1111-4111-8111-111111111111";
		const cache = new RunnerScheduleCache({ directory, runnerId: fixture.runnerId, keys: fixture.keys, clock: () => 1000, keyring: { set: jest.fn().mockRejectedValue(new Error("isolated unavailable keyring")), get: jest.fn().mockResolvedValue(null) } });
		expect(await cache.accept(fixture.response(nonce).scheduleCache, { requestId: nonce, sentAt: 1000 })).toBe(true);
		const path = join(directory, "snapshot.json");
		const previous = fs.readFileSync(path, "utf8");
		const rename = jest.spyOn(jest.requireActual("node:fs"), "renameSync").mockImplementationOnce(() => {
			throw new Error("controlled snapshot rename failure");
		});
		try {
			expect(await cache.accept(fixture.response(nonce, 1001000, 2).scheduleCache, { requestId: nonce, sentAt: 1000 })).toBe(false);
		} finally {
			rename.mockRestore();
		}
		expect(fs.readFileSync(path, "utf8")).toBe(previous);
		expect(cache.error).toBe("sync_required");
		expect(fs.readdirSync(directory).sort()).toEqual(["private-payloads.json", "snapshot.json"]);
		expect(previous).not.toContain(fixture.overlaySecret);
		expect(previous).not.toContain(fixture.streamKey);
		if (process.platform !== "win32") for (const file of fs.readdirSync(directory)) expect(fs.statSync(join(directory, file)).mode & 0o777).toBe(0o600);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: a same-boot restart restores signed cache inputs and their elapsed-time request anchor", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-restore-"));
	try {
		const fixture = scheduleAuthorizationFixture();
		const nonce = "11111111-1111-4111-8111-111111111111";
		const privateValues = new Map<string, string>();
		let elapsed = 1000,
			uptime = 50000;
		const options = {
			directory,
			runnerId: fixture.runnerId,
			keys: fixture.keys,
			clock: () => elapsed,
			uptime: () => uptime,
			bootId: () => "boot-A",
			keyring: {
				set: async (id: string, value: string) => {
					privateValues.set(id, value);
				},
				get: async (id: string) => privateValues.get(id) ?? null,
			},
		};
		const response = fixture.response(nonce).scheduleCache;
		expect(await new RunnerScheduleCache(options).accept(response, { requestId: nonce, sentAt: 1000 })).toBe(true);
		elapsed = 11000;
		uptime = 60000;
		const restarted = new RunnerScheduleCache(options);
		const restored = await restarted.restore();
		expect(restored?.jobs).toEqual([response.entries[0].job]);
		expect(restored?.request).toEqual({ requestId: nonce, sentAt: 1000 });
		expect(restored?.serverTimeLower).toBe(1010000);
		expect(restored?.serverTimeUpper).toBe(1010000);
		expect(restarted.error).toBeNull();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["corrupt JSON", "unsigned", "corrupted signed payload", "different boot", "backwards uptime", "exact expiry"])("TDD-US3-CON008 cache restore baseline: %s requires synchronization", async (variant) => {
	const fs = await import("node:fs");
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-invalid-"));
	try {
		const fixture = scheduleAuthorizationFixture();
		const nonce = "11111111-1111-4111-8111-111111111111";
		let uptime = 50000,
			boot = "boot-A";
		const payloads = new Map<string, string>();
		const get = jest.fn(async (id: string) => payloads.get(id) ?? null);
		const options = {
			directory,
			runnerId: fixture.runnerId,
			keys: fixture.keys,
			clock: () => 1000,
			uptime: () => uptime,
			bootId: () => boot,
			keyring: {
				set: async (id: string, value: string) => {
					payloads.set(id, value);
				},
				get,
			},
		};
		expect(await new RunnerScheduleCache(options).accept(fixture.response(nonce).scheduleCache, { requestId: nonce, sentAt: 1000 })).toBe(true);
		const path = join(directory, "snapshot.json");
		const stored = JSON.parse(fs.readFileSync(path, "utf8"));
		if (variant === "corrupt JSON") fs.writeFileSync(path, "private-invalid-cache-fixture");
		if (variant === "unsigned") {
			delete stored.bundle.signature;
			fs.writeFileSync(path, JSON.stringify(stored));
		}
		if (variant === "corrupted signed payload") {
			stored.bundle.payload = Buffer.from(JSON.stringify({ kind: "schedule_cache", ownerId: "tampered" })).toString("base64url");
			fs.writeFileSync(path, JSON.stringify(stored));
		}
		if (variant === "different boot") {
			boot = "boot-B";
			uptime = 60000;
		}
		if (variant === "backwards uptime") uptime--;
		if (variant === "exact expiry") uptime += 604800000;
		const restored = new RunnerScheduleCache(options);
		expect(await restored.restore()).toBeNull();
		expect(restored.error).toBe("sync_required");
		if (["corrupt JSON", "unsigned", "corrupted signed payload", "different boot", "backwards uptime"].includes(variant)) expect(get).not.toHaveBeenCalled();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["win32", "darwin"] as const)("TDD-US3-CON008: %s can identify the same OS boot when restoring a signed cache", async (platform) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-platform-boot-"));
	const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	const child = jest.requireActual("node:child_process");
	const command = jest.spyOn(child, "execFileSync").mockReturnValue(platform === "win32" ? JSON.stringify({ bootId: 42, machine: "11111111-1111-4111-8111-111111111111" }) : "22222222-2222-4222-8222-222222222222\n");
	try {
		Object.defineProperty(process, "platform", { value: platform, configurable: true });
		const fixture = scheduleAuthorizationFixture();
		const nonce = "11111111-1111-4111-8111-111111111111";
		const values = new Map<string, string>();
		const options = {
			directory,
			runnerId: fixture.runnerId,
			keys: fixture.keys,
			clock: () => 1000,
			uptime: () => 50000,
			keyring: {
				set: async (id: string, value: string) => {
					values.set(id, value);
				},
				get: async (id: string) => values.get(id) ?? null,
			},
		};
		expect(await new RunnerScheduleCache(options).accept(fixture.response(nonce).scheduleCache, { requestId: nonce, sentAt: 1000 })).toBe(true);
		const stored = JSON.parse((await import("node:fs")).readFileSync(join(directory, "snapshot.json"), "utf8"));
		expect(stored.anchor.bootId).not.toBeNull();
		expect((await new RunnerScheduleCache(options).restore())?.jobs).toHaveLength(1);
		expect(command.mock.calls.some(([executable]) => String(executable).includes(platform === "win32" ? "powershell" : "sysctl"))).toBe(true);
	} finally {
		Object.defineProperty(process, "platform", descriptor);
		command.mockRestore();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["pending", "starting", "active", "draining"] as const)("TDD-US3-CON008 unused-authority closure baseline: %s preserves physical uncertainty", (state) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-unused-authority-"));
	try {
		const journal = new ExecutionJournal(directory);
		const entry = executionRecord({ state, allOutputsClosed: undefined, occurrence: { occurrenceId: "logical-occurrence", start: 1000, end: 2000 } });
		journal.save(entry);
		journal.closeUnusedOccurrences({ ownerId: "foreign-owner", runnerId: entry.runnerId }, 2000);
		expect(journal.get(entry.admissionId)).toEqual(entry);
		journal.closeUnusedOccurrences({ ownerId: entry.ownerId, runnerId: entry.runnerId }, 1999);
		expect(journal.pendingTerminals()).toEqual([]);
		journal.closeUnusedOccurrences({ ownerId: entry.ownerId, runnerId: entry.runnerId }, 2000);
		if (state === "pending") expect(journal.pendingTerminals()).toEqual([expect.objectContaining({ state: "stopped", allOutputsClosed: true })]);
		else {
			expect(journal.pendingTerminals()).toEqual([]);
			expect(journal.get(entry.admissionId)).toEqual(entry);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON011: an oversized UTF-8 journal write preserves the last restartable snapshot and in-memory receipts", () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-journal-cap-"));
	try {
		const maximum = 2 * 1024 * 1024;
		const make = () => executionRecord({ admissionId: randomUUID(), ownerId: "ø".repeat(256), occurrence: { occurrenceId: "ø".repeat(1024), start: 1000, end: 2000 } });
		const entries: ExecutionRecord[] = [];
		let bytes = Buffer.byteLength(JSON.stringify({ version: 1, executions: [] }));
		while (true) {
			const next = make(),
				cost = Buffer.byteLength(JSON.stringify(next)) + (entries.length ? 1 : 0);
			if (bytes + cost > maximum) break;
			entries.push(next);
			bytes += cost;
		}
		const path = join(directory, "execution-journal.json"),
			snapshot = JSON.stringify({ version: 1, executions: entries });
		expect(Buffer.byteLength(snapshot)).toBeLessThanOrEqual(maximum);
		writeFileSync(path, snapshot, { mode: 0o600 });
		const journal = new ExecutionJournal(directory),
			next = make();
		expect(() => journal.save(next)).toThrow("Execution journal is too large");
		expect(readFileSync(path, "utf8")).toBe(snapshot);
		expect(journal.get(next.admissionId)).toBeUndefined();
		expect(journal.pendingTerminals()).toHaveLength(entries.length);
		expect(new ExecutionJournal(directory).pendingTerminals()).toHaveLength(entries.length);
		expect(readdirSync(directory)).toEqual(["execution-journal.json"]);
		journal.save({ ...entries[0], updatedAt: 1001 });
		expect(new ExecutionJournal(directory).get(entries[0].admissionId)?.updatedAt).toBe(1001);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
