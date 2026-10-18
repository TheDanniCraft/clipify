import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compileRunnerCli } from "../../test/support/cli-adapter";

test("reachability preflight classifies complete responses and cleans up its temporary listener on every outcome", async () => {
	const startTCPProxy = jest.fn().mockResolvedValue(true),
		stopTCPProxy = jest.fn().mockResolvedValue(undefined),
		activateRtmpProbeNonce = jest.fn();
	const fixtureModule = { exports: {} };
	const source = readFileSync(join(__dirname, "../index.ts"), "utf8").replace("main().catch(console.error);", "");
	await compileRunnerCli(
		source,
		(name: string) => {
			if (name === "./engine") return { startTCPProxy, stopTCPProxy, activateRtmpProbeNonce };
			if (name === "os")
				return {
					networkInterfaces: () => ({
						eth0: [
							{ internal: false, address: "8.8.8.8" },
							{ internal: false, address: "8.8.8.8" },
							{ internal: true, address: "127.0.0.1" },
						],
						empty: undefined,
					}),
				};
			return name.startsWith("./") ? {} : jest.requireActual(name);
		},
		fixtureModule,
	);
	const cli = fixtureModule.exports as { checkPublicRtmpReachability: (api: string, token: string) => Promise<unknown> };
	const network = jest.spyOn(globalThis, "fetch");
	const start = { checkId: "check", nonce: "fixture", ipsToCheck: ["8.8.8.8"] };
	try {
		const cases = [
			{ startStatus: 503, body: {}, expected: "unknown" },
			{ startStatus: 200, body: {}, expected: "skipped" },
			{ startStatus: 200, body: { ...start, ipsToCheck: [] }, expected: "skipped" },
			{ startStatus: 200, body: start, executeStatus: 503, expected: "unknown" },
			{ startStatus: 200, body: start, result: { status: "not_reachable" }, expected: "not_reachable" },
			{ startStatus: 200, body: start, result: { status: "unknown" }, expected: "unknown" },
			{ startStatus: 200, body: start, result: { status: "reachable", reachableIps: ["8.8.8.8"] }, expected: "reachable" },
			{ startStatus: 200, body: start, result: { status: "reachable" }, expected: "reachable" },
		];
		for (const example of cases) {
			network.mockReset();
			network.mockResolvedValueOnce(new Response(JSON.stringify(example.body), { status: example.startStatus }));
			if (example.body === start) network.mockResolvedValueOnce(new Response(JSON.stringify(example.result ?? {}), { status: example.executeStatus ?? 200 }));
			expect(await cli.checkPublicRtmpReachability("https://example.invalid", "fixture-token")).toEqual({ status: example.expected, reachableIps: example.result && "reachableIps" in example.result ? example.result.reachableIps : [] });
			expect(network).toHaveBeenNthCalledWith(1, "https://example.invalid/api/runner/reachability/start", expect.objectContaining({ body: JSON.stringify({ candidateIps: ["8.8.8.8"] }) }));
		}
		expect(stopTCPProxy).toHaveBeenCalledTimes(cases.length);
		network.mockReset().mockRejectedValue(new Error("offline"));
		stopTCPProxy.mockRejectedValueOnce(new Error("close failed"));
		expect(await cli.checkPublicRtmpReachability("https://example.invalid", "fixture-token")).toEqual({ status: "unknown", reachableIps: [] });
		startTCPProxy.mockResolvedValueOnce(false);
		await cli.checkPublicRtmpReachability("https://example.invalid", "fixture-token");
		expect(stopTCPProxy).toHaveBeenCalledTimes(cases.length + 1);
		expect(activateRtmpProbeNonce).toHaveBeenCalled();
	} finally {
		network.mockRestore();
	}
});
