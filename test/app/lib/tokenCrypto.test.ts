/** @jest-environment node */
export {};

function setValidKey() {
	process.env.DB_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
}

async function loadCrypto() {
	jest.resetModules();
	return import("@/app/lib/tokenCrypto");
}

describe("lib/tokenCrypto", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setValidKey();
	});

	it("encrypts and decrypts tokens with matching AAD", async () => {
		const { encryptToken, decryptToken } = await loadCrypto();
		const encrypted = encryptToken("my-secret-token", "user:123");
		const decrypted = decryptToken(encrypted, "user:123");
		expect(decrypted).toBe("my-secret-token");
	});

	it("rejects decryption when AAD does not match", async () => {
		const { encryptToken, decryptToken } = await loadCrypto();
		const encrypted = encryptToken("payload", "aad-a");
		expect(() => decryptToken(encrypted, "aad-b")).toThrow();
	});

	it("rejects invalid payload formats and unsupported versions", async () => {
		const { encryptToken, decryptToken } = await loadCrypto();
		expect(() => decryptToken("broken-payload", "aad")).toThrow("Invalid encrypted token format");

		const encrypted = encryptToken("hello", "aad");
		const unsupported = encrypted.replace(/^v1\./, "v2.");
		expect(() => decryptToken(unsupported, "aad")).toThrow("Unsupported encryption version: v2");
	});

	it("fails when key is missing or wrong length", async () => {
		delete process.env.DB_SECRET_KEY;
		const missing = await loadCrypto();
		expect(() => missing.encryptToken("x", "aad")).toThrow("Missing DB_SECRET_KEY");

		process.env.DB_SECRET_KEY = Buffer.alloc(16, 1).toString("base64");
		const wrongLength = await loadCrypto();
		expect(() => wrongLength.encryptToken("x", "aad")).toThrow(
			"DB_SECRET_KEY must be base64 for exactly 32 bytes (AES-256 key)",
		);
	});
});
