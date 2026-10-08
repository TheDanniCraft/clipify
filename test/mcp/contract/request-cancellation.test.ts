/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-US4-020 request-body cancellation boundaries", () => {
	test.each([
		["aborted-body", 400],
		["stalled-body", 408],
	])("%s releases its reader and returns %s without authenticating", (mode, status) => {
		const result = runMcpProbe("request-boundary-probe", [String(mode)]);
		expect(result.status).toBe(status);
		expect(result.cancelled).toBe(true);
		expect(result.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3107");
	});
});
