import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Entry } from "@napi-rs/keyring";
import { TerminalCredentialStore } from "../terminal-credentials";

jest.mock("@napi-rs/keyring");

test("retired bearer storage uses its own OS keyring namespace through save, reload and acknowledgement cleanup", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-terminal-platform-keyring-"));
	const secrets = new Map<string, string>();
	const remove = jest.fn((id: string) => {
		secrets.delete(id);
	});
	(Entry as unknown as jest.Mock).mockImplementation((service: string, id: string) => {
		expect(service).toBe("us.clipify.runner.terminal");
		return { setPassword: (token: string) => secrets.set(id, token), getPassword: () => secrets.get(id) ?? null, deletePassword: () => remove(id) };
	});
	try {
		const store = new TerminalCredentialStore({ directory });
		const credential = { runnerId: "device", apiBase: "https://example.invalid", token: "fixture-retired-token" };
		const id = await store.save(credential);
		expect(await store.save(credential)).toBe(id);
		expect(readFileSync(join(directory, "terminal-credentials.json"), "utf8")).not.toContain(credential.token);
		expect(await new TerminalCredentialStore({ directory }).load()).toEqual([{ id, ...credential }]);
		await store.remove(id);
		expect(remove).toHaveBeenCalledWith(id);
		expect(secrets.size).toBe(0);
		expect(await store.load()).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
