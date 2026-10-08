/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
let catalogue: any;
beforeAll(() => {
	catalogue = flowProbe("catalogue:retry-isolation");
});
test("retry records remain isolated across two clients, actors, creators and tools", () => {
	expect(catalogue).toMatchObject({ records: 8, resources: 8, clients: 2, actors: 2, creators: 2 });
});
for (const kind of ["overlay", "playlist"]) {
	test.each(["client", "actor", "creator"])(`${kind} identical textual key is independent for %s`, (context) => {
		const row = catalogue.outcomes.find((value: any) => value.kind === kind && value.context === context);
		for (const result of [row.baseline, row.created, row.replay]) expect(result).toMatchObject({ status: 200, error: null, safe: true });
		expect(row.baseline.id).toEqual(expect.any(String));
		expect(row.created.id).toEqual(expect.any(String));
		expect(row.created.id).not.toBe(row.baseline.id);
		expect(row.replay.id).toBe(row.created.id);
		expect(row.created.creatorId).toBe(context === "creator" ? "retry-second-creator" : "fixture-creator");
	});
}
