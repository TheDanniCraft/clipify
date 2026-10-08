/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
let catalogue: any;
beforeAll(() => {
	catalogue = flowProbe("catalogue:revisions");
});
for (const resource of ["overlay", "playlist", "playlist items"]) {
	for (const first of ["browser", "MCP"])
		test.each(["browser", "MCP"])(`${resource} ${first} then %s rejects stale save and accepts fresh-read retry`, (second) => {
			const row = catalogue.transitions.find((value: any) => value.resource === resource && value.first === first && value.second === second);
			expect(row.committed.success).toBe(true);
			expect(row.rejected.success).toBe(false);
			expect(row.rejected.error).toBe(second === "MCP" ? "CONFLICT" : "BROWSER_REJECTED");
			expect(row.afterStale).toEqual(row.beforeStale);
			expect(row.fresh.success).toBe(true);
			const stored = row.afterFresh[resource === "overlay" ? "overlay" : "playlist"];
			expect(stored.configuration_revision).toBe(3);
			if (resource !== "playlist items") expect(stored.name).toBe("Second");
			else expect(row.afterFresh.items.map((item: any) => item.clip_id)).toEqual(["ClipA", "ClipB"]);
		});
	test(`${resource} competing public edits commit only one revision`, () => {
		const row = catalogue.races.find((value: any) => value.resource === resource);
		expect(row.responses.filter((value: any) => value.success)).toHaveLength(1);
		expect(row.responses.filter((value: any) => value.error === "CONFLICT")).toHaveLength(1);
		expect(row.state[resource === "overlay" ? "overlay" : "playlist"].configuration_revision).toBe(2);
	});
	for (const writer of ["browser", "MCP"]) {
		test(`${resource} ${writer} audit failure preserves revision, resource and intent`, () => {
			expect(catalogue.rollbacks.find((row: any) => row.resource === resource && row.writer === writer)).toMatchObject({ result: { success: false }, unchanged: true });
		});
		test.each(["missing", "malformed"])(`${resource} ${writer} rejects %s revision before changing state`, (mode) => {
			expect(catalogue.invalid.find((row: any) => row.resource === resource && row.writer === writer && row.mode === mode)).toMatchObject({ result: { success: false }, unchanged: true });
		});
	}
}
