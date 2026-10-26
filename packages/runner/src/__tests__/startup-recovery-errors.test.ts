import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type * as FileSystem from "node:fs";
const fs = jest.requireActual<typeof FileSystem>("node:fs");
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExecutionJournal, type ExecutionRecord } from "../execution-journal";

const execute = jest.fn();
jest.mock("node:util", () => ({
	...jest.requireActual("node:util"),
	promisify:
		() =>
		(...args: unknown[]) =>
			execute(...args),
}));
import { recoverInterruptedExecutions } from "../startup-recovery";

const originalPlatform = process.platform;
let directory: string;
let journalPath: string;
let record: ExecutionRecord;
function platform(name: string) {
	Object.defineProperty(process, "platform", { value: name, configurable: true });
}
beforeEach(() => {
	execute.mockReset();
	directory = mkdtempSync(join(tmpdir(), "clipify-recovery-errors-"));
	const runnerId = randomUUID();
	journalPath = join(directory, "executions", runnerId);
	record = { admissionId: randomUUID(), runnerId, ownerId: "creator", sessionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 2, state: "draining", updatedAt: 1000 };
	new ExecutionJournal(journalPath).save(record);
});
afterEach(() => {
	platform(originalPlatform);
	jest.restoreAllMocks();
	rmSync(directory, { recursive: true, force: true });
});

test("Windows uses the private executable path and waits for physical exit before creating a receipt", async () => {
	platform("win32");
	execute.mockResolvedValue({ stdout: "" });
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	const [program, args, options] = execute.mock.calls[0];
	expect(program).toBe("powershell.exe");
	expect(args.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-EncodedCommand"]);
	const script = Buffer.from(args[3], "base64").toString("utf16le");
	expect(script).toContain(join(directory, "bin", "ffmpeg.exe"));
	expect(script).toContain("$child.MainModule.FileName");
	expect(script).toContain("$child.WaitForExit(5000)");
	expect(script).toContain("$remaining.Count -ne 0");
	expect(options).toMatchObject({ windowsHide: true, timeout: 30000 });
	expect(new ExecutionJournal(journalPath).pendingTerminals()).toHaveLength(1);
});

test("Windows lookup/closure failures retain the interrupted identity without leaking command arguments", async () => {
	platform("win32");
	execute.mockRejectedValue(new Error("private/path/secret"));
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("no shutdown acknowledgement was sent");
	expect(new ExecutionJournal(journalPath).get(record.admissionId)).toEqual(record);
});

test("macOS checks exact executable paths and leaves unrelated processes untouched", async () => {
	platform("darwin");
	execute
		.mockResolvedValueOnce({ stdout: ` 123 ${join(directory, "bin", "ffmpeg")}\n 124 /usr/bin/ffmpeg\ninvalid\n` })
		.mockResolvedValueOnce({ stdout: `123 ${join(directory, "bin", "ffmpeg")}\n` })
		.mockResolvedValue({ stdout: "" });
	const kill = jest.spyOn(process, "kill").mockReturnValue(true);
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	expect(kill).toHaveBeenCalledTimes(1);
	expect(kill).toHaveBeenCalledWith(123, "SIGTERM");
	expect(execute).toHaveBeenCalledWith("ps", ["-ww", "-axo", "pid=,comm="], expect.any(Object));
});

test("a process exiting between enumeration and signalling is harmless", async () => {
	platform("darwin");
	const line = { stdout: `123 ${join(directory, "bin", "ffmpeg")}\n` };
	execute.mockResolvedValueOnce(line).mockResolvedValueOnce(line).mockResolvedValue({ stdout: "" });
	jest.spyOn(process, "kill").mockImplementation(() => {
		throw Object.assign(new Error("gone"), { code: "ESRCH" });
	});
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
});

test("a PID whose executable changed is never signalled", async () => {
	platform("darwin");
	execute.mockResolvedValueOnce({ stdout: `123 ${join(directory, "bin", "ffmpeg")}\n` }).mockResolvedValue({ stdout: "123 /usr/bin/unrelated\n" });
	const kill = jest.spyOn(process, "kill");
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	expect(kill).not.toHaveBeenCalled();
});

test("permission failures cannot turn a live output into a stopped receipt", async () => {
	platform("darwin");
	execute.mockResolvedValue({ stdout: `123 ${join(directory, "bin", "ffmpeg")}\n` });
	jest.spyOn(process, "kill").mockImplementation(() => {
		throw Object.assign(new Error("denied"), { code: "EPERM" });
	});
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("Cannot confirm");
	expect(new ExecutionJournal(journalPath).pendingTerminals()).toEqual([]);
});

test.each([true, false])("unresponsive private outputs require escalation and confirmed exit (closes: %s)", async (closes) => {
	platform("darwin");
	let killed = false;
	execute.mockImplementation(async () => ({ stdout: killed && closes ? "" : `123 ${join(directory, "bin", "ffmpeg")}\n` }));
	jest.spyOn(process, "kill").mockImplementation((_pid, signal) => {
		if (signal === "SIGKILL") killed = true;
		return true;
	});
	let time = 0;
	jest.spyOn(Date, "now").mockImplementation(() => (time += 5000));
	if (closes) expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	else await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("Cannot confirm");
	expect(process.kill).toHaveBeenCalledWith(123, "SIGKILL");
	expect(new ExecutionJournal(journalPath).pendingTerminals()).toHaveLength(closes ? 1 : 0);
});

test("Linux ignores exited/inaccessible foreign processes but fails closed on unexpected lookup failures", async () => {
	platform("linux");
	const original = fs.readdirSync;
	jest.spyOn(fs, "readdirSync").mockImplementation(((path: string, options?: unknown) => (path === "/proc" ? ["123", "124", "125", "126", "not-a-pid"] : original(path, options as never))) as typeof fs.readdirSync);
	jest.spyOn(fs, "readlinkSync").mockImplementation(((path: string) => {
		const code = path.includes("123") ? "ENOENT" : path.includes("124") ? "ESRCH" : path.includes("125") ? "EACCES" : "EPERM";
		throw Object.assign(new Error("unavailable"), { code });
	}) as typeof fs.readlinkSync);
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	const second = { ...record, admissionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID() };
	new ExecutionJournal(journalPath).save(second);
	jest.mocked(fs.readlinkSync).mockImplementation(() => {
		throw Object.assign(new Error("broken proc"), { code: "EIO" });
	});
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("Cannot confirm");
	expect(new ExecutionJournal(journalPath).get(second.admissionId)).toEqual(second);
});

test("unsupported systems and unavailable process inspection fail closed", async () => {
	platform("unsupported");
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("Cannot confirm");
	platform("darwin");
	execute.mockRejectedValue(new Error("ps unavailable"));
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("Cannot confirm");
	expect(new ExecutionJournal(journalPath).pendingTerminals()).toEqual([]);
});

test("absent history is a clean startup; corrupt storage never manufactures closure proof", async () => {
	expect((await recoverInterruptedExecutions(join(directory, "absent"))).size).toBe(0);
	writeFileSync(join(journalPath, "execution-journal.json"), "broken");
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow("snapshot invalid");
	expect(execute).not.toHaveBeenCalled();
	expect(readFileSync(join(journalPath, "execution-journal.json"), "utf8")).toBe("broken");
});

test("unrelated entries are ignored and inaccessible history is not treated as empty", async () => {
	mkdirSync(join(directory, "executions", "unrelated"));
	writeFileSync(join(directory, "executions", "not-a-journal"), "unrelated");
	platform("darwin");
	execute.mockResolvedValue({ stdout: "" });
	expect((await recoverInterruptedExecutions(directory)).size).toBe(1);
	rmSync(join(directory, "executions"), { recursive: true });
	writeFileSync(join(directory, "executions"), "not a directory");
	await expect(recoverInterruptedExecutions(directory)).rejects.toThrow();
});
