import { createRunnerReachabilityCheck, isPublicRoutableAddress } from "../runnerReachability";

describe("runner RTMP reachability helpers", () => {
	it.each(["127.0.0.1", "10.0.0.5", "172.16.4.2", "192.168.178.20", "100.64.1.1", "169.254.1.1", "::1", "fe80::1", "fd12::1"])("treats %s as non-public", (address) => {
		expect(isPublicRoutableAddress(address)).toBe(false);
	});

	it.each(["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888"])("treats %s as public-routable", (address) => {
		expect(isPublicRoutableAddress(address)).toBe(true);
	});

	it("only includes public-routable candidates in checks", () => {
		const check = createRunnerReachabilityCheck("runner-1", ["192.168.178.20", "8.8.8.8", "8.8.8.8"]);

		expect(check.checkId).toEqual(expect.any(String));
		expect(check.nonce).toEqual(expect.any(String));
		expect(check.ipsToCheck).toEqual(["8.8.8.8"]);
	});
});
