import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

async function fixture() {
	const engines: Array<{ start: jest.Mock; stop: jest.Mock; requestDrain: jest.Mock }> = [];
	class Engine {
		start = jest.fn().mockRejectedValue(new Error("capture failed"));
		stop = jest.fn().mockResolvedValue(undefined);
		requestDrain = jest.fn().mockRejectedValue(new Error("closure pending"));
		constructor() {
			engines.push(this);
		}
	}
	const fixtureModule = { exports: {} };
	await compileRunnerCli(
		readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", ""),
		(name: string) => {
			if (name === "./engine") return { Engine, stopTCPProxy: async () => undefined };
			if (name === "./storage") return { loadCredentials: async () => ({}) };
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	return { engines, cli: fixtureModule.exports as { initializeRunner: (args: string[]) => Promise<unknown>; pollHeartbeat: (token: string, api: string) => Promise<string>; processHeartbeatJob: (job: Record<string, unknown>, api: string, token: string) => Promise<void>; actualStates: Record<string, string>; activeEngines: Record<string, unknown> } };
}

test("failed engine startup and drain stay in error without claiming physical closure", async () => {
	const { cli, engines } = await fixture();
	const job = { id: "session", mode: "24_7", rtmpUrl: "rtmp://example.invalid", streamKey: "fixture", desiredState: "running", overlayId: "source", fps: 30, resolution: "720p" };
	await cli.processHeartbeatJob(job, "https://example.invalid", "fixture");
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(cli.actualStates.session).toBe("error");
	expect(cli.activeEngines.session).toBeUndefined();
	cli.activeEngines.session = engines[0];
	cli.actualStates.session = "running";
	await cli.processHeartbeatJob({ ...job, desiredState: "stopped" }, "https://example.invalid", "fixture");
	await new Promise<void>((resolve) => setImmediate(resolve));
	expect(cli.actualStates.session).toBe("error");
	expect(cli.activeEngines.session).toBe(engines[0]);
});

test("network and enrollment errors return retry or fail setup without accepting missing credentials", async () => {
	const previous = process.env.CLIPIFY_TOKEN;
	delete process.env.CLIPIFY_TOKEN;
	const network = jest
		.spyOn(globalThis, "fetch")
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValue(new Response("enrollment unavailable", { status: 503 }));
	const exit = jest.spyOn(process, "exit").mockImplementation(() => {
		throw new Error("fixture process exit");
	});
	try {
		const { cli } = await fixture();
		expect(await cli.pollHeartbeat("fixture", "https://example.invalid")).toBe("retry");
		await expect(cli.initializeRunner(["--api-url", "https://example.invalid"])).rejects.toThrow("fixture process exit");
		expect(exit).toHaveBeenCalledWith(1);
	} finally {
		network.mockRestore();
		exit.mockRestore();
		if (previous === undefined) delete process.env.CLIPIFY_TOKEN;
		else process.env.CLIPIFY_TOKEN = previous;
	}
});
