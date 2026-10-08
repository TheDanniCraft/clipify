/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

describe("TDD-US2-007 delete_overlay through authenticated MCP", () => {
	test("deletes only the current owned overlay and returns its identifier", () => {
		const result = flowProbe("resources:overlay-delete");
		expect(result.resourceResult).toEqual({ deletedId: "79e6c5a3-5368-4813-9780-49d22d99175f" });
		expect(result.resourceCount).toBe(0);
	});
	test.each([
		["stale", "CONFLICT"],
		["missing", "RESOURCE_UNAVAILABLE"],
		["denied", "ACCESS_DENIED"],
	])("%s delete preserves resources", (mode, code) => {
		const result = flowProbe(`resources:overlay-delete:${mode}`);
		expect(result.resourceResult?.error?.code).toBe(code);
		expect(result.resourceCount).toBe(1);
	});
	test("requires the separately approved overlay delete scope", () => {
		const result = flowProbe("resources:overlay-delete:no-scope");
		expect(result.protocolStatus).toBe(403);
		expect(result.challenge).toContain("insufficient_scope");
		expect(result.resourceCount).toBe(1);
	});
});
