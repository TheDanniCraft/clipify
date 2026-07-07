import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Engine } from "./engine";
import { ConsoleUI } from "./logger";

import { getBaseUrl } from "../app/actions/utils";

const RUNNER_VERSION = "1.0.0";

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
			console.log(`[Updater] A new version is available: ${data.latestVersion}!`);
			console.log(`[Updater] Please download it from: ${data.downloadUrl}`);
			// TODO: Implement actual auto-download and replacement logic here
		}

		console.log(`[Jobs] Received ${data.jobs?.length || 0} jobs.`);
		for (const job of data.jobs || []) {
			console.log(`  - Job [${job.id}]: Mode=${job.mode}, DesiredState=${job.desiredState}`);

			if (job.desiredState === "running" && actualStates[job.id] !== "running") {
				console.log(`  -> Starting engine for job ${job.id}...`);
				actualStates[job.id] = "running";

				// Spawn Engine
				const engine = new Engine(job.overlayId, job.rtmpUrl, job.overlaySecret, job.streamKey, job.fps, job.resolution, job.mode, apiBase);
				activeEngines[job.id] = engine;
				engine.start().catch((err) => {
					console.error(`[Error] Engine failed to start for job ${job.id}:`, err);
					actualStates[job.id] = "error";
					engine.isRunning = false;
				});
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
	console.log("==========================================");
	console.log(`=       Clipify Runner (v${RUNNER_VERSION})        =`);
	console.log("==========================================");

	const args = process.argv.slice(2);
	const tokenArgIndex = args.indexOf("--token");
	let token = tokenArgIndex !== -1 ? args[tokenArgIndex + 1] : undefined;

	const urlArgIndex = args.findIndex((arg) => arg === "--url" || arg === "--api");
	const overrideUrl = urlArgIndex !== -1 ? args[urlArgIndex + 1] : undefined;

	// 2. Check Environment Variable
	if (!token) {
		token = process.env.CLIPIFY_TOKEN;
	}

	const configPath = path.join(os.homedir(), ".clipify-runner-config.json");

	// 3. Check Config File

	if (!token) {
		try {
			if (fs.existsSync(configPath)) {
				const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
				if (config.token) token = config.token;
			}
		} catch (error) {
			console.error("[Warning] Failed to read config file:", error);
		}
	}

	if (!token) {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		token = await new Promise<string>((resolve) => {
			rl.question("Please enter your Clipify Runner Token: ", (answer) => {
				rl.close();
				resolve(answer.trim());
			});
		});

		if (!token) {
			console.error("Error: Token cannot be empty.");
			process.exit(1);
		}

		try {
			fs.writeFileSync(configPath, JSON.stringify({ token }), "utf-8");
			console.log(`[Info] Token saved to ${configPath} for future use.`);
		} catch (error) {
			console.error("[Warning] Failed to save token to config file:", error);
		}
	}

	ConsoleUI.init();

	const BAKED_API_URL = process.env.BAKED_API_URL || "";
	let apiBase = overrideUrl || process.env.CLIPIFY_API_URL || BAKED_API_URL || (await getBaseUrl()).toString().replace(/\/$/, "");

	// Default to localhost if running via runner:dev (where NODE_ENV is not explicitly production)
	if (apiBase === "https://clipify.us" && process.env.NODE_ENV !== "production") {
		apiBase = "http://localhost:3000";
	}

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
