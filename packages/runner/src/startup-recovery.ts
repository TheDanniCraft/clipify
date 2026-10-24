import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { ExecutionJournal } from "./execution-journal";

const execute = promisify(execFile);

/** The credentials and private FFmpeg installation are shared by every invocation. */
export async function acquireRunnerInstance(directory: string) {
	const port = 40000 + (createHash("sha256").update(resolve(directory)).digest().readUInt16BE(0) % 25000);
	const server = createServer((socket) => socket.destroy());
	const deadline = Date.now() + 2000;
	while (true) {
		try {
			await new Promise<void>((accept, reject) => {
				const listening = () => {
					server.off("error", failed);
					accept();
				};
				const failed = (error: Error) => {
					server.off("listening", listening);
					reject(error);
				};
				server.once("error", failed);
				server.listen(port, "127.0.0.1", listening);
			});
			break;
		} catch (error) {
			// Unix updater starts its replacement just before exiting and releasing the socket.
			if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || Date.now() >= deadline) throw new Error("Clipify Runner is already running, or its local instance port is unavailable. Close the other Runner before restarting.");
			await sleep(100);
		}
	}
	server.unref();
	return server;
}

async function unixOutputs(binary: string) {
	if (process.platform === "linux") {
		const result: number[] = [];
		for (const pid of readdirSync("/proc").filter((entry) => /^\d+$/.test(entry))) {
			try {
				if (readlinkSync(`/proc/${pid}/exe`).replace(/ \(deleted\)$/, "") === binary) result.push(Number(pid));
			} catch (error) {
				if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
			}
		}
		return result;
	}
	const { stdout } = await execute("ps", ["-ww", "-axo", "pid=,comm="], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
	return stdout.split("\n").flatMap((line) => {
		const match = /^\s*(\d+)\s+(.+)$/.exec(line);
		return match?.[2] === binary ? [Number(match[1])] : [];
	});
}

async function closeOrphanOutputs(directory: string) {
	const binary = resolve(directory, "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
	if (process.platform === "win32") {
		// Open a process handle, recheck ownership, and wait for exit before asserting closure.
		const script = `$ErrorActionPreference='Stop'
$expected='${binary.replaceAll("'", "''")}'
$all=@(Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'")
if (@($all | Where-Object { !$_.ExecutablePath }).Count -ne 0) { throw 'Cannot identify an FFmpeg process' }
$owned=@($all | Where-Object { [String]::Equals($_.ExecutablePath,$expected,[StringComparison]::OrdinalIgnoreCase) })
foreach ($entry in $owned) {
 try { $child=[Diagnostics.Process]::GetProcessById($entry.ProcessId) } catch [ArgumentException] { continue }
 try {
  $null=$child.Handle
  if (![String]::Equals($child.MainModule.FileName,$expected,[StringComparison]::OrdinalIgnoreCase)) { throw 'Output ownership changed' }
  $child.Kill()
  if (!$child.WaitForExit(5000)) { throw 'Output did not stop' }
 } finally { $child.Dispose() }
}
$all=@(Get-CimInstance Win32_Process -Filter "Name='ffmpeg.exe'")
if (@($all | Where-Object { !$_.ExecutablePath }).Count -ne 0) { throw 'Cannot identify an FFmpeg process' }
$remaining=@($all | Where-Object { [String]::Equals($_.ExecutablePath,$expected,[StringComparison]::OrdinalIgnoreCase) })
if ($remaining.Count -ne 0) { throw 'Output is still running' }`;
		await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, timeout: 30000, maxBuffer: 65536 });
		return;
	}
	if (!["linux", "darwin"].includes(process.platform)) throw new Error("Unsupported Runner platform");
	for (const signal of ["SIGTERM", "SIGKILL"] as const) {
		for (const pid of await unixOutputs(binary)) {
			// Re-read executable ownership rather than trusting an earlier PID snapshot.
			if (!(await unixOutputs(binary)).includes(pid)) continue;
			try {
				process.kill(pid, signal);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
			}
		}
		const deadline = Date.now() + (signal === "SIGTERM" ? 1000 : 4000);
		while ((await unixOutputs(binary)).length && Date.now() < deadline) await sleep(50);
		if (!(await unixOutputs(binary)).length) return;
	}
	throw new Error("Runner output is still running");
}

/** Called under the installation lock, before watchdogs, cached starts or heartbeat jobs. */
export async function recoverInterruptedExecutions(directory: string): Promise<Set<string>> {
	const journals: ExecutionJournal[] = [];
	try {
		for (const entry of readdirSync(join(directory, "executions"), { withFileTypes: true })) {
			if (entry.isDirectory() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name)) journals.push(new ExecutionJournal(join(directory, "executions", entry.name)));
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const interrupted = journals.flatMap((journal) => journal.interrupted().map((record) => ({ journal, record })));
	if (!interrupted.length) return new Set();
	try {
		await closeOrphanOutputs(directory);
	} catch {
		throw new Error("Cannot confirm interrupted Runner outputs have stopped. Close leftover Clipify FFmpeg processes and restart the Runner; no shutdown acknowledgement was sent.");
	}
	// Active broadcasts retain fresh-lease restart behavior; Stop commands consume this closure proof.
	for (const { journal, record } of interrupted) if (record.state === "draining") journal.save({ ...record, state: "stopped", allOutputsClosed: true, updatedAt: Date.now() });
	return new Set(interrupted.map(({ record }) => record.admissionId));
}
