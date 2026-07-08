import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Engine } from "./engine";
import { ConsoleUI } from "./logger";
import { checkForUpdates, cleanupOldVersions } from "./updater";

import { getBaseUrl } from "../app/actions/utils";

import { extractBakedConfig } from "./bootstrap";
import { loadCredentials, saveCredentials } from "./storage";

let RUNNER_VERSION = "unknown";

// Track actual states and active engines locally
const actualStates: Record<string, string> = {};
const activeEngines: Record<string, Engine> = {};

async function pollHeartbeat(token: string, apiBase: string) {
	try {
		console.log(`[Heartbeat] Polling ${apiBase}/api/runner/heartbeat...`);
		const response = await fetch(`${apiBase}/api/runner/heartbeat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				os: `${os.type()} ${os.release()}`,
				hostname: os.hostname(),
				version: RUNNER_VERSION,
				actualStates,
			}),
		});

		if (!response.ok) {
			console.error(`[Error] API returned status ${response.status}`);
			return;
		}

		const data = await response.json();

		if (data.updateAvailable) {
			// Auto-update is handled by checkForUpdates() on startup.
			// No action needed here to prevent log spam.
		}

		console.log(`[Jobs] Received ${data.jobs?.length || 0} jobs.`);
		for (const job of data.jobs || []) {
			console.log(`  - Job [${job.id}]: Mode=${job.mode}, DesiredState=${job.desiredState}`);

			if (job.desiredState === "running") {
				const existingEngine = activeEngines[job.id];
				const needsRestart = existingEngine && (existingEngine.mode !== job.mode || existingEngine.rtmpUrl !== job.rtmpUrl || existingEngine.streamKey !== job.streamKey || existingEngine.overlayId !== job.overlayId);

				if (actualStates[job.id] !== "running" || needsRestart) {
					if (needsRestart) {
						console.log(`  -> Restarting engine for job ${job.id} due to parameter change...`);
						await existingEngine.stop();
						delete activeEngines[job.id];
					} else {
						console.log(`  -> Starting engine for job ${job.id}...`);
					}

					actualStates[job.id] = "running";

					// Spawn Engine
					const engine = new Engine(job.overlayId, job.rtmpUrl, job.overlaySecret, job.streamKey, job.fps, job.resolution, job.mode, apiBase);
					activeEngines[job.id] = engine;
					engine.start().catch((err) => {
						console.error(`[Error] Engine failed to start for job ${job.id}:`, err);
						actualStates[job.id] = "error";
						engine.isRunning = false;
					});
				}
			} else if (job.desiredState === "stopped" && (actualStates[job.id] === "running" || actualStates[job.id] === "error")) {
				console.log(`  -> Stopping engine for job ${job.id}...`);
				actualStates[job.id] = "stopped";

				// Kill Engine
				if (activeEngines[job.id]) {
					await activeEngines[job.id].stop();
					delete activeEngines[job.id];
				}
			}
		}
	} catch (error) {
		console.error(`[Error] Failed to poll heartbeat:`, error);
	}
}

async function main() {
	const args = process.argv.slice(2);
	const tokenArgIndex = args.indexOf("--token");
	let token = tokenArgIndex !== -1 ? args[tokenArgIndex + 1] : undefined;

	const urlArgIndex = args.findIndex((arg) => arg === "--url" || arg === "--api");
	const overrideUrl = urlArgIndex !== -1 ? args[urlArgIndex + 1] : undefined;

	let bakedConfig = extractBakedConfig(process.execPath);
	if (bakedConfig) {
		console.log("[Info] Found baked configuration in executable.");
	}

	const savedConfig = await loadCredentials();
	let localConfig: any = {
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

	let apiBase = overrideUrl || process.env.CLIPIFY_API_URL || bakedConfig?.apiBase || localConfig.apiBase || "http://localhost:3000";

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
		console.error("\n==========================================================================");
		console.error("[FATAL ERROR] Missing Runner Token.");
		console.error("Please provide your Runner Token via the --token argument or the CLIPIFY_TOKEN environment variable.");
		console.error("==========================================================================\n");
		process.exit(1);
	}

	if (!localConfig.token || localConfig.token !== token) {
		// Save manually provided token
		await saveCredentials({
			runnerId: localConfig.runnerId,
			apiBase: apiBase,
			token: token,
		});
	}

	ConsoleUI.init();

	await cleanupOldVersions();
	RUNNER_VERSION = await checkForUpdates(apiBase);

	console.log("==========================================");
	console.log(`=       Clipify Runner (v${RUNNER_VERSION.substring(0, 8)})        =`);
	console.log("==========================================");

	console.log(`[Info] Token loaded. API Base URL is ${apiBase}. Starting polling loop...`);

	// Poll immediately
	await pollHeartbeat(token, apiBase);

	// Update UI real-time
	setInterval(() => {
		const pinned = [`Connection: Online 🟢`, `Jobs Active: ${Object.keys(activeEngines).length}`];
		for (const [id, engine] of Object.entries(activeEngines)) {
			pinned.push(`- Engine [${id.substring(0, 8)}]: Mode=${engine.mode}, FFmpeg=${engine.ffmpegStatus}`);
		}
		ConsoleUI.setPinned(pinned);
	}, 1000);

	// Poll every 10 seconds
	setInterval(() => pollHeartbeat(token as string, apiBase), 10 * 1000);
}

main().catch(console.error);
