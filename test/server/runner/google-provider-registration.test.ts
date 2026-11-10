/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("production registers the separate Google providers required by Better Auth's preview proxy", () => {
	expect(runMcpProbe("google-provider-registration-probe", [], 60000)).toEqual({ providers: 2, stableCallbacks: true, proxyRoundTrips: 2, separateAccounts: true, sessionPreserved: true });
}, 65000);
