import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test("legacy paid job updates restart changed encoders and reject destination settings missing a required stream key", async () => {
	const engines: Array<{ stop: jest.Mock; start: jest.Mock; requestDrain: jest.Mock; isRunning: boolean }> = [];
	const stopTCPProxy = jest.fn().mockResolvedValue(undefined);
	class Engine {
		stop = jest.fn().mockResolvedValue(undefined);
		start = jest.fn().mockResolvedValue(undefined);
		requestDrain = jest.fn().mockResolvedValue(undefined);
		isRunning = true;
		constructor(
			public overlayId: string,
			public rtmpUrl: string,
			_secret: string,
			public streamKey: string,
			public fps: number,
			public resolution: string,
			public mode: string,
		) {
			engines.push(this);
		}
	}
	const fixtureModule = { exports: {} };
	await compileRunnerCli(readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", ""), (name: string) => (name === "./engine" ? { Engine, stopTCPProxy } : name.startsWith("./") ? {} : jest.requireActual(name)), fixtureModule);
	const cli = fixtureModule.exports as { processHeartbeatJob: (job: Record<string, unknown>, api: string, token: string) => Promise<void>; actualStates: Record<string, string>; activeEngines: Record<string, unknown>; stopActiveEngines: () => Promise<void> };
	const job = { id: "session", mode: "24/7", rtmpUrl: "rtmp://custom.invalid/live", streamKey: null, overlaySecret: "secret", overlayId: "overlay", fps: 30, resolution: "720p", desiredState: "running" };
	await cli.processHeartbeatJob(job, "https://example.invalid", "token");
	expect(engines).toHaveLength(1);
	await cli.processHeartbeatJob(job, "https://example.invalid", "token");
	expect(engines).toHaveLength(1);
	await cli.processHeartbeatJob({ ...job, fps: 60 }, "https://example.invalid", "token");
	expect(engines[0].stop).toHaveBeenCalledTimes(1);
	expect(engines).toHaveLength(2);
	await cli.processHeartbeatJob({ ...job, rtmpUrl: "rtmp://live.twitch.tv/app" }, "https://example.invalid", "token");
	expect(engines[1].stop).toHaveBeenCalledTimes(1);
	expect(cli.actualStates.session).toBe("error");
	expect(cli.activeEngines.session).toBeUndefined();
	await cli.processHeartbeatJob({ ...job, desiredState: "stopped" }, "https://example.invalid", "token");
	expect(cli.actualStates.session).toBe("stopped");
	await cli.processHeartbeatJob({ ...job, rtmpUrl: "rtmp://live.twitch.tv/app" }, "https://example.invalid", "token");
	expect(cli.actualStates.session).toBe("error");
	await cli.processHeartbeatJob({ ...job, id: "failure" }, "https://example.invalid", "token");
	const failed = engines[2];
	failed.stop.mockRejectedValueOnce(new Error("controlled stop failure"));
	await cli.stopActiveEngines();
	expect(cli.activeEngines.failure).toBeUndefined();
	expect(stopTCPProxy).toHaveBeenCalled();
});
