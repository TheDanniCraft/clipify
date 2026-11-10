/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("Better Auth retains concurrent Runner, Drive and Event YouTube links for the same Google identity", () => {
	expect(runMcpProbe("event-google-link-probe", [], 60000)).toEqual({ independentLinks: 3, sameIdentity: true, deniedLinkPreserved: true, refreshes: 3, sessionPreserved: true });
}, 65000);
