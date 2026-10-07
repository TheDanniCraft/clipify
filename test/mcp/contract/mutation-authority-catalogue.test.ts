/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
const names = ["create_overlay", "update_overlay", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"];
const phases = ["unapproved-creator", "denied-role", "foreign-resource", "failed-audit", "direct-pro", "direct-free", "owner-free", "agency-pro", "agency-free"];
const cases = phases.flatMap((phase) => names.filter((name) => phase !== "foreign-resource" || !name.startsWith("create_")).map((name) => [name, phase]));
describe("TDD-US2-041 actual per-mutation authority, plan and rollback matrix", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:mutation-authority");
	});
	test.each(cases)("%s respects %s current backend state", (name, phase) => {
		const positive = phase === "direct-pro" || phase === "owner-free" || phase.startsWith("agency-");
		const code = positive ? null : phase === "foreign-resource" ? "RESOURCE_UNAVAILABLE" : phase === "failed-audit" ? "SERVICE_UNAVAILABLE" : "ACCESS_DENIED";
		expect(result.outcomes.find((row: any) => row.name === name && row.phase === phase)).toEqual({ name, phase, status: 200, code, success: positive, changed: positive, leakedData: false });
	});
	test.each(["create_overlay", "create_playlist", "update_overlay", "add_playlist_items"])("%s cannot bypass the creator's current Free limits", (name) => {
		expect(result.outcomes.find((row: any) => row.name === name && row.phase === "paid-boundary")).toEqual({ name, phase: "paid-boundary", status: 200, code: name === "update_overlay" ? "FEATURE_RESTRICTED" : "PLAN_LIMIT_REACHED", success: false, changed: false, leakedData: false });
	});
	test("provider access is confined to eligible append and rollback/limit cases", () => {
		expect(result.providerCalls).toBe(6);
		expect(result.outcomes).toHaveLength(83);
	});
});
