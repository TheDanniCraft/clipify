import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

async function fixture() {
	const saveCredentials = jest.fn().mockResolvedValue(undefined),
		openBrowser = jest.fn();
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "");
	const fixtureModule = { exports: {} };
	await compileRunnerCli(
		source,
		(name: string) => {
			if (name === "./storage") return { saveCredentials, loadCredentials: async () => ({}) };
			if (name === "./browser") return { openBrowser };
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	return { cli: fixtureModule.exports as { enrollRunner: (api: string, id?: string) => Promise<unknown>; initializeRunner: (args: string[]) => Promise<unknown> }, saveCredentials, openBrowser };
}

test("pending enrollment can expire and refresh its code before persisting approval without reopening the browser", async () => {
	jest.useFakeTimers();
	const { cli, saveCredentials, openBrowser } = await fixture();
	const network = jest.spyOn(globalThis, "fetch");
	const enrollment = { deviceCode: "first", userCode: "FIRST", verificationUri: "https://example.invalid/enroll", expiresAt: new Date(Date.now() + 60000).toISOString(), pollInterval: 1 };
	network
		.mockResolvedValueOnce(new Response(JSON.stringify(enrollment)))
		.mockResolvedValueOnce(new Response(null, { status: 202 }))
		.mockResolvedValueOnce(new Response(null, { status: 410 }))
		.mockResolvedValueOnce(new Response(JSON.stringify({ ...enrollment, deviceCode: "second", userCode: "SECOND", pollInterval: 0 })))
		.mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" })))
		.mockResolvedValueOnce(new Response(JSON.stringify({ status: "approved", runnerId: "device", apiBase: "https://example.invalid", token: "approved-fixture" })));
	try {
		const enrolling = cli.enrollRunner("https://example.invalid", "device");
		await jest.advanceTimersByTimeAsync(9000);
		expect(await enrolling).toEqual({ runnerId: "device", apiBase: "https://example.invalid", token: "approved-fixture" });
		expect(saveCredentials).toHaveBeenCalledTimes(1);
		expect(openBrowser).toHaveBeenCalledTimes(1);
		expect(network).toHaveBeenLastCalledWith("https://example.invalid/api/runner/enroll/poll", expect.objectContaining({ body: JSON.stringify({ deviceCode: "second" }) }));
	} finally {
		network.mockRestore();
		jest.useRealTimers();
	}
});

test("enrollment poll failure never persists a token", async () => {
	jest.useFakeTimers();
	const { cli, saveCredentials } = await fixture();
	const network = jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(new Response(JSON.stringify({ deviceCode: "first", userCode: "FIRST", verificationUri: "https://example.invalid/enroll", expiresAt: new Date(Date.now() + 60000).toISOString(), pollInterval: 1 })))
		.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
	try {
		const enrolling = cli.enrollRunner("https://example.invalid");
		const assertion = expect(enrolling).rejects.toThrow("Enrollment poll failed with status 503");
		await jest.advanceTimersByTimeAsync(1000);
		await assertion;
		expect(saveCredentials).not.toHaveBeenCalled();
	} finally {
		network.mockRestore();
		jest.useRealTimers();
	}
});

test("initial setup returns the approved device and server connection settings", async () => {
	jest.useFakeTimers();
	const previous = process.env.CLIPIFY_TOKEN;
	delete process.env.CLIPIFY_TOKEN;
	const { cli, saveCredentials } = await fixture();
	const approved = { runnerId: "approved-device", apiBase: "https://approved.invalid", token: "approved-token" };
	const network = jest
		.spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(new Response(JSON.stringify({ deviceCode: "code", userCode: "CODE", verificationUri: "https://example.invalid/enroll", expiresAt: new Date(Date.now() + 60000).toISOString(), pollInterval: 1 })))
		.mockResolvedValueOnce(new Response(JSON.stringify({ status: "approved", ...approved })));
	try {
		const initializing = cli.initializeRunner(["--api-url", "https://example.invalid"]);
		await jest.advanceTimersByTimeAsync(1000);
		expect(await initializing).toEqual(approved);
		expect(saveCredentials).toHaveBeenCalledTimes(1);
		expect(saveCredentials).toHaveBeenCalledWith(approved);
	} finally {
		network.mockRestore();
		jest.useRealTimers();
		if (previous === undefined) delete process.env.CLIPIFY_TOKEN;
		else process.env.CLIPIFY_TOKEN = previous;
	}
});
