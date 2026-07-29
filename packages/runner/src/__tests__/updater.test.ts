import { checkForUpdates, cleanupOldVersions, launchUpdatedRunner, launchWindowsUpdateHelper } from "../updater";
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

	it("should schedule a detached Windows update after the current process exits", () => {
		const unref = jest.fn();
		(spawn as jest.Mock).mockReturnValue({ unref });

		launchWindowsUpdateHelper("C:\\Program Files\\Clipify\\runner.exe", "C:\\Program Files\\Clipify\\runner.exe.new", "C:\\Program Files\\Clipify\\runner.exe.old", ["--api-url", "https://clipify.example/a path", "--name", 'runner "one"'], 1234);

		expect(spawn).toHaveBeenCalledWith("powershell.exe", expect.arrayContaining(["-EncodedCommand", expect.any(String)]), { detached: true, stdio: "ignore", windowsHide: true });
		const spawnArgs = (spawn as jest.Mock).mock.calls[0][1] as string[];
		const script = Buffer.from(spawnArgs.at(-1)!, "base64").toString("utf16le");
		expect(script).toContain("Wait-Process -Id 1234");
		expect(script).toContain("Move-Item -LiteralPath 'C:\\Program Files\\Clipify\\runner.exe.new'");
		expect(script).toContain("Start-Process -FilePath 'C:\\Program Files\\Clipify\\runner.exe'");
		expect(script).toContain('runner \\\"one\\\"');
		expect(unref).toHaveBeenCalled();
	});

	it.todo("should apply an update after a verified hash mismatch");
});
