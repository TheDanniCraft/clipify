import * as os from "os";
import * as readline from "readline";
import { Engine } from "./engine";
import { ConsoleUI } from "./logger";
import { checkForUpdates, cleanupOldVersions } from "./updater";
import { openBrowser } from "./browser";

import { extractBakedConfig } from "./bootstrap";
import { clearCredentials, loadCredentials, saveCredentials, type RunnerCredentials } from "./storage";

let RUNNER_VERSION = "unknown";
const DEVELOPMENT_API_BASE = "http://localhost:3000";

// Track actual states and active engines locally
const actualStates: Record<string, string> = {};
const activeEngines: Record<string, Engine> = {};

function getRunnerOsInfo() {
	return `${os.type()} ${os.release()} ${os.arch()}`;
}

interface EnrollmentStartResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresAt: string;
	pollInterval: number;
}

interface EnrollmentApprovedResponse {
	status: "approved";
	apiBase: string;
	runnerId: string;
	token: string;
}

class RunnerConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RunnerConfigurationError";
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeApiBase(apiBase: string) {
	return apiBase.replace(/\/+$/, "");
}

function isSourceRunnerExecution() {
	const normalizedArgs = process.argv.map((arg) => arg.replace(/\\/g, "/"));
	return normalizedArgs.some((arg) => arg.endsWith("packages/runner/src/index.ts"));
}

function resolveApiBase(options: { overrideUrl?: string; bakedApiBase?: string; localApiBase?: string; hasLocalToken: boolean }) {
	const explicitApiBase = options.overrideUrl || process.env.CLIPIFY_API_URL || options.bakedApiBase || process.env.BAKED_API_URL;
	if (explicitApiBase) return normalizeApiBase(explicitApiBase);

	if (isSourceRunnerExecution() && !options.hasLocalToken) return DEVELOPMENT_API_BASE;
	if (options.localApiBase) return normalizeApiBase(options.localApiBase);

	throw new RunnerConfigurationError("This runner is missing its Clipify connection settings.");
}

async function startRunnerEnrollment(apiBase: string, runnerId?: string) {
	const startUrl = `${apiBase}/api/runner/enroll/start`;
	const startResponse = await fetch(startUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			os: getRunnerOsInfo(),
			hostname: os.hostname(),
			version: RUNNER_VERSION,
			runnerId,
		}),
	});

	if (!startResponse.ok) {
		const responseText = await startResponse.text().catch(() => "");
		const responseSuffix = responseText ? `: ${responseText}` : "";
		throw new Error(`Enrollment start failed with status ${startResponse.status} at ${startUrl}${responseSuffix}`);
	}

	return (await startResponse.json()) as EnrollmentStartResponse;
}

function printEnrollmentInstructions(enrollment: EnrollmentStartResponse) {
	console.log("==========================================");
	console.log("=       Clipify Runner Enrollment        =");
	console.log("==========================================");
	console.log(`[Enrollment] Open this URL on any device: ${enrollment.verificationUri}`);
	console.log(`[Enrollment] Code: ${enrollment.userCode}`);
	console.log("[Enrollment] If no browser opens, open the URL manually and enter the code.");
	console.log("[Enrollment] Waiting for approval...");
}

function updateEnrollmentCodeLine(userCode: string) {
	if (!process.stdout.isTTY) {
		console.log(`[Enrollment] Code: ${userCode}`);
		return;
	}

	readline.moveCursor(process.stdout, 0, -3);
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);
	process.stdout.write(`[Enrollment] Code: ${userCode}`);
	readline.cursorTo(process.stdout, 0);
	readline.moveCursor(process.stdout, 0, 3);
}

async function enrollRunner(apiBase: string, runnerId?: string): Promise<Required<RunnerCredentials>> {
	console.log("[Enrollment] No runner token found. Starting browser enrollment...");
	let hasPrintedInstructions = false;

	while (true) {
		const enrollment = await startRunnerEnrollment(apiBase, runnerId);

		if (hasPrintedInstructions) {
			updateEnrollmentCodeLine(enrollment.userCode);
		} else {
			printEnrollmentInstructions(enrollment);
			openBrowser(enrollment.verificationUri);
			hasPrintedInstructions = true;
		}

		const expiresAt = new Date(enrollment.expiresAt).getTime();
		const pollIntervalMs = Math.max(1, enrollment.pollInterval || 3) * 1000;

		while (Date.now() < expiresAt) {
			await sleep(pollIntervalMs);
			const pollResponse = await fetch(`${apiBase}/api/runner/enroll/poll`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ deviceCode: enrollment.deviceCode }),
			});

			if (pollResponse.status === 202) continue;
			if (pollResponse.status === 410) break;
			if (!pollResponse.ok) {
				const responseText = await pollResponse.text().catch(() => "");
				const responseSuffix = responseText ? `: ${responseText}` : "";
				throw new Error(`Enrollment poll failed with status ${pollResponse.status}${responseSuffix}`);
			}

			const approved = (await pollResponse.json()) as EnrollmentApprovedResponse;
			if (approved.status === "approved") {
				const credentials = { runnerId: approved.runnerId, apiBase: approved.apiBase, token: approved.token };
				await saveCredentials(credentials);
				console.log("[Enrollment] Runner approved and credentials saved.");
				return credentials;
			}
		}
	}
}

type HeartbeatJob = {
	id: string;
	mode: "24_7" | "failsafe";
	rtmpUrl: string;
	overlaySecret: string;
	streamKey: string;
	overlayId: string;
	fps: number;
	resolution: string;
	desiredState: "running" | "stopped";
};

async function processHeartbeatJob(job: HeartbeatJob, apiBase: string, token: string) {
	console.log(`  - Job [${job.id}]: Mode=${job.mode}, DesiredState=${job.desiredState}`);
	const existingEngine = activeEngines[job.id];
	const needsRestart = Boolean(existingEngine && (existingEngine.mode !== job.mode || existingEngine.rtmpUrl !== job.rtmpUrl || existingEngine.streamKey !== job.streamKey || existingEngine.overlayId !== job.overlayId));

	if (job.desiredState === "running" && (actualStates[job.id] !== "running" || needsRestart)) {
		if (needsRestart && existingEngine) {
			console.log(`  -> Restarting engine for job ${job.id} due to parameter change...`);
			await existingEngine.stop();
			delete activeEngines[job.id];
		} else {
			console.log(`  -> Starting engine for job ${job.id}...`);
		}

		actualStates[job.id] = "running";
		const engine = new Engine(job.overlayId, job.rtmpUrl, job.overlaySecret, job.streamKey, job.fps, job.resolution, job.mode, apiBase, token);
		activeEngines[job.id] = engine;
		engine.start().catch((err) => {
			console.error(`[Error] Engine failed to start for job ${job.id}:`, err);
			actualStates[job.id] = "error";
			engine.isRunning = false;
		});
		return;
	}

	if (job.desiredState === "stopped" && (actualStates[job.id] === "running" || actualStates[job.id] === "error")) {
		console.log(`  -> Stopping engine for job ${job.id}...`);
		actualStates[job.id] = "stopped";
		if (existingEngine) {
			await existingEngine.stop();
			delete activeEngines[job.id];
		}
	}
}

async function pollHeartbeat(token: string, apiBase: string, runnerId?: string): Promise<boolean> {
	try {
		console.log(`[Heartbeat] Polling ${apiBase}/api/runner/heartbeat...`);
		const response = await fetch(`${apiBase}/api/runner/heartbeat`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify({ os: getRunnerOsInfo(), hostname: os.hostname(), version: RUNNER_VERSION, actualStates }),
		});
		if (!response.ok) {
			console.error(`[Error] API returned status ${response.status}`);
			if (response.status === 401 && runnerId && !process.env.CLIPIFY_TOKEN) {
				await clearCredentials(runnerId);
				console.error("[Runner] Local credentials were revoked. Please start the runner again to enroll it.");
				return false;
			}
			return true;
		}
		const data = await response.json();
		console.log(`[Jobs] Received ${data.jobs?.length || 0} jobs.`);
		for (const job of (data.jobs || []) as HeartbeatJob[]) await processHeartbeatJob(job, apiBase, token);
		return true;
	} catch (error) {
		console.error(`[Error] Failed to poll heartbeat:`, error);
		return true;
	}
}

async function initializeRunner(args: string[]): Promise<{ apiBase: string; token: string; runnerId?: string }> {
	const tokenArgIndex = args.indexOf("--token");
	let token = tokenArgIndex !== -1 ? args[tokenArgIndex + 1] : undefined;
	const urlArgIndex = args.findIndex((arg) => arg === "--url" || arg === "--api");
	const overrideUrl = urlArgIndex !== -1 ? args[urlArgIndex + 1] : undefined;

	const bakedConfig = extractBakedConfig(process.execPath);
	if (bakedConfig) {
		console.log("[Info] Found baked configuration in executable.");
	}

	const savedConfig = await loadCredentials();
	const localConfig: RunnerCredentials = {
		runnerId: savedConfig.runnerId,
		apiBase: savedConfig.apiBase,
		token: savedConfig.token,
	};

	// Idiotenschutz: Runner ID Mismatch Prevention
	if (bakedConfig?.runnerId && localConfig?.runnerId) {
		if (bakedConfig.runnerId !== localConfig.runnerId) {
			console.error("\n==========================================================================");
			console.error("[FATAL ERROR] Runner ID Mismatch!");
			console.error("This executable was built for a different Runner than your system is currently configured for.");
			console.error("Running multiple runners on the same machine is not officially supported.");
			console.error("If you want to switch back to this Runner, please download a fresh executable from your dashboard.");
			console.error("==========================================================================\n");
			process.exit(1);
		}
	}

	let apiBase: string;
	try {
		apiBase = resolveApiBase({
			overrideUrl,
			bakedApiBase: bakedConfig?.apiBase,
			localApiBase: localConfig.apiBase,
			hasLocalToken: Boolean(localConfig.token),
		});
	} catch (error) {
		if (error instanceof RunnerConfigurationError) {
			console.error("\n==========================================================================");
			console.error("[FATAL ERROR] Runner setup is incomplete.");
			console.error("Please download a fresh runner from your Clipify dashboard and run that file.");
			console.error("If this keeps happening, contact Clipify support.");
			console.error("==========================================================================\n");
			process.exit(1);
		}
		throw error;
	}

	// Bootstrap Token Exchange
	if (bakedConfig?.bootstrapToken) {
		console.log("[Bootstrap] Exchanging one-time bootstrap token for runner token...");
		try {
			const res = await fetch(`${apiBase}/api/runner/bootstrap`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ bootstrapToken: bakedConfig.bootstrapToken }),
			});
			if (!res.ok) {
				console.error("\n[FATAL ERROR] Bootstrap failed! This executable has likely already been initialized.");
				console.error("Please download a fresh executable from your dashboard if you need to re-authenticate.\n");
				process.exit(1);
			}
			const data = await res.json();
			localConfig.token = data.token;
			localConfig.runnerId = data.runnerId;
			await saveCredentials({
				runnerId: localConfig.runnerId,
				apiBase: apiBase,
				token: localConfig.token,
			});
			console.log("[Bootstrap] Successfully initialized and saved runner config.");
		} catch (error) {
			console.error("[FATAL ERROR] Network error during bootstrap:", error);
			process.exit(1);
		}
	}

	if (!token) {
		token = localConfig.token;
	}

	if (!token) {
		token = process.env.CLIPIFY_TOKEN;
	}

	if (!token) {
		try {
			const enrolledConfig = await enrollRunner(apiBase, bakedConfig?.runnerId || localConfig.runnerId);
			localConfig.runnerId = enrolledConfig.runnerId;
			localConfig.apiBase = enrolledConfig.apiBase;
			localConfig.token = enrolledConfig.token;
			apiBase = enrolledConfig.apiBase;
			token = enrolledConfig.token;
		} catch (error) {
			console.error("\n==========================================================================");
			console.error("[FATAL ERROR] Runner enrollment failed.");
			console.error(error);
			console.error("==========================================================================\n");
			process.exit(1);
		}
	}

	if (!token) {
		console.error("[FATAL ERROR] Missing Runner Token after enrollment.");
		process.exit(1);
	}

	const runnerToken = token;

	if (!localConfig.token || localConfig.token !== runnerToken) {
		// Save manually provided token
		await saveCredentials({
			runnerId: localConfig.runnerId,
			apiBase: apiBase,
			token: runnerToken,
		});
	}

	return { apiBase, token: runnerToken, runnerId: localConfig.runnerId };
}

async function main() {
	if (process.argv.includes("--self-test")) {
		console.log("Clipify Runner self-test passed");
		process.exit(0);
	}

	const { apiBase, token, runnerId } = await initializeRunner(process.argv.slice(2));
	ConsoleUI.init();

	await cleanupOldVersions();
	RUNNER_VERSION = await checkForUpdates(apiBase);

	console.log("==========================================");
	console.log(`=       Clipify Runner (${RUNNER_VERSION.substring(0, 8)})        =`);
	console.log("==========================================");

	console.log(`[Info] Token loaded. API Base URL is ${apiBase}. Starting polling loop...`);

	// Poll immediately
	if (!(await pollHeartbeat(token, apiBase, runnerId))) process.exit(1);

	// Update UI real-time
	setInterval(() => {
		const pinned = [`Connection: Online 🟢`, `Jobs Active: ${Object.keys(activeEngines).length}`];
		for (const [id, engine] of Object.entries(activeEngines)) {
			pinned.push(`- Engine [${id.substring(0, 8)}]: Mode=${engine.mode}, FFmpeg=${engine.ffmpegStatus}`);
		}
		ConsoleUI.setPinned(pinned);
	}, 1000);

	// Poll every 10 seconds
	setInterval(async () => {
		if (!(await pollHeartbeat(token, apiBase, runnerId))) process.exit(1);
	}, 10 * 1000);
}

main().catch(console.error);
