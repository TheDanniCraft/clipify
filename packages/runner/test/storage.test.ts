import { saveCredentials, loadCredentials, clearCredentials, restrictCredentialFile } from "../src/storage";
import { execFileSync } from "child_process";
import { Entry } from "@napi-rs/keyring";
import * as fs from "fs";

jest.mock("fs");
jest.mock("@napi-rs/keyring");
jest.mock("child_process");

describe("Storage Service", () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});
	it("restricts Windows credential ACLs to the current user and tolerates unsupported ACL tools", () => {
		const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
		const username = process.env.USERNAME;
		try {
			Object.defineProperty(process, "platform", { value: "win32" });
			process.env.USERNAME = "fixture-user";
			restrictCredentialFile("fixture-config.json");
			expect(execFileSync).toHaveBeenCalledWith("icacls", ["fixture-config.json", "/inheritance:r", "/grant:r", "fixture-user:F"], { stdio: "ignore", windowsHide: true });
			(execFileSync as jest.Mock).mockImplementationOnce(() => {
				throw new Error("unavailable");
			});
			expect(() => restrictCredentialFile("fixture-config.json")).not.toThrow();
			delete process.env.USERNAME;
			restrictCredentialFile("fixture-config.json");
			expect(execFileSync).toHaveBeenCalledTimes(2);
		} finally {
			Object.defineProperty(process, "platform", descriptor);
			if (username === undefined) delete process.env.USERNAME;
			else process.env.USERNAME = username;
		}
	});
	it("keeps missing and corrupt configuration empty and does not consult the keyring", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(false);
		expect(await loadCredentials()).toEqual({});
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.readFileSync as jest.Mock).mockReturnValue("invalid-json");
		expect(await loadCredentials()).toEqual({});
		expect(Entry).not.toHaveBeenCalled();
	});
	it("retains device identity when its keyring entry is missing or unavailable", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ runnerId: "device" }));
		const getPassword = jest
			.fn()
			.mockReturnValueOnce(null)
			.mockImplementationOnce(() => {
				throw new Error("unavailable");
			});
		(Entry as unknown as jest.Mock).mockImplementation(() => ({ getPassword }));
		expect(await loadCredentials()).toEqual({ runnerId: "device" });
		expect(await loadCredentials()).toEqual({ runnerId: "device" });
	});
	it("clears only the current credential namespace and tolerates unavailable stores", async () => {
		const deletePassword = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("unavailable"));
		(Entry as unknown as jest.Mock).mockImplementation(() => ({ deletePassword }));
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		await clearCredentials("device");
		expect(Entry).toHaveBeenCalledWith("us.clipify.runner", "device");
		expect(deletePassword).toHaveBeenCalledTimes(1);
		expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
		(fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
			throw new Error("locked");
		});
		await expect(clearCredentials("device")).resolves.toBeUndefined();
		(fs.existsSync as jest.Mock).mockReturnValue(false);
		await clearCredentials();
		expect(deletePassword).toHaveBeenCalledTimes(2);
	});
	it("creates a protected configuration directory for enrollment without a token", async () => {
		(fs.existsSync as jest.Mock).mockReturnValue(false);
		(fs.chmodSync as jest.Mock).mockImplementationOnce(() => {
			throw new Error("unsupported");
		});
		await saveCredentials({ apiBase: "https://example.invalid" });
		expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true, mode: 0o700 });
		expect(Entry).not.toHaveBeenCalled();
		expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ apiBase: "https://example.invalid" }, null, 2), { encoding: "utf-8", mode: 0o600 });
	});

	it("should save and load credentials using keyring primarily", async () => {
		const mockCredentials = {
			runnerId: "test-runner-123",
			apiBase: "https://demo.clipify.us",
			token: "secret-token",
		};

		// Mock Keyring success
		const mockSetPassword = jest.fn();
		const mockGetPassword = jest.fn().mockReturnValue("secret-token");
		(Entry as unknown as jest.Mock).mockImplementation(() => ({
			setPassword: mockSetPassword,
			getPassword: mockGetPassword,
		}));

		// Mock file reads
		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.readFileSync as jest.Mock).mockReturnValue(
			JSON.stringify({
				runnerId: "test-runner-123",
				apiBase: "https://demo.clipify.us",
			}),
		);

		await saveCredentials(mockCredentials);

		expect(mockSetPassword).toHaveBeenCalledWith("secret-token");
		expect(fs.writeFileSync).toHaveBeenCalled();

		// Load
		const loaded = await loadCredentials();
		expect(mockGetPassword).toHaveBeenCalled();
		expect(loaded.runnerId).toBe("test-runner-123");
		expect(loaded.apiBase).toBe("https://demo.clipify.us");
		expect(loaded.token).toBe("secret-token");
	});

	it("should fallback to config.json if keyring fails", async () => {
		const mockCredentials = {
			runnerId: "test-runner-123",
			apiBase: "https://demo.clipify.us",
			token: "secret-token",
		};

		// Mock Keyring failure
		const mockSetPassword = jest.fn().mockImplementation(() => {
			throw new Error("Keyring not available");
		});
		(Entry as unknown as jest.Mock).mockImplementation(() => ({
			setPassword: mockSetPassword,
			getPassword: jest.fn().mockImplementation(() => {
				throw new Error("Keyring not available");
			}),
		}));

		(fs.existsSync as jest.Mock).mockReturnValue(true);
		(fs.readFileSync as jest.Mock).mockReturnValue(
			JSON.stringify({
				runnerId: "test-runner-123",
				apiBase: "https://demo.clipify.us",
				token: "secret-token", // Fallback was saved!
			}),
		);

		await saveCredentials(mockCredentials);

		// The token should have been written to the fallback config
		expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('"token": "secret-token"'), expect.objectContaining({ mode: 0o600 }));

		// Load
		const loaded = await loadCredentials();
		expect(loaded.token).toBe("secret-token");
	});
});
