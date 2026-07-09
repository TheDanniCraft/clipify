import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Entry } from "@napi-rs/keyring";

const SERVICE_NAME = "com.clipify.runner";
const CONFIG_DIR = path.join(os.homedir(), ".clipify-runner");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export interface RunnerCredentials {
	runnerId?: string;
	apiBase?: string;
	token?: string;
}

function ensureConfigDir() {
	if (!fs.existsSync(CONFIG_DIR)) {
		fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
	}
}

export async function saveCredentials(credentials: RunnerCredentials) {
	ensureConfigDir();

	// 1. Speichere Token im Keyring (falls vorhanden und runnerId existiert)
	let keyringSuccess = false;
	if (credentials.token && credentials.runnerId) {
		try {
			const entry = new Entry(SERVICE_NAME, credentials.runnerId);
			await entry.setPassword(credentials.token);
			keyringSuccess = true;
		} catch (error) {
			console.warn("[Storage] Warning: Failed to save token to Keyring. Falling back to config.json.", error);
		}
	}

	// 2. Speichere Metadaten (und Token als Fallback) in config.json
	const configToSave: RunnerCredentials = {
		runnerId: credentials.runnerId,
		apiBase: credentials.apiBase,
	};

	if (!keyringSuccess && credentials.token) {
		configToSave.token = credentials.token;
	}

	fs.writeFileSync(CONFIG_PATH, JSON.stringify(configToSave, null, 2), {
		encoding: "utf-8",
		mode: 0o600, // Read/Write only for owner
	});
}

export async function loadCredentials(): Promise<RunnerCredentials> {
	const result: RunnerCredentials = {};

	// 1. Lade Metadaten aus config.json
	try {
		if (fs.existsSync(CONFIG_PATH)) {
			const data = fs.readFileSync(CONFIG_PATH, "utf-8");
			const config = JSON.parse(data);
			if (config.runnerId) result.runnerId = config.runnerId;
			if (config.apiBase) result.apiBase = config.apiBase;
			if (config.token) result.token = config.token; // Fallback token
		}
	} catch {
		// Ignore parse errors, file might not exist or be corrupted
	}

	// 2. Versuche Token aus dem Keyring zu laden
	if (result.runnerId) {
		try {
			const entry = new Entry(SERVICE_NAME, result.runnerId);
			const keyringToken = await entry.getPassword();
			if (keyringToken) {
				result.token = keyringToken;
			}
		} catch {
			// Keyring might not be available or entry doesn't exist
		}
	}

	return result;
}

export async function clearCredentials(runnerId: string) {
	// Lösche aus Keyring
	try {
		const entry = new Entry(SERVICE_NAME, runnerId);
		await entry.deletePassword();
	} catch {
		// Ignore
	}

	// Lösche Config-Datei
	try {
		if (fs.existsSync(CONFIG_PATH)) {
			fs.unlinkSync(CONFIG_PATH);
		}
	} catch {
		// Ignore
	}
}
