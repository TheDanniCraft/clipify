import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test("Free engine adapters retain a replacement execution when an older generation closes", async () => {
	type Assignment = { id: string; ownerId: string; runnerId: string; mode: string; streamKey?: string };
	type Media = { start: () => Promise<void | boolean>; stop: () => Promise<void>; requestDrain: (options: { deadlineMonotonic: number }) => Promise<void> };
	let factory: (assignment: Assignment, policy: { mayOpenOutput: () => boolean }) => Media;
	const construction: unknown[][] = [];
	const engines: Array<{ start: jest.Mock; stop: jest.Mock; requestDrain: jest.Mock }> = [];
	class Engine {
		start = jest.fn().mockResolvedValue(undefined);
		stop = jest.fn().mockResolvedValue(undefined);
		requestDrain = jest.fn().mockResolvedValue(undefined);
		constructor(...args: unknown[]) {
			construction.push(args);
			engines.push(this);
		}
	}
	class Controller {
		constructor(options: { createEngine: typeof factory }) {
			factory = options.createEngine;
		}
	}
	const fixtureModule = { exports: {} };
	await compileRunnerCli(
		readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", ""),
		(name: string) => {
			if (name === "./execution-runtime") return { FreeExecutionController: Controller };
			if (name === "./execution-journal") return { ExecutionJournal: class {} };
			if (name === "./execution-keys") return { parseExecutionPublicKeys: () => ({}) };
			if (name === "./engine") return { Engine, stopTCPProxy: async () => undefined };
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	const cli = fixtureModule.exports as { getFreeController: (job: Assignment, id: string, api: string, token: string) => unknown; processHeartbeatJob: (job: Record<string, unknown>, api: string, token: string) => Promise<void>; actualStates: Record<string, string>; activeEngines: Record<string, unknown> };
	const assignment = { id: "session", ownerId: "owner", runnerId: "device", mode: "24/7", streamKey: "fixture" };
	const controller = cli.getFreeController(assignment, "device", "https://example.invalid", "fixture");
	expect(cli.getFreeController(assignment, "device", "https://example.invalid", "fixture")).toBe(controller);
	expect(cli.getFreeController(assignment, "foreign-device", "https://example.invalid", "fixture")).toBeNull();
	const old = factory!(assignment, { mayOpenOutput: () => true });
	expect(construction[0][9]).toMatchObject({ presentationSessionId: assignment.id });
	await old.start();
	expect(cli.actualStates.session).toBe("running");
	await cli.processHeartbeatJob({ ...assignment, desiredState: "stopped" }, "https://example.invalid", "fixture");
	expect(engines[0].requestDrain).not.toHaveBeenCalled();
	expect(engines[0].stop).not.toHaveBeenCalled();
	expect(cli.actualStates.session).toBe("running");
	const replacement = factory!(assignment, { mayOpenOutput: () => true });
	await old.requestDrain({ deadlineMonotonic: 123 });
	expect(engines[0].requestDrain).toHaveBeenCalledWith({ deadlineMonotonic: 123 });
	expect(cli.activeEngines.session).toBe(engines[1]);
	await replacement.start();
	await replacement.stop();
	expect(engines[1].stop).toHaveBeenCalledTimes(1);
	expect(cli.activeEngines.session).toBeUndefined();
	expect(cli.actualStates.session).toBe("stopped");
	const refused = factory!(assignment, { mayOpenOutput: () => true });
	engines[2].start.mockResolvedValue(false);
	await expect(refused.start()).resolves.toBe(false);
	expect(cli.actualStates.session).toBe("stopped");
	await refused.stop();
	expect(cli.activeEngines.session).toBeUndefined();
});
