import { readFileSync, existsSync, statSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { pathToFileURL } from "node:url";
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const require = createRequire(pathToFileURL(input.packageRoot + "/package.json"));
const childProcess = require("node:child_process"),
	originalSpawn = childProcess.spawn;
let outputStarts = 0;
childProcess.spawn = function (command, args, ...rest) {
	if (String(command).includes("ffmpeg") && args?.includes(input.output)) outputStarts++;
	return originalSpawn.call(this, command, args, ...rest);
};
syncBuiltinESMExports();
const started = performance.now();
const clock = () => input.clockAtRestart + performance.now() - started;
globalThis.__clipifyMediaClock = clock;
process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify(input.cache.keys);
const { RunnerScheduleCache } = await import(pathToFileURL(input.runtimePath));
const cli = await import(pathToFileURL(input.cliPath));
let watchdog;
try {
	const cache = new RunnerScheduleCache({
		...input.cache,
		clock,
		uptime: clock,
		bootId: () => "isolated-media-boot",
		keyring: {
			set: async () => {
				throw new Error("FIXTURE_KEYRING_UNAVAILABLE");
			},
			get: async () => null,
		},
	});
	let reads = 0;
	const restore = cache.restore.bind(cache);
	cache.restore = async () => {
		reads++;
		return restore();
	};
	const restored = await cache.restore();
	if (!restored) throw new Error("COLD_RESTART_SIGNED_CACHE_UNAVAILABLE");
	cli.scheduleCaches.set("cold-restart", cache);
	cli.scheduleContexts.set("cold-restart", { runnerId: input.cache.runnerId, apiBase: input.apiBase, token: "fixture-token", busy: false });
	watchdog = cli.startExecutionWatchdog();
	const deadline = Date.now() + 20000;
	if (input.expectSkipped) {
		const initialReads = reads;
		while (reads < initialReads + 3) {
			if (Date.now() >= deadline) throw new Error("EXPIRED_RETURN_WATCHDOG_DID_NOT_RECONCILE");
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		const record = cli.getFreeJournal(input.cache.runnerId).get(input.admissionId);
		const latest = await cache.restore();
		console.log(
			JSON.stringify({
				coldProcess: process.pid !== input.parentPid,
				resumeControlRecorded: record?.occurrence?.explicitResume === true,
				cacheRestored: latest !== null,
				outputStarts,
				activePipelines: Object.values(cli.activeEngines).filter((entry) => entry.isRunning).length,
				state: record?.state,
				allOutputsClosed: record?.allOutputsClosed === true,
				originalEnd: record?.occurrence?.end,
				expectedEnd: input.originalEnd,
				skipped: record?.state === "stopped" && record.allOutputsClosed === true,
				boundaryReached: latest !== null && latest.serverTimeLower >= input.originalEnd,
			}),
		);
	} else {
		let captureStartTimedOut = false;
		while (!cli.activeEngines[input.sessionId]?.mediaStream || !cli.activeEngines[input.sessionId]?.ffmpeg || !existsSync(input.output) || statSync(input.output).size < 1024) {
			if (Date.now() >= deadline) {
				captureStartTimedOut = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		if (captureStartTimedOut) {
			const record = cli.getFreeJournal(input.cache.runnerId).get(input.admissionId);
			console.log(JSON.stringify({ coldProcess: process.pid !== input.parentPid, cacheRestored: true, captureStartTimedOut: true, outputStarts, activePipelines: Object.values(cli.activeEngines).filter((entry) => entry.isRunning).length, state: record?.state, remainingWindow: record?.occurrence?.end === input.originalEnd, resumeControlRecorded: record?.occurrence?.explicitResume === true, realCapture: false, realEncoder: false, encodedOutput: false }));
		} else {
			const initialReads = reads;
			while (reads < initialReads + 3) {
				if (Date.now() >= deadline) throw new Error("COLD_RESTART_WATCHDOG_DID_NOT_RECONCILE");
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			const engine = cli.activeEngines[input.sessionId];
			const record = cli.getFreeJournal(input.cache.runnerId).get(input.admissionId);
			console.log(
				JSON.stringify({
					coldProcess: process.pid !== input.parentPid,
					priorStopped: input.priorAdmissionId ? cli.getFreeJournal(input.cache.runnerId).get(input.priorAdmissionId)?.state === "stopped" : undefined,
					priorSuppressed: input.priorAdmissionId ? cli.getFreeJournal(input.cache.runnerId).get(input.priorAdmissionId)?.occurrence?.suppressed === true : undefined,
					cacheRestored: true,
					outputStarts,
					activePipelines: Object.values(cli.activeEngines).filter((entry) => entry.isRunning).length,
					remainingWindow: record?.occurrence?.end === input.originalEnd,
					resumeControlRecorded: record?.occurrence?.explicitResume === true,
					state: record?.state,
					suppressed: record?.occurrence?.suppressed === true,
					originalEnd: record?.occurrence?.end,
					recordGeneration: record?.executionGeneration,
					expectedGeneration: input.generation,
					encodedOutput: existsSync(input.output) && statSync(input.output).size >= 1024,
					realEncoder: !!engine?.ffmpeg,
					realCapture: !!engine?.mediaStream,
					reconciliations: reads - initialReads,
				}),
			);
		}
	}
} finally {
	clearInterval(watchdog);
	// Emergency process teardown occurs after the restart observation, without Stop intent.
	for (const engine of Object.values(cli.activeEngines)) await engine.stop();
	childProcess.spawn = originalSpawn;
	syncBuiltinESMExports();
	const { wss } = require("puppeteer-stream");
	const server = await wss;
	await new Promise((resolve) => server.close(resolve));
}
