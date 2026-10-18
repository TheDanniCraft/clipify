import { readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { scheduleAuthorizationFixture } from "../../test/support/schedule-fixture";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";

test("TDD-US5-CON015: official polling learns device identity only after verified owner policy", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {pollHeartbeat};");
	const fixtureModule = { exports: {} };
	const saveCredentials = jest.fn().mockResolvedValue(undefined);
	const keys = generateKeyPairSync("ed25519");
	const keyId = createHash("sha256")
		.update(keys.publicKey.export({ type: "spki", format: "der" }))
		.digest("hex")
		.slice(0, 16);
	const previousKeys = process.env.RUNNER_EXECUTION_PUBLIC_KEYS;
	process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify({ [keyId]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() });
	const dependency = (name: string) => {
		if (name === "./protocol") return jest.requireActual("../protocol");
		if (name === "./execution-keys") return jest.requireActual("../execution-keys");
		if (name === "./storage") return { saveCredentials };
		if (name === "./execution-journal")
			return {
				ExecutionJournal: class {
					pendingTerminals() {
						return [];
					}
				},
			};
		return dependencyFallback(name);
	};
	await compileRunnerCli(source, dependency, fixtureModule);
	const runnerId = randomUUID(),
		foreignRunner = randomUUID();
	let mode = "invalid";
	const originalFetch = global.fetch;
	global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
		const request = JSON.parse(String(init?.body)),
			issuedAt = 1000000;
		const capabilities = { basicAccess: true, runnerPro: true, maxRegisteredDevices: null, maxActiveBroadcasts: null, maxTargets: null, scheduling: true, customStandby: true, attributionRequired: false, monthlyUsageLimit: null, validUntil: new Date(issuedAt + 60000).toISOString(), source: "grant", evaluatedAt: new Date(issuedAt).toISOString(), capabilityRevision: "a".repeat(64) };
		const claims = { issuer: "clipify.us", kind: "benefits", ownerId: mode === "foreign" ? "operator" : "creator", runnerId: mode === "foreign" ? foreignRunner : runnerId, requestId: request.requestId, configurationRevision: 1, issuedAt, expiresAt: issuedAt + 60000, capabilities };
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		const snapshot = { keyId, payload, signature: mode === "invalid" ? "invalid" : sign(null, Buffer.from(payload), keys.privateKey).toString("base64url") };
		return new Response(JSON.stringify({ jobs: [], benefitSnapshot: mode === "missing" ? null : snapshot }), { status: 200 });
	}) as typeof fetch;
	try {
		const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string) => Promise<string>; getRunnerBenefitCache?: (credentialId: string) => { runnerPro: boolean; scope: { ownerId: string; runnerId: string } | null } };
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1")).toBe("ok");
		expect(saveCredentials).not.toHaveBeenCalled();
		mode = "valid";
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1")).toBe("ok");
		expect(saveCredentials).toHaveBeenCalledWith({ runnerId, apiBase: "http://127.0.0.1", token: "fixture-token" });
		expect(cli.getRunnerBenefitCache).toEqual(expect.any(Function));
		const credentialId = createHash("sha256")
			.update(JSON.stringify(["http://127.0.0.1", "fixture-token"]))
			.digest("hex");
		const cache = cli.getRunnerBenefitCache?.(credentialId);
		expect(cache?.runnerPro).toBe(true);
		mode = "foreign";
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1")).toBe("ok");
		expect(cache?.runnerPro).toBe(false);
		expect(cache?.scope).toEqual({ ownerId: "creator", runnerId });
		mode = "valid";
		await cli.pollHeartbeat("fixture-token", "http://127.0.0.1");
		expect(cache?.runnerPro).toBe(true);
		mode = "missing";
		await cli.pollHeartbeat("fixture-token", "http://127.0.0.1");
		expect(cache?.runnerPro).toBe(false);
		expect(saveCredentials).toHaveBeenCalledTimes(1);
	} finally {
		global.fetch = originalFetch;
		if (previousKeys === undefined) delete process.env.RUNNER_EXECUTION_PUBLIC_KEYS;
		else process.env.RUNNER_EXECUTION_PUBLIC_KEYS = previousKeys;
	}
});

function dependencyFallback(name: string): unknown {
	if (name === "./execution-clock") return { executionNow: () => 0 };
	if (name === "./execution-keys") return { parseExecutionPublicKeys: () => ({ fixture: "public-fixture" }) };
	return name.startsWith("./") ? {} : jest.requireActual(name);
}

test("TDD-US1-DEC001: CLI heartbeats advertise protocol 2 with a fresh nonce on every request", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export { pollHeartbeat };");
	const fixtureModule = { exports: {} };
	const dependency = (name: string) =>
		name === "./execution-journal"
			? {
					ExecutionJournal: class {
						pendingTerminals() {
							return [];
						}
					},
				}
			: dependencyFallback(name);
	await compileRunnerCli(source, dependency, fixtureModule);
	const originalFetch = global.fetch;
	const requests: Record<string, unknown>[] = [];
	global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ success: true, jobs: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
	}) as typeof fetch;
	try {
		const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string> };
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", "fixture-runner")).toBe("ok");
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", "fixture-runner")).toBe("ok");
		for (const request of requests) {
			expect(request.protocolVersion).toBe(2);
			expect(request.capabilities).toEqual(expect.arrayContaining(["admissions", "drain", "runner_presentation", "free_lease", "schedule_cache"]));
			expect(request.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		}
		expect(requests[0].requestId).not.toBe(requests[1].requestId);
	} finally {
		global.fetch = originalFetch;
	}
});

test("TDD-US1-DEC001: CLI sends signed jobs through the lease controller without blocking heartbeat on media startup", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", 'export { pollHeartbeat, stopActiveEngines }; export const watchdog = typeof startExecutionWatchdog === "function" ? startExecutionWatchdog : undefined;');
	const apply = jest.fn<Promise<boolean>, [unknown, { requestId: string; sentAt: number }]>(() => new Promise<boolean>(() => {})),
		confirm = jest.fn();
	const tick = jest.fn().mockResolvedValue(undefined);
	const stopAll = jest.fn().mockResolvedValue(undefined);
	const report = { admissionId: "receipt", executionGeneration: "closed-generation", state: "stopped" };
	const reports = jest.fn(() => [report]);
	const construct = jest.fn();
	class Controller {
		constructor(options: unknown) {
			construct(options);
		}
		stopAll = stopAll;
		tick = tick;
		apply = apply;
		confirm = confirm;
		reports = reports;
	}
	const fixtureModule = { exports: {} };
	const dependency = (name: string) => {
		if (name === "./engine")
			return {
				stopTCPProxy: jest.fn().mockResolvedValue(undefined),
				Engine: class {
					start = async () => {};
				},
			};
		if (name === "./execution-runtime") return { FreeExecutionController: Controller };
		if (name === "./execution-journal")
			return {
				ExecutionJournal: class {
					pendingTerminals() {
						return [];
					}
				},
			};
		return dependencyFallback(name);
	};
	await compileRunnerCli(source, dependency, fixtureModule);
	const job = { id: "session", runnerId: "device", ownerId: "creator", admissionId: "admission", executionGeneration: "generation", configurationRevision: 2, desiredState: "running", lease: { keyId: "fixture", payload: "fixture", signature: "fixture" } };
	const requests: Record<string, unknown>[] = [];
	const originalFetch = global.fetch;
	global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify(requests.length === 1 ? { jobs: [job] } : { jobs: [], acceptedExecutions: [report] }), { status: 200 });
	}) as typeof fetch;
	try {
		const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string>; stopActiveEngines: () => Promise<void>; watchdog?: () => unknown };
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", "device")).toBe("ok");
		expect(construct).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "creator", runnerId: "device", keys: { fixture: "public-fixture" }, createEngine: expect.any(Function) }));
		expect(apply).toHaveBeenCalledWith(job, expect.objectContaining({ requestId: requests[0].requestId, sentAt: expect.any(Number) }));
		expect(apply.mock.calls[0][1].sentAt).toBeLessThanOrEqual(performance.now());
		expect(apply.mock.calls[0][1].sentAt).toBe(0);
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", "device")).toBe("ok");
		expect(requests[1].executions).toEqual([report]);
		expect(confirm).toHaveBeenCalledWith([report]);
		const schedule = jest.spyOn(global, "setInterval").mockReturnValue({ unref: () => {} } as unknown as ReturnType<typeof setInterval>);
		try {
			cli.watchdog?.();
			expect(schedule).toHaveBeenCalledWith(expect.any(Function), 250);
			const callback = schedule.mock.calls[0][0] as () => void;
			callback();
			await Promise.resolve();
			expect(tick).toHaveBeenCalledTimes(1);
		} finally {
			schedule.mockRestore();
		}
		await cli.stopActiveEngines();
		expect(stopAll).toHaveBeenCalledTimes(1);
	} finally {
		global.fetch = originalFetch;
	}
});

test("TDD-US1-DEC001: CLI restart retries saved terminal receipts before receiving any new job", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export { pollHeartbeat };");
	const receipt = { ownerId: "creator", runnerId: "device", admissionId: "old-admission", sessionId: "session", executionGeneration: "closed-generation", leaseId: "lease", configurationRevision: 2, state: "stopped", allOutputsClosed: true };
	const report = { admissionId: receipt.admissionId, sessionId: receipt.sessionId, executionGeneration: receipt.executionGeneration, leaseId: receipt.leaseId, configurationRevision: receipt.configurationRevision, state: receipt.state, allOutputsClosed: receipt.allOutputsClosed };
	const construct = jest.fn(),
		confirm = jest.fn();
	class Controller {
		constructor(options: unknown) {
			construct(options);
		}
		reports() {
			return [report];
		}
		confirm = confirm;
	}
	const dependency = (name: string) => {
		if (name === "./execution-journal")
			return {
				ExecutionJournal: class {
					pendingTerminals() {
						return [receipt];
					}
				},
			};
		if (name === "./execution-runtime") return { FreeExecutionController: Controller };
		return dependencyFallback(name);
	};
	const fixtureModule = { exports: {} };
	await compileRunnerCli(source, dependency, fixtureModule);
	const originalFetch = global.fetch;
	let request: Record<string, unknown> | undefined;
	global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ jobs: [], acceptedExecutions: [report] }), { status: 200 });
	}) as typeof fetch;
	try {
		const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string> };
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", "device")).toBe("ok");
		expect(construct).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "creator", runnerId: "device" }));
		expect(request?.executions).toEqual([report]);
		expect(confirm).toHaveBeenCalledWith([report]);
	} finally {
		global.fetch = originalFetch;
	}
});

test("TDD-US1-FR004: process shutdown allows the bounded clip drain before its emergency exit deadline", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {shutdownRunner,freeControllers};");
	const fixtureModule = { exports: {} };
	const dependency = (name: string) => (name === "./engine" ? { stopTCPProxy: jest.fn().mockResolvedValue(undefined) } : dependencyFallback(name));
	await compileRunnerCli(source, dependency, fixtureModule);
	const cli = fixtureModule.exports as { shutdownRunner: (reason: string) => Promise<void>; freeControllers: Map<string, unknown> };
	let finish: (() => void) | undefined;
	cli.freeControllers.set("fixture", {
		runnerId: "device",
		controller: {
			stopAll: () =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		},
	});
	const timer = jest.spyOn(global, "setTimeout").mockReturnValue({ unref: () => {} } as unknown as ReturnType<typeof setTimeout>);
	const clear = jest.spyOn(global, "clearTimeout").mockImplementation(() => {});
	const exit = jest.spyOn(process, "exit").mockImplementation((() => undefined) as (code?: string | number | null) => never);
	let shutdown: Promise<void> | undefined;
	try {
		shutdown = cli.shutdownRunner("fixture");
		expect(timer).toHaveBeenCalledWith(expect.any(Function), 305000);
		expect(exit).not.toHaveBeenCalled();
		finish?.();
		await shutdown;
		expect(exit).toHaveBeenCalledWith(0);
	} finally {
		finish?.();
		await shutdown;
		timer.mockRestore();
		clear.mockRestore();
		exit.mockRestore();
	}
});

test.each([false, true])("TDD-US1-FR004 revoked credentials close and deliver before re-enrollment (environment token=%s)", async (environmentToken) => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {pollHeartbeat,freeControllers};");
	const events: string[] = [];
	const save = jest.fn(async () => {
		events.push("save");
		return "credential-ref";
	});
	const delivery = jest.fn(async () => {
		events.push("deliver");
	});
	const dependency = (name: string) => {
		if (name === "./engine") return { stopTCPProxy: jest.fn().mockResolvedValue(undefined) };
		if (name === "./storage")
			return {
				clearCredentials: async () => {
					events.push("clear");
				},
			};
		if (name === "./execution-journal")
			return {
				ExecutionJournal: class {
					pendingTerminals() {
						return [];
					}
				},
			};
		if (name === "./terminal-credentials")
			return {
				TerminalCredentialStore: class {
					save = save;
				},
			};
		if (name === "./terminal-delivery") return { flushTerminalReceipts: delivery };
		return dependencyFallback(name);
	};
	const fixtureModule = { exports: {} };
	await compileRunnerCli(source, dependency, fixtureModule);
	const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string>; freeControllers: Map<string, unknown> };
	cli.freeControllers.set("fixture", {
		runnerId: "device",
		controller: {
			reports: () => [],
			stopAll: async () => {
				events.push("closed");
			},
		},
	});
	const originalFetch = global.fetch,
		originalToken = process.env.CLIPIFY_TOKEN;
	if (environmentToken) process.env.CLIPIFY_TOKEN = "retired-fixture-token";
	else delete process.env.CLIPIFY_TOKEN;
	global.fetch = jest.fn(async () => new Response(null, { status: 401 })) as typeof fetch;
	try {
		expect(await cli.pollHeartbeat("retired-fixture-token", "http://127.0.0.1:3107", "device")).toBe(environmentToken ? "retry" : "reauth");
		expect(save).toHaveBeenCalledWith({ runnerId: "device", apiBase: "http://127.0.0.1:3107", token: "retired-fixture-token" });
		expect(events).toEqual(environmentToken ? ["save", "closed", "deliver"] : ["save", "closed", "deliver", "clear"]);
	} finally {
		global.fetch = originalFetch;
		if (originalToken === undefined) delete process.env.CLIPIFY_TOKEN;
		else process.env.CLIPIFY_TOKEN = originalToken;
	}
});

test.each([false, true])("TDD-US1-CON004 manual token learns its device only from verified persisted execution (valid=%s)", async (valid) => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {pollHeartbeat};");
	const runnerId = "11111111-1111-4111-8111-111111111111";
	const job = { id: "44444444-4444-4444-8444-444444444444", runnerId, ownerId: "creator", admissionId: "33333333-3333-4333-8333-333333333333", executionGeneration: "22222222-2222-4222-8222-222222222222", configurationRevision: 2, desiredState: "running", lease: { keyId: "fixture", payload: "fixture", signature: "fixture" } };
	let verified = false;
	const apply = jest.fn(async () => {
			verified = valid;
			return valid;
		}),
		save = jest.fn().mockResolvedValue(undefined);
	const report = { admissionId: job.admissionId, sessionId: job.id, executionGeneration: job.executionGeneration, leaseId: "lease", configurationRevision: 2, state: "active" };
	class Journal {
		pendingTerminals() {
			return [];
		}
		get() {
			return verified ? { ...job, sessionId: job.id, state: "starting" } : undefined;
		}
	}
	class Controller {
		apply = apply;
		reports = () => (verified ? [report] : []);
		confirm = () => {};
	}
	const dependency = (name: string) => {
		if (name === "./execution-journal") return { ExecutionJournal: Journal };
		if (name === "./execution-runtime") return { FreeExecutionController: Controller };
		if (name === "./storage") return { saveCredentials: save };
		return dependencyFallback(name);
	};
	const fixtureModule = { exports: {} };
	await compileRunnerCli(source, dependency, fixtureModule);
	const requests: Record<string, unknown>[] = [];
	const originalFetch = global.fetch;
	global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
		requests.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ jobs: requests.length === 1 ? [job] : [] }), { status: 200 });
	}) as typeof fetch;
	try {
		const cli = fixtureModule.exports as { pollHeartbeat: (token: string, api: string) => Promise<string> };
		expect(await cli.pollHeartbeat("manual-fixture-token", "http://127.0.0.1:3107")).toBe("ok");
		expect(apply).toHaveBeenCalledTimes(1);
		if (valid) expect(save).toHaveBeenCalledWith({ runnerId, apiBase: "http://127.0.0.1:3107", token: "manual-fixture-token" });
		else expect(save).not.toHaveBeenCalled();
		expect(await cli.pollHeartbeat("manual-fixture-token", "http://127.0.0.1:3107")).toBe("ok");
		expect(requests[1].executions).toEqual(valid ? [report] : []);
	} finally {
		global.fetch = originalFetch;
	}
});

test("TDD-US1-FR004 Free live fallback preserves the existing reachability preflight without blocking on an unavailable probe", async () => {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {getFreeController};");
	let factory: ((job: Record<string, unknown>, policy: { mayOpenOutput: () => boolean }) => { start: () => Promise<void> }) | undefined;
	const start = jest.fn().mockResolvedValue(undefined),
		startProxy = jest.fn().mockResolvedValue(true),
		stopProxy = jest.fn().mockResolvedValue(undefined);
	class FixtureEngine {
		start = start;
	}
	class Controller {
		constructor(options: { createEngine: typeof factory }) {
			factory = options.createEngine;
		}
	}
	const dependency = (name: string) => {
		if (name === "./engine") return { Engine: FixtureEngine, startTCPProxy: startProxy, stopTCPProxy: stopProxy };
		if (name === "./execution-runtime") return { FreeExecutionController: Controller };
		if (name === "./execution-journal") return { ExecutionJournal: class {} };
		if (name === "./reachability") return { getRtmpReachabilityConfirmation: () => null };
		return dependencyFallback(name);
	};
	const fixtureModule = { exports: {} };
	await compileRunnerCli(source, dependency, fixtureModule);
	const cli = fixtureModule.exports as { getFreeController: (job: Record<string, unknown>, runnerId: string, api: string, token: string) => unknown };
	const originalFetch = global.fetch;
	const network = jest.fn(async () => new Response(null, { status: 403 }));
	global.fetch = network as typeof fetch;
	try {
		const job = { id: "session", ownerId: "creator", runnerId: "device", overlayId: "source", rtmpUrl: "rtmp://127.0.0.1/live", overlaySecret: "fixture", streamKey: null, fps: 15, resolution: "720p", mode: "failsafe", executionGeneration: "generation" };
		cli.getFreeController(job, "device", "http://127.0.0.1:3107", "fixture-token");
		await factory?.(job, { mayOpenOutput: () => true }).start();
		expect(network).toHaveBeenCalledWith("http://127.0.0.1:3107/api/runner/reachability/start", expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer fixture-token" } }));
		expect(startProxy).toHaveBeenCalledTimes(1);
		expect(stopProxy).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledTimes(1);
	} finally {
		global.fetch = originalFetch;
	}
});

test("TDD-US3-FR012: actual heartbeat polling persists a verified schedule cache with private payload references", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cli-schedule-cache-"));
	const fixture = scheduleAuthorizationFixture();
	const originalKeys = process.env.RUNNER_EXECUTION_PUBLIC_KEYS;
	const originalFetch = global.fetch;
	process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify(fixture.keys);
	try {
		const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {pollHeartbeat};");
		const compiled = { exports: {} };
		await compileRunnerCli(
			source,
			(name) => {
				if (name === "os" || name === "node:os") return { ...jest.requireActual("node:os"), homedir: () => directory };
				if (name === "./execution-clock") return { executionNow: () => 1000 };
				if (name === "./protocol") return jest.requireActual("../protocol");
				if (name === "./execution-keys") return jest.requireActual("../execution-keys");
				if (name === "./execution-journal") return jest.requireActual("../execution-journal");
				if (name === "./schedule-cache") return jest.requireActual("../schedule-cache");
				return dependencyFallback(name);
			},
			compiled,
		);
		global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
			const request = JSON.parse(String(init?.body));
			return new Response(JSON.stringify(fixture.response(request.requestId)), { status: 200 });
		}) as typeof fetch;
		const cli = compiled.exports as { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string> };
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", fixture.runnerId)).toBe("ok");
		const snapshotPath = join(directory, ".clipify-runner", "schedules", fixture.runnerId, "snapshot.json");
		expect(existsSync(snapshotPath)).toBe(true);
		const snapshot = readFileSync(snapshotPath, "utf8");
		expect(snapshot).not.toContain(fixture.overlaySecret);
		expect(snapshot).not.toContain(fixture.streamKey);
		expect(JSON.parse(snapshot).entries).toEqual([expect.objectContaining({ credentialReference: expect.any(String) })]);
	} finally {
		global.fetch = originalFetch;
		if (originalKeys === undefined) delete process.env.RUNNER_EXECUTION_PUBLIC_KEYS;
		else process.env.RUNNER_EXECUTION_PUBLIC_KEYS = originalKeys;
		rmSync(directory, { recursive: true, force: true });
	}
});

async function assertCachedOutputAcrossControlFailure(scenario: "disconnect" | "disconnect_active" | "restart" | "revoked" | "missed") {
	const directory = mkdtempSync(join(tmpdir(), "clipify-offline-cli-"));
	const fixture = scheduleAuthorizationFixture();
	const previousKeys = process.env.RUNNER_EXECUTION_PUBLIC_KEYS,
		previousFetch = global.fetch;
	const start = jest.fn().mockResolvedValue(undefined),
		drain = jest.fn().mockResolvedValue(undefined),
		stop = jest.fn().mockResolvedValue(undefined);
	let elapsed = 1000,
		uptime = 50000;
	let timer: ReturnType<typeof setInterval> | undefined;
	const values = new Map<string, string>();
	class MediaBoundary {
		mode = "24_7";
		isRunning = true;
		start = start;
		stop = stop;
		requestDrain = drain;
	}
	process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify(fixture.keys);
	try {
		const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "export {pollHeartbeat,startExecutionWatchdog};");
		type Cli = { pollHeartbeat: (token: string, api: string, runnerId: string) => Promise<string>; startExecutionWatchdog: () => ReturnType<typeof setInterval> };
		const compile = async () => {
			const compiledModule = { exports: {} };
			await compileRunnerCli(
				source,
				(name) => {
					if (name === "os" || name === "node:os") return { ...jest.requireActual("node:os"), homedir: () => directory };
					if (name === "./execution-clock") return { executionNow: () => elapsed };
					if (name === "./execution-keys") return jest.requireActual("../execution-keys");
					if (name === "./protocol") return jest.requireActual("../protocol");
					if (name === "./execution-journal") return jest.requireActual("../execution-journal");
					if (name === "./execution-runtime") return jest.requireActual("../execution-runtime");
					if (name === "./engine") return { Engine: MediaBoundary, stopTCPProxy: async () => undefined };
					if (name === "./terminal-credentials")
						return {
							TerminalCredentialStore: class {
								save = async () => undefined;
								load = async () => [];
							},
						};
					if (name === "./terminal-delivery") return { flushTerminalReceipts: async () => undefined };
					if (name === "./storage") return { clearCredentials: async () => undefined, saveCredentials: async () => undefined };
					if (name === "./schedule-cache") {
						const Actual = jest.requireActual("../schedule-cache").RunnerScheduleCache;
						return {
							RunnerScheduleCache: class extends Actual {
								constructor(options: object) {
									super({
										...options,
										uptime: () => uptime,
										bootId: () => "boot-A",
										keyring: {
											set: async (id: string, value: string) => {
												values.set(id, value);
											},
											get: async (id: string) => values.get(id) ?? null,
										},
									});
								}
							},
						};
					}
					return dependencyFallback(name);
				},
				compiledModule,
			);
			return compiledModule.exports as Cli;
		};
		global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => new Response(JSON.stringify(fixture.response(JSON.parse(String(init?.body)).requestId)), { status: 200 })) as typeof fetch;
		let cli = await compile();
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", fixture.runnerId)).toBe("ok");
		if (scenario === "disconnect_active") {
			jest.useFakeTimers();
			timer = cli.startExecutionWatchdog();
			elapsed = 11000;
			uptime = 60000;
			await jest.advanceTimersByTimeAsync(250);
			expect(start).toHaveBeenCalledTimes(1);
			expect(drain).not.toHaveBeenCalled();
		}
		global.fetch = scenario === "revoked" ? (jest.fn(async () => new Response(null, { status: 401 })) as typeof fetch) : scenario === "disconnect_active" ? (jest.fn(async () => new Response(null, { status: 503 })) as typeof fetch) : jest.fn().mockRejectedValue(new Error("isolated control connection unavailable"));
		if (scenario === "restart") {
			elapsed = 0;
			uptime = 65000;
			cli = await compile();
		}
		expect(await cli.pollHeartbeat("fixture-token", "http://127.0.0.1", fixture.runnerId)).toBe(scenario === "revoked" && !process.env.CLIPIFY_TOKEN ? "reauth" : "retry");
		if (scenario === "disconnect_active") {
			expect(drain).not.toHaveBeenCalled();
			expect(stop).not.toHaveBeenCalled();
			expect(existsSync(join(directory, ".clipify-runner", "schedules", fixture.runnerId, "snapshot.json"))).toBe(true);
		}
		if (!timer) {
			jest.useFakeTimers();
			timer = cli.startExecutionWatchdog();
		}
		if (scenario === "revoked") {
			elapsed = 11000;
			uptime = 60000;
			await jest.advanceTimersByTimeAsync(250);
			expect(start).not.toHaveBeenCalled();
			expect(existsSync(join(directory, ".clipify-runner", "schedules", fixture.runnerId, "snapshot.json"))).toBe(false);
			return;
		}
		if (scenario === "missed") {
			elapsed = 21000;
			uptime = 70000;
			await jest.advanceTimersByTimeAsync(250);
			expect(start).not.toHaveBeenCalled();
			const { ExecutionJournal } = jest.requireActual("../execution-journal");
			const journal = new ExecutionJournal(join(directory, ".clipify-runner", "executions", fixture.runnerId));
			expect(journal.pendingTerminals()).toEqual([expect.objectContaining({ state: "stopped", allOutputsClosed: true, occurrence: { occurrenceId: '["event","original"]', start: 1010000, end: 1020000 } })]);
			return;
		}
		await jest.advanceTimersByTimeAsync(250);
		if (scenario === "disconnect") {
			expect(start).not.toHaveBeenCalled();
			elapsed = 11000;
			uptime = 60000;
			await jest.advanceTimersByTimeAsync(250);
		}
		expect(start).toHaveBeenCalledTimes(1);
		elapsed = scenario === "restart" ? 5000 : 21000;
		uptime = 70000;
		await jest.advanceTimersByTimeAsync(250);
		expect(drain).toHaveBeenCalledTimes(1);
		expect(stop).not.toHaveBeenCalled();
	} finally {
		if (timer) clearInterval(timer);
		jest.useRealTimers();
		global.fetch = previousFetch;
		if (previousKeys === undefined) delete process.env.RUNNER_EXECUTION_PUBLIC_KEYS;
		else process.env.RUNNER_EXECUTION_PUBLIC_KEYS = previousKeys;
		rmSync(directory, { recursive: true, force: true });
	}
}

test.each(["disconnect", "restart", "revoked", "missed"] as const)("TDD-US3-FR012: official polling and watchdog honor cached output across %s", assertCachedOutputAcrossControlFailure);
test("TDD-US3-OPT044: an accepted cached execution survives a control 503 while retaining its original end", () => assertCachedOutputAcrossControlFailure("disconnect_active"));
