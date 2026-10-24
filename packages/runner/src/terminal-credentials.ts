import { restrictCredentialFile } from "./storage";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Entry } from "@napi-rs/keyring";

type Credentials = { runnerId: string; apiBase: string; token: string };
type Reference = Omit<Credentials, "token"> & { id: string };
type StoredReference = Reference & { token?: string };
type Keyring = { set: (id: string, value: string) => Promise<void>; get: (id: string) => Promise<string | null>; remove: (id: string) => Promise<void> };
const service = "us.clipify.runner.terminal";
const platformKeyring: Keyring = {
	set: async (id, value) => {
		await new Entry(service, id).setPassword(value);
	},
	get: async (id) => new Entry(service, id).getPassword(),
	remove: async (id) => {
		await new Entry(service, id).deletePassword();
	},
};

/** Former bearers are retained solely for terminal receipt retries, outside enrollment and execution journals. */
export class TerminalCredentialStore {
	private readonly directory: string;
	private readonly path: string;
	private readonly keyring: Keyring;
	constructor(options: { directory?: string; keyring?: Keyring } = {}) {
		this.directory = options.directory ?? join(homedir(), ".clipify-runner");
		this.path = join(this.directory, "terminal-credentials.json");
		this.keyring = options.keyring ?? platformKeyring;
	}
	private read(): StoredReference[] {
		if (!existsSync(this.path)) return [];
		try {
			const records: unknown = JSON.parse(readFileSync(this.path, "utf8"));
			if (!Array.isArray(records) || records.some((record) => !record || !/^[a-f0-9]{64}$/.test(record.id) || typeof record.runnerId !== "string" || typeof record.apiBase !== "string")) throw new Error();
			return records.map(({ id, runnerId, apiBase, token }) => ({ id, runnerId, apiBase, ...(typeof token === "string" && token ? { token } : {}) }));
		} catch {
			throw new Error("Terminal credential metadata invalid");
		}
	}
	private write(records: StoredReference[]) {
		mkdirSync(this.directory, { recursive: true, mode: 0o700 });
		const temporary = this.path + "." + randomUUID() + ".tmp";
		try {
			const handle = openSync(temporary, "wx", 0o600);
			try {
				writeFileSync(handle, JSON.stringify(records));
				fsyncSync(handle);
			} finally {
				closeSync(handle);
			}
			renameSync(temporary, this.path);
			restrictCredentialFile(this.path);
		} finally {
			rmSync(temporary, { force: true });
		}
	}
	async save(credentials: Credentials): Promise<string> {
		const id = createHash("sha256")
			.update(JSON.stringify([credentials.runnerId, credentials.apiBase, credentials.token]))
			.digest("hex");
		const records = this.read();
		let fallback = false;
		try {
			await this.keyring.set(id, credentials.token);
		} catch {
			fallback = true;
			console.warn("[Storage] Keyring unavailable; retaining terminal credentials in a protected file.");
		}
		this.write(records.filter((record) => record.id !== id).concat({ id, runnerId: credentials.runnerId, apiBase: credentials.apiBase, ...(fallback ? { token: credentials.token } : {}) }));
		return id;
	}
	async load(): Promise<(Reference & { token: string })[]> {
		const credentials: (Reference & { token: string })[] = [];
		for (const reference of this.read()) {
			const token = reference.token ?? (await this.keyring.get(reference.id));
			if (token) credentials.push({ ...reference, token });
		}
		return credentials;
	}
	async remove(id: string): Promise<void> {
		this.write(this.read().filter((record) => record.id !== id));
		try {
			await this.keyring.remove(id);
		} catch {
			console.warn("[Storage] Terminal keyring cleanup unavailable.");
		}
	}
}
