/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const probe = (mode: string) => runMcpProbe("activity-list-probe", [mode]);
describe("TDD-ACTIVITY-003 current creator audit access and safe pagination", () => {
	test.each(["normal", "analyst", "revoked-connection"])("%s can inspect approved creator history without private payloads", (mode) => {
		const result = probe(mode);
		expect(result.available).toBe(true);
		expect(result.error).toBeNull();
		expect(result.result.items).toHaveLength(2);
		expect(result.result.items.map((row: any) => row.outcome)).toEqual(["denied", "success"]);
		expect(result.result.items[0]).toMatchObject({ actor: { id: "owner", name: "Owner" }, client: { id: "client", name: "Custom AI" }, creator: { id: "creator", name: "Creator" }, tool: "update_playlist" });
		expect(JSON.stringify(result.result)).not.toMatch(/private-payload-value|private-token|rawInput|secret|Private creator|fixture-session/);
	});
	test.each(["foreign", "removed", "suspended", "no-audit", "free-team"])("%s current access cannot inspect private activity", (mode) => {
		const result = probe(mode);
		expect(result.available).toBe(true);
		expect(result.error).toBe("ACCESS_DENIED");
		expect(result.result).toBeNull();
	});
	test("pagination preserves microsecond order without skipping or repeating records", () => {
		const result = probe("pagination");
		expect(result.available).toBe(true);
		expect(result.error).toBeNull();
		expect(result.result.items).toHaveLength(1);
		expect(result.second.items).toHaveLength(1);
		expect(result.result.items[0].id).not.toBe(result.second.items[0].id);
		expect(result.second.nextCursor).toBeNull();
	});
	test.each(["invalid-limit", "malformed-cursor"])("%s is rejected before unbounded activity reads", (mode) => {
		const result = probe(mode);
		expect(result.available).toBe(true);
		expect(result.error).toBe("INVALID_INPUT");
	});
	test.each(["cross-actor-cursor", "cross-creator-cursor"])("%s cannot reuse another authorized context cursor", (mode) => {
		const result = probe(mode);
		expect(result.available).toBe(true);
		expect(result.result.nextCursor).toEqual(expect.any(String));
		expect(result.error).toBe("INVALID_INPUT");
		expect(result.second).toBeNull();
	});
});
