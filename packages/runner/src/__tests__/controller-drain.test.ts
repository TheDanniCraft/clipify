import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test.each([false, true])("TDD-US1-FR004 CLI Stop retains closure safety (emergency=%s)", async (emergency) => {
	let finishDrain: (() => void) | undefined;
	const forceStop = jest.fn().mockResolvedValue(undefined);
	const requestDrain = jest.fn(
		() =>
			new Promise<void>((resolve) => {
				finishDrain = resolve;
			}),
	);
	class FixtureEngine {
		isRunning = true;
		constructor(
			public overlayId: string,
			public rtmpUrl: string,
			public overlaySecret: string,
			public streamKey: string,
			public fps: number,
			public resolution: string,
			public mode: string,
		) {}
		start = jest.fn().mockResolvedValue(undefined);
		stop = forceStop;
		requestDrain = requestDrain;
	}
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8");
	expect(source.match(/main\(\)\.catch\(console\.error\);/g)).toHaveLength(1);
	// Expose the actual CLI dispatcher without running interactive enrollment/update startup.
	const adapted = source.replace("main().catch(console.error);", "export {processHeartbeatJob,actualStates,activeEngines};");
	const fixtureModule = { exports: {} };
	const dependency = (name: string): unknown => {
		if (name === "./engine") return { Engine: FixtureEngine, stopTCPProxy: jest.fn().mockResolvedValue(undefined) };
		if (name.startsWith("./")) return {};
		return jest.requireActual(name);
	};
	await compileRunnerCli(adapted, dependency, fixtureModule);
	const cli = fixtureModule.exports as { processHeartbeatJob: (job: Record<string, unknown>, api: string, token: string) => Promise<void>; actualStates: Record<string, string>; activeEngines: Record<string, unknown> };
	const job = { id: "session", mode: "24/7", rtmpUrl: "rtmp://127.0.0.1/live", overlaySecret: "fixture", streamKey: null, overlayId: "source", fps: 15, resolution: "720p", desiredState: "running" };
	await cli.processHeartbeatJob(job, "http://127.0.0.1", "fixture");
	let returned = false;
	const stopping = cli.processHeartbeatJob({ ...job, desiredState: "stopped" }, "http://127.0.0.1", "fixture").then(() => {
		returned = true;
	});
	await Promise.resolve();
	await Promise.resolve();
	expect(requestDrain).toHaveBeenCalledTimes(1);
	expect(forceStop).not.toHaveBeenCalled();
	expect(cli.actualStates.session).toBe("running");
	expect(returned).toBe(true);
	await cli.processHeartbeatJob({ ...job, rtmpUrl: "rtmp://127.0.0.1/changed" }, "http://127.0.0.1", "fixture");
	expect(forceStop).not.toHaveBeenCalled();
	expect(requestDrain).toHaveBeenCalledTimes(1);
	if (emergency) {
		await cli.processHeartbeatJob({ ...job, desiredState: "stopped", stopMode: "immediate" }, "http://127.0.0.1", "fixture");
		await new Promise<void>((resolve) => setImmediate(resolve));
		expect(forceStop).toHaveBeenCalledTimes(1);
		expect(cli.actualStates.session).toBe("stopped");
	}
	finishDrain?.();
	await stopping;
	await Promise.resolve();
	await Promise.resolve();
	expect(cli.actualStates.session).toBe("stopped");
	expect(cli.activeEngines.session).toBeUndefined();
});
