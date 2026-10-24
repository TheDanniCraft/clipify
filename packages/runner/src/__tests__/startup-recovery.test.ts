import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createConnection, type AddressInfo } from "node:net";
import { FreeExecutionController } from "../execution-runtime";
import { ExecutionJournal, type ExecutionRecord } from "../execution-journal";
import { acquireRunnerInstance, recoverInterruptedExecutions } from "../startup-recovery";

const directories: string[] = [];
function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "clipify-startup-recovery-"));
	directories.push(directory);
	const runnerId = randomUUID();
	const journal = new ExecutionJournal(join(directory, "executions", runnerId));
	const record: ExecutionRecord = { admissionId: randomUUID(), ownerId: "owner", runnerId, sessionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 3, state: "draining", updatedAt: 1000 };
	journal.save(record);
	return { directory, journal, record };
}
afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("a restarted Runner closes its orphan output before replaying the missing acknowledgement", async () => {
	const { directory, journal, record } = fixture();
	mkdirSync(join(directory, "bin"));
	// A real private executable models an orphaned FFmpeg without contacting a destination.
	const binary = join(directory, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	copyFileSync(process.execPath, binary);
	const orphan = spawn(binary, ["-e", "setInterval(() => {}, 1000)"]);
	const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	await Promise.all([once(orphan, "spawn"), once(unrelated, "spawn")]);
	const closed = once(orphan, "exit");
	try {
		expect(journal.pendingTerminals()).toEqual([]);
		expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
		await closed;
		expect(unrelated.exitCode).toBeNull();
		const receipt = new ExecutionJournal(join(directory, "executions", record.runnerId)).pendingTerminals();
		expect(receipt).toEqual([{ ...record, state: "stopped", allOutputsClosed: true, updatedAt: expect.any(Number) }]);
		expect((await recoverInterruptedExecutions(directory)).size).toBe(0);
		const restarted = new ExecutionJournal(join(directory, "executions", record.runnerId));
		const controller = new FreeExecutionController({
			ownerId: record.ownerId,
			runnerId: record.runnerId,
			keys: {},
			journal: restarted,
			createEngine: () => {
				throw new Error("Recovery must not open an output");
			},
		});
		expect(controller.reports()).toEqual([{ admissionId: record.admissionId, sessionId: record.sessionId, executionGeneration: record.executionGeneration, leaseId: record.leaseId, configurationRevision: record.configurationRevision, state: "stopped", allOutputsClosed: true }]);
		controller.confirm([{ admissionId: record.admissionId, executionGeneration: record.executionGeneration, state: "stopped" }]);
		expect(new ExecutionJournal(join(directory, "executions", record.runnerId)).pendingTerminals()).toEqual([]);
	} finally {
		orphan.kill("SIGKILL");
		unrelated.kill("SIGKILL");
	}
});

test("restart recovery preserves future cached windows and existing terminal receipts", async () => {
	const { directory, journal, record } = fixture();
	const future: ExecutionRecord = { ...record, admissionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), state: "pending", occurrence: { occurrenceId: "future", start: 2000, end: 3000 } };
	journal.save(future);
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	const restarted = new ExecutionJournal(join(directory, "executions", record.runnerId));
	expect(restarted.get(future.admissionId)).toEqual(future);
	expect(restarted.pendingTerminals()).toHaveLength(1);
});

test("only one Runner can recover or open outputs from the same installation", async () => {
	const { directory } = fixture();
	const first = await acquireRunnerInstance(directory);
	try {
		const connection = createConnection({ host: "127.0.0.1", port: (first.address() as AddressInfo).port });
		await once(connection, "close");
		await expect(acquireRunnerInstance(directory)).rejects.toThrow("already running");
	} finally {
		await new Promise<void>((resolve) => first.close(() => resolve()));
	}
	const restarted = await acquireRunnerInstance(directory);
	await new Promise<void>((resolve) => restarted.close(() => resolve()));
});

test("an updater replacement waits briefly for its predecessor to release the installation lock", async () => {
	const { directory } = fixture();
	const previous = await acquireRunnerInstance(directory);
	const replacement = acquireRunnerInstance(directory);
	setTimeout(() => previous.close(), 150);
	const current = await replacement;
	await new Promise<void>((resolve) => current.close(() => resolve()));
});

test("an active journal survives restart until the matching Stop command consumes confirmed closure", async () => {
	const { directory, record } = fixture();
	// A running broadcast may still receive a fresh signed restart; do not retire it pre-emptively.
	const path = join(directory, "executions", record.runnerId);
	rmSync(join(path, "execution-journal.json"));
	new ExecutionJournal(path).save({ ...record, state: "active" });
	const closedOnRestart = await recoverInterruptedExecutions(directory);
	const journal = new ExecutionJournal(path);
	expect(journal.pendingTerminals()).toEqual([]);
	const controller = new FreeExecutionController({
		ownerId: record.ownerId,
		runnerId: record.runnerId,
		keys: {},
		journal,
		closedOnRestart,
		createEngine: () => {
			throw new Error("Stop cannot open output");
		},
	});
	expect(await controller.stop({ ...record, id: record.sessionId })).toBe(true);
	expect(closedOnRestart.size).toBe(0);
	expect(journal.pendingTerminals()).toMatchObject([{ admissionId: record.admissionId, state: "stopped", allOutputsClosed: true }]);
});
