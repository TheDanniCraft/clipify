import { checkForUpdates, cleanupOldVersions, launchUpdatedRunner, launchWindowsUpdateHelper, getWindowsUpdatePaths } from "../updater";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";

jest.mock("fs");
jest.mock("crypto");
jest.mock("child_process");

describe("Updater logic", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(process as any).pkg = true; // Mock pkg context
		process.execPath = "/path/to/clipify-runner.exe";
	});

	afterEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (process as any).pkg;
	});

	it("should clean up old versions if they exist", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		await cleanupOldVersions();
		expect(fs.unlinkSync).toHaveBeenCalledWith("/path/to/clipify-runner.exe.old");
	});

	it("should not crash if cleanup fails", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.unlinkSync as jest.Mock).mockImplementation(() => {
			throw new Error("EPERM");
		});
		await expect(cleanupOldVersions()).resolves.not.toThrow();
	});

	it("should retry Windows sharing violations while cleaning up the old executable", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.unlinkSync as jest.Mock)
			.mockImplementationOnce(() => {
				throw Object.assign(new Error("in use"), { code: "EPERM" });
			})
			.mockImplementationOnce(() => undefined);
		const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: () => void) => {
			callback();
			return {} as NodeJS.Timeout;
		}) as typeof setTimeout);

		await cleanupOldVersions("win32");

		expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
		timeoutSpy.mockRestore();
	});

	it("keeps retrying long enough for a retiring Windows executable to release its lock", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		for (let attempt = 0; attempt < 25; attempt++) {
			(fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
				throw Object.assign(new Error("in use"), { code: "EBUSY" });
			});
		}
		(fs.unlinkSync as jest.Mock).mockImplementationOnce(() => undefined);
		const delays: number[] = [];
		const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation(((callback: () => void, delay?: number) => {
			delays.push(delay ?? 0);
			callback();
			return {} as NodeJS.Timeout;
		}) as typeof setTimeout);

		await cleanupOldVersions("win32");

		expect(fs.unlinkSync).toHaveBeenCalledTimes(26);
		expect(delays.reduce((total, delay) => total + delay, 0)).toBeGreaterThan(2_000);
		timeoutSpy.mockRestore();
	});

	it("should not auto-update in dev mode", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (process as any).pkg;
		const version = await checkForUpdates("http://localhost:3000");
		expect(version).toBe("dev-version");
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("should check for updates and do nothing if up to date", async () => {
		// Mock local hash
		(fs.readFileSync as jest.Mock).mockReturnValue("fake-buffer");
		const mockHash = { update: jest.fn(), digest: jest.fn().mockReturnValue("hash123") };
		(crypto.createHash as jest.Mock).mockReturnValue(mockHash);
		(fs.existsSync as jest.Mock).mockReturnValue(true);

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ windows: "hash123", linux: "hash123" }),
		});

		const version = await checkForUpdates("http://localhost:3000");
		expect(version).toBe("hash123");
		expect(fs.renameSync).not.toHaveBeenCalled();
	});

	it("should restart an updated runner in the existing console", () => {
		launchUpdatedRunner("/path/to/clipify-runner.exe", ["--api-url", "https://clipify.example"]);

		expect(spawn).toHaveBeenCalledWith("/path/to/clipify-runner.exe", ["--api-url", "https://clipify.example"], {
			detached: false,
			stdio: "inherit",
			windowsHide: false,
		});
	});

	it("runs the Windows helper in a hidden console and waits for readiness", async () => {
		const unref = jest.fn();
		const { EventEmitter } = await import("events");
		const child = Object.assign(new EventEmitter(), { unref, kill: jest.fn(), stdout: Object.assign(new EventEmitter(), { destroy: jest.fn() }), stderr: Object.assign(new EventEmitter(), { destroy: jest.fn() }) });
		(spawn as jest.Mock).mockReturnValue(child);

		const handoff = launchWindowsUpdateHelper("C:\\Program Files\\Clipify\\runner.exe", "C:\\Program Files\\Clipify\\runner.exe.new", "C:\\Program Files\\Clipify\\runner.exe.old", ["--api-url", "https://clipify.example/a path", "--name", 'runner "one"'], 1234);

		child.emit("spawn");
		expect(unref).not.toHaveBeenCalled();
		child.stdout.emit("data", Buffer.from("CLIPIFY_UPDATE_READY\r\n"));
		await handoff;
		expect(spawn).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", expect.stringMatching(/^powershell\.exe .* -EncodedCommand [A-Za-z0-9+/=]+$/)], { detached: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, windowsVerbatimArguments: true });
		const spawnArgs = (spawn as jest.Mock).mock.calls[0][1] as string[];
		const script = Buffer.from(spawnArgs.at(-1)!.split(" ").at(-1)!, "base64").toString("utf16le");
		expect(script).toContain("$ErrorActionPreference = 'Stop'");
		expect(script).toContain("Start-Sleep -Milliseconds 500");
		expect(script).toContain("Wait-Process -Id 1234");
		expect(script).toContain("Move-WithRetry 'C:\\Program Files\\Clipify\\runner.exe.new'");
		expect(script).toContain("Start-Process -FilePath 'C:\\Program Files\\Clipify\\runner.exe'");
		expect(script).toContain('runner \\\"one\\\"');
		expect(unref).toHaveBeenCalled();
	});

	it("keeps staged Windows downloads executable and recognizes manually launched stages", () => {
		expect(getWindowsUpdatePaths("C:\\Clipify\\runner.exe")).toEqual({ executable: "C:\\Clipify\\runner.exe", staged: "C:\\Clipify\\runner.new.exe" });
		expect(getWindowsUpdatePaths("C:\\Clipify\\runner.new.exe").executable).toBe("C:\\Clipify\\runner.exe");
		expect(getWindowsUpdatePaths("C:\\Clipify\\runner.exe.new").executable).toBe("C:\\Clipify\\runner.exe");
	});

	it("does not hand off when Windows cannot start the update helper", async () => {
		const { EventEmitter } = await import("events");
		const child = Object.assign(new EventEmitter(), { unref: jest.fn(), kill: jest.fn(), stdout: Object.assign(new EventEmitter(), { destroy: jest.fn() }), stderr: Object.assign(new EventEmitter(), { destroy: jest.fn() }) });
		(spawn as jest.Mock).mockReturnValue(child);
		const handoff = launchWindowsUpdateHelper("runner.exe", "runner.new.exe", "runner.exe.old", [], 1234);
		child.emit("error", new Error("PowerShell unavailable"));
		await expect(handoff).rejects.toThrow("PowerShell unavailable");
		expect(child.unref).not.toHaveBeenCalled();
	});

	it("keeps the Runner alive if PowerShell exits before its readiness signal", async () => {
		const { EventEmitter } = await import("events");
		const child = Object.assign(new EventEmitter(), { unref: jest.fn(), kill: jest.fn(), stdout: Object.assign(new EventEmitter(), { destroy: jest.fn() }), stderr: Object.assign(new EventEmitter(), { destroy: jest.fn() }) });
		(spawn as jest.Mock).mockReturnValue(child);
		const handoff = launchWindowsUpdateHelper("runner.exe", "runner.new.exe", "runner.exe.old", [], 1234);
		child.stderr.emit("data", Buffer.from("controlled PowerShell startup failure"));
		child.emit("exit", 1);
		await expect(handoff).rejects.toThrow("exited before becoming ready");
		expect(child.unref).not.toHaveBeenCalled();
		expect(fs.writeFileSync).toHaveBeenCalledWith("runner.exe.update-error.log", "controlled PowerShell startup failure", { mode: 0o600 });
	});

	it.each<{ source: string; knownSize: boolean; manifestSize: boolean; headers: Headers; invalidSize?: boolean }>([
		{ source: "response header", knownSize: true, manifestSize: false, headers: new Headers({ "content-length": String(2 * 1024 * 1024) }) },
		{ source: "manifest for a chunked response", knownSize: true, manifestSize: true, headers: new Headers() },
		{ source: "manifest for a compressed response", knownSize: true, manifestSize: true, headers: new Headers({ "content-encoding": "gzip", "content-length": "123" }) },
		{ source: "unknown total", knownSize: false, manifestSize: false, headers: new Headers() },
		{ source: "invalid manifest size", knownSize: false, manifestSize: true, invalidSize: true, headers: new Headers() },
		{ source: "compressed size without manifest", knownSize: false, manifestSize: false, headers: new Headers({ "content-encoding": "gzip", "content-length": "123" }) },
	])("reports download percentage, total and ETA using $source", async ({ knownSize, manifestSize, headers, invalidSize }) => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(crypto.createHash as jest.Mock).mockReturnValue({ update: jest.fn(), digest: jest.fn().mockReturnValue("old-hash") });
		const chunks = [new Uint8Array(1024 * 1024), new Uint8Array(1024 * 1024)];
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					linux: "new-hash",
					windows: "new-hash",
					...(manifestSize
						? {
								artifacts: [
									{ sha256: "other-hash", size: 99 },
									{ sha256: "new-hash", size: invalidSize ? -1 : 2 * 1024 * 1024 },
								],
							}
						: {}),
				}),
			})
			.mockResolvedValueOnce(
				new Response(
					new ReadableStream({
						start(controller) {
							for (const chunk of chunks) controller.enqueue(chunk);
							controller.close();
						},
					}),
					{ headers },
				),
			);
		const log = jest.spyOn(console, "log").mockImplementation(() => {});
		const time = jest.spyOn(Date, "now");
		let now = 1000;
		time.mockImplementation(() => (now += 1000));
		try {
			await checkForUpdates("https://clipify.example");
			const progress = log.mock.calls.map(([message]) => String(message)).filter((message) => message.startsWith("[Updater] Download:"));
			expect(progress).toContain(knownSize ? "[Updater] Download: 50% (1.0 / 2.0 MiB), 1.0 MiB/s, about 1s remaining" : "[Updater] Download: 1.0 MiB (total size and ETA unavailable)");
			expect(progress.at(-1)).toBe(knownSize ? "[Updater] Download: 100% (2.0 / 2.0 MiB)" : "[Updater] Download: 2.0 MiB (complete)");
			expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining(".new"), Buffer.concat(chunks));
		} finally {
			log.mockRestore();
			time.mockRestore();
		}
	});

	it("cleans up an interrupted download without claiming completion or replacing the Runner", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(crypto.createHash as jest.Mock).mockReturnValue({ update: jest.fn(), digest: jest.fn().mockReturnValue("old-hash") });
		const reader = {
			read: jest
				.fn()
				.mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
				.mockRejectedValueOnce(new Error("Connection lost")),
			releaseLock: jest.fn(),
		};
		(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ linux: "new-hash", windows: "new-hash" }) }).mockResolvedValueOnce({ ok: true, headers: new Headers(), body: { getReader: () => reader } });
		const log = jest.spyOn(console, "log").mockImplementation(() => {});
		const error = jest.spyOn(console, "error").mockImplementation(() => {});
		try {
			await expect(checkForUpdates("https://clipify.example")).resolves.toBe("old-hash");
			expect(reader.releaseLock).toHaveBeenCalled();
			expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(".new"));
			expect(fs.writeFileSync).not.toHaveBeenCalled();
			expect(fs.renameSync).not.toHaveBeenCalled();
			expect(log.mock.calls.flat().join(" ")).not.toMatch(/100%|\(complete\)|Download verified/);
		} finally {
			log.mockRestore();
			error.mockRestore();
		}
	});

	it.todo("should apply an update after a verified hash mismatch");
});
