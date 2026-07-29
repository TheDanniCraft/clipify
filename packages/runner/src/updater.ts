import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";

type UpdateTarget = { osKey: string };

const WINDOWS_CLEANUP_ATTEMPTS = 125;
const WINDOWS_CLEANUP_MAX_DELAY_MS = 500;

function getFileHash(filePath: string): string {
	const fileBuffer = fs.readFileSync(filePath);
	const hashSum = crypto.createHash("sha256");
	hashSum.update(fileBuffer);
	return hashSum.digest("hex");
}

async function downloadFile(url: string, dest: string): Promise<void> {
	const parsedUrl = new URL(url);
	if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error(`Unsupported update URL protocol: ${parsedUrl.protocol}`);
	try {
		const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(5 * 60 * 1000) });
		if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
		fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
	} catch (error) {
		try {
			fs.unlinkSync(dest);
		} catch {}
		throw error;
	}
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
	if (process.platform === "win32") {
		console.log("[Updater] Scheduling update for after the runner exits...");
		launchWindowsUpdateHelper(execPath, newPath, oldPath, process.argv.slice(2), process.pid);
		process.exit(0);
	}

	fs.chmodSync(newPath, 0o755);
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

function quotePowerShell(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

// Start-Process accepts one native argument string on Windows PowerShell. Quote it
// using the Windows command-line rules so runner options survive the restart.
function quoteWindowsArgument(value: string): string {
	if (value.length > 0 && !/[\s"]/u.test(value)) return value;
	let quoted = '"';
	let backslashes = 0;
	for (const character of value) {
		if (character === "\\") {
			backslashes++;
		} else if (character === '"') {
			quoted += "\\".repeat(backslashes * 2 + 1) + '"';
			backslashes = 0;
		} else {
			quoted += "\\".repeat(backslashes) + character;
			backslashes = 0;
		}
	}
	return quoted + "\\".repeat(backslashes * 2) + '"';
}

export function launchWindowsUpdateHelper(execPath: string, newPath: string, oldPath: string, args: string[], pid: number) {
	const argumentLine = args.map(quoteWindowsArgument).join(" ");
	const restart = argumentLine ? `Start-Process -FilePath ${quotePowerShell(execPath)} -ArgumentList ${quotePowerShell(argumentLine)}` : `Start-Process -FilePath ${quotePowerShell(execPath)}`;
	const script = [`Wait-Process -Id ${pid} -ErrorAction SilentlyContinue`, `Remove-Item -LiteralPath ${quotePowerShell(oldPath)} -Force -ErrorAction SilentlyContinue`, `Move-Item -LiteralPath ${quotePowerShell(execPath)} -Destination ${quotePowerShell(oldPath)} -Force`, `Move-Item -LiteralPath ${quotePowerShell(newPath)} -Destination ${quotePowerShell(execPath)} -Force`, restart].join("; ");
	const encodedCommand = Buffer.from(script, "utf16le").toString("base64");
	const helper = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodedCommand], {
		detached: true,
		stdio: "ignore",
		windowsHide: true,
	});
	helper.unref();
	return helper;
}

export async function cleanupOldVersions(platform = process.platform) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (!(process as any).pkg) return;
	const oldPath = `${process.execPath}.old`;
	if (!fs.existsSync(oldPath)) return;

	const maxAttempts = platform === "win32" ? WINDOWS_CLEANUP_ATTEMPTS : 1;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			fs.unlinkSync(oldPath);
			console.log("[Updater] Cleaned up old version file.");
			return;
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			const canRetry = platform === "win32" && (code === "EPERM" || code === "EACCES" || code === "EBUSY");
			if (!canRetry || attempt === maxAttempts - 1) {
				console.warn("[Updater] Failed to clean up old version file, will retry next time:", error);
				return;
			}
			const retryDelayMs = Math.min(50 * 2 ** Math.min(attempt, 4), WINDOWS_CLEANUP_MAX_DELAY_MS);
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
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
