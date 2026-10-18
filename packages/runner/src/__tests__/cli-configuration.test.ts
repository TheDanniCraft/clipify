import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test("an environment token can initialize a downloaded runner without interactive enrollment", async () => {
	const previous = process.env.CLIPIFY_TOKEN;
	process.env.CLIPIFY_TOKEN = "fixture-environment-token";
	const saveCredentials = jest.fn().mockResolvedValue(undefined);
	try {
		const cli = await fixture({ loadCredentials: async () => ({}), saveCredentials });
		expect(await cli.initializeRunner(["--url", "https://example.invalid/"])).toEqual({ runnerId: undefined, apiBase: "https://example.invalid", token: "fixture-environment-token" });
		expect(saveCredentials).toHaveBeenCalledWith({ runnerId: undefined, apiBase: "https://example.invalid", token: "fixture-environment-token" });
	} finally {
		if (previous === undefined) delete process.env.CLIPIFY_TOKEN;
		else process.env.CLIPIFY_TOKEN = previous;
	}
});

test("missing connection settings fail startup before enrollment or credential writes", async () => {
	const previous = process.argv,
		api = process.env.CLIPIFY_API_URL,
		baked = process.env.BAKED_API_URL;
	process.argv = ["node", "/tmp/downloaded-runner"];
	delete process.env.CLIPIFY_API_URL;
	delete process.env.BAKED_API_URL;
	const exit = jest.spyOn(process, "exit").mockImplementation(() => {
		throw new Error("fixture process exit");
	});
	const saveCredentials = jest.fn();
	try {
		const cli = await fixture({ loadCredentials: async () => ({}), saveCredentials });
		await expect(cli.initializeRunner([])).rejects.toThrow("fixture process exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(saveCredentials).not.toHaveBeenCalled();
	} finally {
		exit.mockRestore();
		process.argv = previous;
		if (api === undefined) delete process.env.CLIPIFY_API_URL;
		else process.env.CLIPIFY_API_URL = api;
		if (baked === undefined) delete process.env.BAKED_API_URL;
		else process.env.BAKED_API_URL = baked;
	}
});

async function fixture(storage: Record<string, unknown> = {}) {
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "");
	const fixtureModule = { exports: {} };
	await compileRunnerCli(
		source,
		(name: string) => {
			if (name === "./storage") return storage;
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	return fixtureModule.exports as { resolveApiBase: (options: { overrideUrl?: string; localApiBase?: string; hasLocalToken: boolean }) => string; isPublicRoutableAddress: (value: unknown) => boolean; initializeRunner: (args: string[]) => Promise<unknown>; startRunnerEnrollment: (api: string, id?: string) => Promise<unknown>; requiresStreamKey: (url: string) => boolean };
}

test("CLI uses explicit connection settings before local credentials and limits localhost defaults to source execution", async () => {
	const cli = await fixture();
	const previous = process.argv;
	const api = process.env.CLIPIFY_API_URL,
		baked = process.env.BAKED_API_URL;
	delete process.env.CLIPIFY_API_URL;
	delete process.env.BAKED_API_URL;
	try {
		process.argv = ["node", "/tmp/runner"];
		expect(cli.resolveApiBase({ overrideUrl: "https://explicit.invalid///", localApiBase: "https://saved.invalid", hasLocalToken: true })).toBe("https://explicit.invalid");
		expect(cli.resolveApiBase({ localApiBase: "https://saved.invalid/", hasLocalToken: true })).toBe("https://saved.invalid");
		expect(() => cli.resolveApiBase({ hasLocalToken: false })).toThrow("missing its Clipify connection settings");
		process.env.CLIPIFY_API_URL = "https://environment.invalid/";
		expect(cli.resolveApiBase({ hasLocalToken: false })).toBe("https://environment.invalid");
		delete process.env.CLIPIFY_API_URL;
		process.env.BAKED_API_URL = "https://baked.invalid/";
		expect(cli.resolveApiBase({ hasLocalToken: false })).toBe("https://baked.invalid");
		delete process.env.BAKED_API_URL;
		process.argv = ["node", "C:\\project\\packages/runner/src/index.ts"];
		expect(cli.resolveApiBase({ hasLocalToken: false })).toBe("http://localhost:3000");
		expect(cli.resolveApiBase({ localApiBase: "https://saved.invalid", hasLocalToken: true })).toBe("https://saved.invalid");
	} finally {
		process.argv = previous;
		if (api === undefined) delete process.env.CLIPIFY_API_URL;
		else process.env.CLIPIFY_API_URL = api;
		if (baked === undefined) delete process.env.BAKED_API_URL;
		else process.env.BAKED_API_URL = baked;
	}
});

test("reachability candidates exclude local, reserved, documentation and multicast networks", async () => {
	const cli = await fixture();
	for (const address of [null, 1, "", "  ", "0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.1.1", "172.31.1.1", "192.168.1.1", "100.64.1.1", "100.127.1.1", "192.0.0.1", "192.0.2.1", "198.18.1.1", "198.19.1.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "256.1.1.1", "::", "::1", "fe80::1%eth0", "fc00::1", "fd00::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1"]) expect(cli.isPublicRoutableAddress(address)).toBe(false);
	for (const address of ["8.8.8.8", "1.1.1.1", "172.15.1.1", "172.32.1.1", "100.63.1.1", "100.128.1.1", "2606:4700:4700::1111", " ::FFFF:8.8.8.8 "]) expect(cli.isPublicRoutableAddress(address)).toBe(true);
	expect(cli.requiresStreamKey("rtmp://live.twitch.tv/app")).toBe(true);
	expect(cli.requiresStreamKey("rtmp://a.rtmp.youtube.com/live2")).toBe(true);
	expect(cli.requiresStreamKey("rtmp://custom.invalid/live")).toBe(false);
});

test("CLI manual token overrides saved credentials and persists the same device identity", async () => {
	const saveCredentials = jest.fn().mockResolvedValue(undefined);
	const cli = await fixture({ loadCredentials: async () => ({ runnerId: "device", token: "saved", apiBase: "https://saved.invalid" }), saveCredentials });
	expect(await cli.initializeRunner(["--token", "manual", "--api-url=https://explicit.invalid/"])).toEqual({ runnerId: "device", token: "manual", apiBase: "https://explicit.invalid" });
	expect(saveCredentials).toHaveBeenCalledWith({ runnerId: "device", token: "manual", apiBase: "https://explicit.invalid" });
	saveCredentials.mockClear();
	expect(await cli.initializeRunner(["--api", "https://explicit.invalid"])).toEqual({ runnerId: "device", token: "saved", apiBase: "https://explicit.invalid" });
	expect(saveCredentials).not.toHaveBeenCalled();
});

test("enrollment rejects server failures and sends device identity without a bearer", async () => {
	const cli = await fixture();
	const network = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));
	try {
		await expect(cli.startRunnerEnrollment("https://example.invalid", "device")).rejects.toThrow("Enrollment start failed with status 503");
		expect(network).toHaveBeenCalledWith("https://example.invalid/api/runner/enroll/start", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, body: expect.stringContaining('"runnerId":"device"') }));
		network.mockResolvedValue(new Response(JSON.stringify({ deviceCode: "code" })));
		expect(await cli.startRunnerEnrollment("https://example.invalid")).toEqual({ deviceCode: "code" });
	} finally {
		network.mockRestore();
	}
});
