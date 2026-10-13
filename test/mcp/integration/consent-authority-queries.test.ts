/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
let outcomes: Array<{ mode: string; status: number; reads: number; grantsAdded: number }>;
beforeAll(() => {
	outcomes = runMcpProbe("consent-authority-probe", []);
});
test.each(["allowed", "restored"])("%s consent loads current creator authority once for all selected scopes", (mode) => {
	expect(outcomes.find((row) => row.mode === mode)).toEqual({ mode, status: 200, reads: 1, grantsAdded: 1 });
});
test.each(["mixed-denied", "removed-member", "expired-pro", "suspended", "agency-mixed-denied"])("%s consent issues no grant", (mode) => {
	expect(outcomes.find((row) => row.mode === mode)).toMatchObject({ status: 403, grantsAdded: 0 });
});
