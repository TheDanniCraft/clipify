import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("TDD-US1-FR004: malformed retired metadata fails closed and missing keyring secrets are not delivered", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-terminal-invalid-"));
	const Store = jest.requireActual("../terminal-credentials").TerminalCredentialStore;
	const keyring = { set: jest.fn(), get: jest.fn().mockResolvedValue(null), remove: jest.fn() };
	try {
		const store = new Store({ directory, keyring });
		expect(await store.load()).toEqual([]);
		for (const text of ["private-fixture-token", "{}", "[null]", JSON.stringify([{ id: "bad", runnerId: "device", apiBase: "https://example.invalid" }]), JSON.stringify([{ id: "a".repeat(64), runnerId: 1, apiBase: "https://example.invalid" }]), JSON.stringify([{ id: "a".repeat(64), runnerId: "device", apiBase: 1 }])]) {
			writeFileSync(join(directory, "terminal-credentials.json"), text);
			await expect(store.load()).rejects.toThrow("Terminal credential metadata invalid");
		}
		writeFileSync(join(directory, "terminal-credentials.json"), JSON.stringify([{ id: "a".repeat(64), runnerId: "device", apiBase: "https://example.invalid", token: "" }]));
		expect(await store.load()).toEqual([]);
		expect(keyring.get).toHaveBeenCalledWith("a".repeat(64));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004 retired credentials survive restart separately from current enrollment and leave no token in metadata", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-terminal-credentials-"));
	const values = new Map<string, string>();
	const keyring = {
		set: jest.fn(async (id: string, value: string) => {
			values.set(id, value);
		}),
		get: jest.fn(async (id: string) => values.get(id) ?? null),
		remove: jest.fn(async (id: string) => {
			values.delete(id);
		}),
	};
	const Store = existsSync(join(__dirname, "../terminal-credentials.ts")) ? jest.requireActual("../terminal-credentials").TerminalCredentialStore : undefined;
	const credential = { runnerId: "11111111-1111-4111-8111-111111111111", apiBase: "http://127.0.0.1:3107", token: "fixture-retired-secret" };
	try {
		const store = Store ? new Store({ directory, keyring }) : undefined;
		const id = await store?.save(credential);
		expect(id).toMatch(/^[0-9a-f]{64}$/);
		const text = readFileSync(join(directory, "terminal-credentials.json"), "utf8");
		expect(text).not.toContain(credential.token);
		expect(keyring.set).toHaveBeenCalledWith(id, credential.token);
		const restarted = new Store({ directory, keyring });
		expect(await restarted.load()).toEqual([{ id, ...credential }]);
		await restarted.remove(id);
		expect(await new Store({ directory, keyring }).load()).toEqual([]);
		expect(keyring.remove).toHaveBeenCalledWith(id);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004 retired receipt retries retain a protected fallback when the OS keyring is unavailable", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-terminal-fallback-"));
	const keyring = {
		set: jest.fn(async () => {
			throw new Error("fixture unavailable");
		}),
		get: jest.fn(async () => {
			throw new Error("fixture unavailable");
		}),
		remove: jest.fn(async () => {
			throw new Error("fixture unavailable");
		}),
	};
	const Store = jest.requireActual("../terminal-credentials").TerminalCredentialStore;
	const credential = { runnerId: "11111111-1111-4111-8111-111111111111", apiBase: "http://127.0.0.1:3107", token: "fixture-fallback-retired-secret" };
	try {
		const store = new Store({ directory, keyring });
		await expect(store.save(credential)).resolves.toMatch(/^[0-9a-f]{64}$/);
		const saved = await new Store({ directory, keyring }).load();
		expect(saved).toEqual([{ id: expect.any(String), ...credential }]);
		if (process.platform !== "win32") expect(jest.requireActual("node:fs").statSync(join(directory, "terminal-credentials.json")).mode & 0o777).toBe(0o600);
		await expect(store.remove(saved[0].id)).resolves.toBeUndefined();
		expect(await new Store({ directory, keyring }).load()).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
