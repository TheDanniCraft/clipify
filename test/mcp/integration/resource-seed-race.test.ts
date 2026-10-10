/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("concurrent Better Auth startup tolerates the Drizzle-wrapped resource uniqueness race", () => {
	const result = runMcpProbe("resource-seed-probe", ["fixed"]);
	expect(result.initialized).toEqual(["fulfilled", "fulfilled"]);
	expect(result.resources).toBe(1);
	expect(result.statuses).toEqual([200, 200]);
});
