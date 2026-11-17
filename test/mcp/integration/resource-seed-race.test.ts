/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("concurrent Better Auth startup tolerates the Drizzle-wrapped resource uniqueness race", () => {
	const result = runMcpProbe("resource-seed-probe", ["fixed"]);
	expect(result.initialized).toEqual(["fulfilled", "fulfilled"]);
	expect(result.resources).toEqual(["http://127.0.0.1:3107/api/auth/oauth2/userinfo", "http://127.0.0.1:3107/api/connected-apps", "http://127.0.0.1:3107/mcp"]);
	expect(result.statuses).toEqual([200, 200]);
});
