import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test("watchdog retries failed terminal delivery and lease shutdown independently on their next due tick", async () => {
	jest.useFakeTimers();
	const flush = jest.fn().mockRejectedValueOnce(new Error("delivery offline")).mockResolvedValue(undefined);
	const tick = jest.fn().mockRejectedValueOnce(new Error("disk temporarily unavailable")).mockResolvedValue(undefined);
	const fixtureModule = { exports: {} };
	await compileRunnerCli(
		readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", ""),
		(name: string) => {
			if (name === "./terminal-credentials") return { TerminalCredentialStore: class {} };
			if (name === "./terminal-delivery") return { flushTerminalReceipts: flush };
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	const cli = fixtureModule.exports as { getTerminalCredentials: () => unknown; retryTerminalDelivery: () => Promise<void>; startExecutionWatchdog: () => NodeJS.Timeout; freeControllers: Map<string, unknown> };
	try {
		await cli.retryTerminalDelivery();
		expect(flush).not.toHaveBeenCalled();
		cli.getTerminalCredentials();
		cli.freeControllers.set("device", { runnerId: "device", controller: { tick } });
		cli.startExecutionWatchdog();
		await jest.advanceTimersByTimeAsync(250);
		expect(flush).toHaveBeenCalledTimes(1);
		expect(tick).toHaveBeenCalledTimes(1);
		await jest.advanceTimersByTimeAsync(9750);
		expect(flush).toHaveBeenCalledTimes(1);
		await jest.advanceTimersByTimeAsync(250);
		expect(flush).toHaveBeenCalledTimes(2);
		expect(tick).toHaveBeenCalledTimes(41);
	} finally {
		jest.clearAllTimers();
		jest.useRealTimers();
	}
});
