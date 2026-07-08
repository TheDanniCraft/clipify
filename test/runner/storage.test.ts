import { saveCredentials, loadCredentials, clearCredentials } from "../../src/runner/storage";
import { Entry } from "@napi-rs/keyring";
import * as fs from "fs";

jest.mock("fs");
jest.mock("@napi-rs/keyring");

describe("Storage Service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
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
			})
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
			})
		);

		await saveCredentials(mockCredentials);

		// The token should have been written to the fallback config
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining('"token": "secret-token"'),
			expect.objectContaining({ mode: 0o600 })
		);

		// Load
		const loaded = await loadCredentials();
		expect(loaded.token).toBe("secret-token");
	});
});
