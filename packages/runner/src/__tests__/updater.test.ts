import { checkForUpdates, cleanupOldVersions } from "../updater";
import fs from "fs";
import crypto from "crypto";

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

	it.todo("should apply an update after a verified hash mismatch");
});
