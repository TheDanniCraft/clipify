import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test.each(["ok", "retry", "reauth"])("main initializes the native runner and handles %s heartbeats before the next polling wait", async (status) => {
	jest.useFakeTimers();
	const originalArgv = process.argv;
	const initialListeners = new Map<string, ReturnType<typeof process.listeners>>();
	for (const event of ["SIGINT", "SIGTERM", "SIGHUP"]) initialListeners.set(event, process.listeners(event));
	const stdoutListeners = process.stdout.listeners("error"),
		stderrListeners = process.stderr.listeners("error");
	const saved = { runnerId: "device", apiBase: "https://example.invalid", token: "fixture-token" };
	const loadCredentials = jest.fn().mockResolvedValue(saved),
		clearCredentials = jest.fn().mockResolvedValue(undefined);
	const acquireRunnerInstance = jest.fn().mockResolvedValue(undefined),
		recoverInterruptedExecutions = jest.fn().mockResolvedValue(new Set(["interrupted"]));
	const checkForUpdates = jest.fn().mockResolvedValue("fixture-version"),
		init = jest.fn(),
		setPinned = jest.fn();
	const ensureDependencies = jest.fn(() => (status === "retry" ? Promise.reject(new Error("offline")) : new Promise(() => {})));
	const fixtureModule = { exports: {} };
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "");
	await compileRunnerCli(
		source,
		(name: string) => {
			if (name === "./downloader") return { ensureDependencies };
			if (name === "./startup-recovery") return { acquireRunnerInstance, recoverInterruptedExecutions };
			if (name === "./storage") return { loadCredentials, clearCredentials };
			if (name === "./updater") return { checkForUpdates, cleanupOldVersions: async () => undefined };
			if (name === "./logger") return { ConsoleUI: { init, setPinned } };
			if (name === "./execution-clock") return { executionNow: () => 0 };
			if (name === "./terminal-credentials")
				return {
					TerminalCredentialStore: class {
						save = async () => undefined;
					},
				};
			if (name === "./terminal-delivery") return { flushTerminalReceipts: async () => undefined };
			if (name === "./execution-journal")
				return {
					ExecutionJournal: class {
						pendingTerminals() {
							return [];
						}
					},
				};
			if (name === "./engine") return { stopTCPProxy: async () => undefined };
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	const cli = fixtureModule.exports as { main: () => Promise<void> };
	const sentinel = new Error("completed polling checkpoint");
	const timers = jest.spyOn(globalThis, "setTimeout");
	// Save Jest's timer implementation before installing the interception.
	const delegate = timers.getMockImplementation()!;
	timers.mockImplementation(((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
		if (delay === 10000) throw sentinel;
		return delegate(callback, delay, ...args);
	}) as typeof globalThis.setTimeout);
	const network = jest.spyOn(globalThis, "fetch");
	if (status === "reauth") network.mockResolvedValueOnce(new Response("revoked", { status: 401 })).mockResolvedValue(new Response(JSON.stringify({ jobs: [] })));
	else network.mockResolvedValue(new Response(JSON.stringify({ jobs: [] }), { status: status === "retry" ? 503 : 200 }));
	process.argv = ["node", "/tmp/runner"];
	try {
		await expect(cli.main()).rejects.toBe(sentinel);
		expect(init).toHaveBeenCalledTimes(1);
		expect(ensureDependencies).toHaveBeenCalledTimes(1);
		expect(ensureDependencies.mock.invocationCallOrder[0]).toBeLessThan(network.mock.invocationCallOrder[0]);
		expect(acquireRunnerInstance).toHaveBeenCalledTimes(1);
		expect(recoverInterruptedExecutions).toHaveBeenCalledTimes(1);
		expect(recoverInterruptedExecutions.mock.invocationCallOrder[0]).toBeLessThan(loadCredentials.mock.invocationCallOrder[0]);
		expect(checkForUpdates).toHaveBeenCalledTimes(status === "reauth" ? 2 : 1);
		expect(loadCredentials).toHaveBeenCalledTimes(status === "reauth" ? 2 : 1);
		if (status === "reauth") expect(clearCredentials).toHaveBeenCalledWith("device");
		timers.mockRestore();
		await jest.advanceTimersByTimeAsync(1000);
		expect(setPinned).toHaveBeenCalledWith(expect.arrayContaining([status === "retry" ? "Connection: Offline 🔴" : "Connection: Online 🟢", "Jobs Active: 0"]));
	} finally {
		network.mockRestore();
		timers.mockRestore();
		process.argv = originalArgv;
		for (const [event, previous] of initialListeners) for (const listener of process.listeners(event)) if (!previous.includes(listener)) process.removeListener(event, listener as (...args: unknown[]) => void);
		for (const listener of process.stdout.listeners("error")) if (!stdoutListeners.includes(listener)) process.stdout.removeListener("error", listener);
		for (const listener of process.stderr.listeners("error")) if (!stderrListeners.includes(listener)) process.stderr.removeListener("error", listener);
		jest.clearAllTimers();
		jest.useRealTimers();
	}
});
