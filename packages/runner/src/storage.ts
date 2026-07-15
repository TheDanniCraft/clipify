import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Entry } from "@napi-rs/keyring";

const CONFIG_DIR = path.join(os.homedir(), ".clipify-runner");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const SERVICE_NAME = "us.clipify.runner";

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

	let keyringSuccess = false;
	if (credentials.token && credentials.runnerId) {
		try {
			const entry = new Entry(SERVICE_NAME, credentials.runnerId);
			await entry.setPassword(credentials.token);
			keyringSuccess = true;
		} catch {
			console.warn("[Storage] Keyring unavailable; saving credentials to config.json instead.");
		}
	}

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

	try {
		if (fs.existsSync(CONFIG_PATH)) {
			const data = fs.readFileSync(CONFIG_PATH, "utf-8");
			const config = JSON.parse(data);
			if (config.runnerId) result.runnerId = config.runnerId;
			if (config.apiBase) result.apiBase = config.apiBase;
			if (config.token) result.token = config.token;
		}
	} catch {
		// Ignore parse errors, file might not exist or be corrupted
	}

	if (result.runnerId && !result.token) {
		for (const serviceName of [SERVICE_NAME]) {
			try {
				const entry = new Entry(serviceName, result.runnerId);
				const keyringToken = await entry.getPassword();
				if (keyringToken) {
					result.token = keyringToken;
					break;
				}
			} catch {
				// Try the next namespace; the keyring may be unavailable or the entry may not exist.
			}
		}
	}

	return result;
}

export async function clearCredentials(runnerId: string) {
	for (const serviceName of [SERVICE_NAME]) {
		try {
			const entry = new Entry(serviceName, runnerId);
			await entry.deletePassword();
		} catch {
			// Ignore unavailable keyring entries.
		}
	}

	try {
		if (fs.existsSync(CONFIG_PATH)) {
			fs.unlinkSync(CONFIG_PATH);
		}
	} catch {
		// Ignore
	}
}
