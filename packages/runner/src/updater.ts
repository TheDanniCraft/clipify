import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";
import https from "https";
import http from "http";

type UpdateTarget = { osKey: string };

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

function getUpdateTarget(): UpdateTarget {
	const isWindows = process.platform === "win32";
	const isMacOS = process.platform === "darwin";
	const isLinuxArm64 = process.platform === "linux" && process.arch === "arm64";
	return {
		osKey: isWindows ? "windows" : isLinuxArm64 ? "linuxArm" : isMacOS && process.arch === "arm64" ? "macosArm" : isMacOS ? "macos" : "linux",
	};
}

async function fetchRemoteHash(apiBase: string, osKey: string): Promise<string | undefined> {
	const res = await fetch(`${apiBase}/api/runner/version`);
	if (!res.ok) {
		console.warn(`[Updater] Failed to check for updates: HTTP ${res.status}`);
		return undefined;
	}
	const data = (await res.json()) as Partial<Record<string, string>>;
	return data[osKey];
}

async function applyUpdate(apiBase: string, osKey: string, remoteHash: string): Promise<void> {
	const execPath = process.execPath;
	const newPath = `${execPath}.new`;
	const oldPath = `${execPath}.old`;
	await downloadFile(`${apiBase}/api/runner/download?os=${encodeURIComponent(osKey)}`, newPath);

	if (getFileHash(newPath) !== remoteHash) {
		console.error("[Updater] Downloaded file hash mismatch! Aborting update.");
		fs.unlinkSync(newPath);
		return;
	}

	console.log("[Updater] Download verified. Applying update...");
	if (process.platform !== "win32") fs.chmodSync(newPath, 0o755);
	if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
	fs.renameSync(execPath, oldPath);
	fs.renameSync(newPath, execPath);
	console.log("[Updater] Update applied! Restarting runner...");

	launchUpdatedRunner(execPath, process.argv.slice(2));
	process.exit(0);
}

export function launchUpdatedRunner(execPath: string, args: string[]) {
	return spawn(execPath, args, { detached: false, stdio: "inherit", windowsHide: false });
}

export async function cleanupOldVersions(platform = process.platform) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (!(process as any).pkg) return;
	const oldPath = `${process.execPath}.old`;
	if (!fs.existsSync(oldPath)) return;

	for (let attempt = 0; attempt < 20; attempt++) {
		try {
			fs.unlinkSync(oldPath);
			console.log("[Updater] Cleaned up old version file.");
			return;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			const canRetry = platform === "win32" && (code === "EPERM" || code === "EACCES" || code === "EBUSY");
			if (!canRetry || attempt === 19) {
				console.warn("[Updater] Failed to clean up old version file, will retry next time:", error);
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
}

export async function checkForUpdates(apiBase: string): Promise<string> {
	let localVersion = "dev-version";
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const isCompiled = Boolean((process as any).pkg && fs.existsSync(process.execPath));
	if (isCompiled) localVersion = getFileHash(process.execPath);
	console.log(`[Updater] Local Runner Version (Hash): ${localVersion}`);
	if (!isCompiled) {
		console.log("[Updater] Running in dev mode, skipping auto-update.");
		return localVersion;
	}

	const { osKey } = getUpdateTarget();
	try {
		const remoteHash = await fetchRemoteHash(apiBase, osKey);
		if (!remoteHash) {
			console.warn(`[Updater] No remote hash found for OS: ${osKey}`);
			return localVersion;
		}
		if (localVersion !== remoteHash) {
			console.log(`[Updater] Update found! Local: ${localVersion}, Remote: ${remoteHash}`);
			console.log("[Updater] Downloading new version...");
			await applyUpdate(apiBase, osKey, remoteHash);
		} else {
			console.log("[Updater] Runner is up to date.");
		}
	} catch (e) {
		console.error("[Updater] Error checking for updates:", e);
	}
	return localVersion;
}
