import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import https from "https";
import http from "http";

function getFileHash(filePath: string): string {
	const fileBuffer = fs.readFileSync(filePath);
	const hashSum = crypto.createHash("sha256");
	hashSum.update(fileBuffer);
	return hashSum.digest("hex");
}

async function downloadFile(url: string, dest: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const client = url.startsWith("https") ? https : http;
		client
			.get(url, (response) => {
				if (response.statusCode === 200) {
					const file = fs.createWriteStream(dest);
					response.pipe(file);
					file.on("finish", () => {
						file.close();
						resolve();
					});
				} else {
					reject(new Error(`Failed to download file: ${response.statusCode}`));
				}
			})
			.on("error", (err) => {
				fs.unlink(dest, () => reject(err));
			});
	});
}

export async function cleanupOldVersions() {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (!(process as any).pkg) return; // Only relevant for compiled binaries
	const execPath = process.execPath;
	const oldPath = `${execPath}.old`;

	if (fs.existsSync(oldPath)) {
		try {
			fs.unlinkSync(oldPath);
			console.log("[Updater] Cleaned up old version file.");
		} catch (e) {
			console.warn("[Updater] Failed to clean up old version file, will retry next time:", e);
		}
	}
}

export async function checkForUpdates(apiBase: string): Promise<string> {
	// 1. Determine local version
	let localVersion = "dev-version";
	let isCompiled = false;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if ((process as any).pkg && fs.existsSync(process.execPath)) {
		isCompiled = true;
		localVersion = getFileHash(process.execPath);
	}

	console.log(`[Updater] Local Runner Version (Hash): ${localVersion}`);

	if (!isCompiled) {
		console.log("[Updater] Running in dev mode, skipping auto-update.");
		return localVersion;
	}

	// 2. Fetch remote version
	const isWindows = process.platform === "win32";
	const osKey = isWindows ? "windows" : "linux";
	const binaryName = isWindows ? "clipify-runner-windows.exe" : "clipify-runner-linux";

	try {
		const res = await fetch(`${apiBase}/api/runner/version`);
		if (!res.ok) {
			console.warn(`[Updater] Failed to check for updates: HTTP ${res.status}`);
			return localVersion;
		}

		const data = await res.json();
		const remoteHash = data[osKey];

		if (!remoteHash) {
			console.warn(`[Updater] No remote hash found for OS: ${osKey}`);
			return localVersion;
		}

		if (localVersion !== remoteHash) {
			console.log(`[Updater] Update found! Local: ${localVersion}, Remote: ${remoteHash}`);
			console.log("[Updater] Downloading new version...");

			const execPath = process.execPath;
			const newPath = `${execPath}.new`;
			const oldPath = `${execPath}.old`;
			const downloadUrl = `${apiBase}/downloads/runner/${binaryName}`;

			await downloadFile(downloadUrl, newPath);

			const downloadedHash = getFileHash(newPath);
			if (downloadedHash !== remoteHash) {
				console.error("[Updater] Downloaded file hash mismatch! Aborting update.");
				fs.unlinkSync(newPath);
				return localVersion;
			}

			console.log("[Updater] Download verified. Applying update...");

			if (!isWindows) {
				fs.chmodSync(newPath, 0o755);
			}

			// Rename current -> old
			if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
			fs.renameSync(execPath, oldPath);

			// Rename new -> current
			fs.renameSync(newPath, execPath);

			console.log("[Updater] Update applied! Restarting runner...");

			// Spawn the new executable
			const child = spawn(execPath, process.argv.slice(2), {
				detached: true,
				stdio: "ignore",
			});
			child.unref();

			// Exit the current process
			process.exit(0);
		} else {
			console.log("[Updater] Runner is up to date.");
		}
	} catch (e) {
		console.error("[Updater] Error checking for updates:", e);
	}

	return localVersion;
}
