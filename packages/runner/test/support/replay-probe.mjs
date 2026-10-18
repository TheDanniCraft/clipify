import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createRequire, syncBuiltinESMExports } from "node:module";
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const require = createRequire(pathToFileURL(input.packageRoot + "/package.json"));
const childProcess = require("node:child_process"),
	originalSpawn = childProcess.spawn;
let encoderOpened = 0,
	engineCreated = 0;
childProcess.spawn = function (command, ...args) {
	if (String(command).includes("ffmpeg")) encoderOpened++;
	return originalSpawn.call(this, command, ...args);
};
syncBuiltinESMExports();
const { FreeExecutionController, ExecutionJournal } = await import(pathToFileURL(input.runtimePath));
const { Engine } = await import(pathToFileURL(input.enginePath));
const originalDateNow = Date.now;
Date.now = () => 0;
const attempts = [];
try {
	for (const variant of ["offline_replay", "changed_generation", "terminal_replay"]) {
		const directory = join(input.directory, variant);
		mkdirSync(directory, { mode: 0o700 });
		writeFileSync(join(directory, "execution-journal.json"), variant === "terminal_replay" ? input.closedSnapshot : input.activeSnapshot, { mode: 0o600 });
		const job = { ...input.job, ...(variant === "changed_generation" ? { executionGeneration: randomUUID() } : {}) };
		const controller = new FreeExecutionController({
			ownerId: job.ownerId,
			runnerId: job.runnerId,
			keys: input.keys,
			journal: new ExecutionJournal(directory),
			clock: () => 100,
			createEngine: (assignment, policy) => {
				engineCreated++;
				return new Engine(assignment.overlayId, assignment.rtmpUrl, assignment.overlaySecret, assignment.streamKey ?? "", assignment.fps, assignment.resolution, "24_7", input.apiBase, "fixture-token", { executionGeneration: assignment.executionGeneration, now: () => 100, mayOpenOutput: policy.mayOpenOutput });
			},
		});
		const accepted = await controller.apply(job, { requestId: randomUUID(), sentAt: 100 });
		if (accepted) await controller.stop(job, true);
		attempts.push({ variant, accepted });
	}
	console.log(JSON.stringify({ attempts, encoderOpened, engineCreated, wallClockRolledBack: Date.now() === 0 }));
} finally {
	Date.now = originalDateNow;
	childProcess.spawn = originalSpawn;
	syncBuiltinESMExports();
	const { wss } = require("puppeteer-stream");
	const server = await wss;
	await new Promise((resolve) => server.close(resolve));
}
