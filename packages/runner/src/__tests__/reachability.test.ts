import { getRtmpReachabilityConfirmation } from "../reachability";

describe("RTMP reachability messages", () => {
	it("confirms a completed negative exposure check", () => {
		expect(getRtmpReachabilityConfirmation("not_reachable")).toBe("[Security] No publicly reachable RTMP port detected.");
	});

	it("distinguishes a skipped check", () => {
		expect(getRtmpReachabilityConfirmation("skipped")).toBe("[Security] No public network address detected; RTMP exposure check skipped.");
	});

	it.each(["reachable", "unknown"] as const)("does not emit a success confirmation for %s", (status) => {
		expect(getRtmpReachabilityConfirmation(status)).toBeNull();
	});
});
