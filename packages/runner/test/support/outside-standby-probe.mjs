import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv[2] === "--child") {
	const input = JSON.parse(readFileSync(process.argv[3], "utf8"));
	const { RunnerScheduleCache, FreeExecutionController, ExecutionJournal } = createRequire(import.meta.url)(input.runtime);
	const values = new Map(input.keyring);
	const clock = () => (input.boundary === "before" ? 1000 : 21001);
	const cache = new RunnerScheduleCache({
		...input.identity,
		directory: input.cacheDirectory,
		clock,
		uptime: () => clock() + 50000,
		bootId: () => "outside-standby-fixture-boot",
		keyring: {
			set: async () => {
				throw new Error("Cold restore must not replace credentials");
			},
			get: async (id) => values.get(id) ?? null,
		},
	});
	const restored = await cache.restore();
	if (!restored || restored.jobs.length !== 1) throw new Error("Valid cached authority did not restore");
	const journal = new ExecutionJournal(input.journalDirectory);
	let engineCreations = 0,
		outputStarts = 0,
		sourceReads = 0;
	const emptyPlaylist = [];
	const controller = new FreeExecutionController({
		...input.identity,
		journal,
		clock,
		createEngine: () => {
			engineCreations++;
			return {
				start: async () => {
					sourceReads++;
					if (emptyPlaylist.length === 0) outputStarts++;
				},
				stop: async () => {},
				requestDrain: async () => {},
			};
		},
	});
	try {
		const prepared = controller.prepareScheduledJobs(restored.jobs, restored.request);
		const applied = await controller.apply(restored.jobs[0], restored.request);
		await controller.tick();
		process.stdout.write(JSON.stringify({ coldProcess: process.pid !== input.parentPid, cacheRestored: true, prepared, applied, emptyPlaylist: emptyPlaylist.length === 0, engineCreations, outputStarts, sourceReads, journalUnchanged: journal.get(restored.jobs[0].admissionId) === undefined }) + "\n");
	} finally {
		await controller.stopAll();
	}
} else {
	const cacheRoot = join(packageRoot, "node_modules/.cache/clipify-native-tests");
	mkdirSync(cacheRoot, { recursive: true });
	const directory = mkdtempSync(join(cacheRoot, "outside-standby-"));
	try {
		const runtime = join(directory, "runtime.cjs");
		await build({ stdin: { contents: 'export { RunnerScheduleCache } from "./src/schedule-cache"; export { FreeExecutionController } from "./src/execution-runtime"; export { ExecutionJournal } from "./src/execution-journal"; export { scheduleAuthorizationFixture } from "./test/support/schedule-fixture";', resolveDir: packageRoot }, bundle: true, platform: "node", format: "cjs", packages: "external", outfile: runtime, logLevel: "silent" });
		const { RunnerScheduleCache, scheduleAuthorizationFixture } = createRequire(import.meta.url)(runtime);
		const fixture = scheduleAuthorizationFixture();
		const identity = { ownerId: fixture.ownerId, runnerId: fixture.runnerId, keys: fixture.keys };
		const values = new Map();
		const cacheDirectory = join(directory, "cache");
		const cache = new RunnerScheduleCache({
			...identity,
			directory: cacheDirectory,
			clock: () => 1000,
			uptime: () => 51000,
			bootId: () => "outside-standby-fixture-boot",
			keyring: {
				set: async (id, value) => {
					values.set(id, value);
				},
				get: async (id) => values.get(id) ?? null,
			},
		});
		const request = { requestId: randomUUID(), sentAt: 1000 };
		const accepted = await cache.accept(fixture.response(request.requestId).scheduleCache, request);
		if (!accepted) throw new Error("Valid fixture cache did not persist");
		const inputPath = join(directory, "child-input.json");
		writeFileSync(inputPath, JSON.stringify({ runtime, identity, cacheDirectory, journalDirectory: join(directory, "journal"), boundary: process.argv[2], keyring: [...values], parentPid: process.pid }), { mode: 0o600 });
		const result = execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--child", inputPath], { encoding: "utf8", timeout: 15000 });
		process.stdout.write(JSON.stringify({ cacheStored: accepted, ...JSON.parse(result.trim()) }) + "\n");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
