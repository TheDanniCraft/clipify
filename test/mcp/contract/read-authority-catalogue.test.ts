/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
const readAuthorityTools = ["list_creators", "get_capabilities", "list_overlays", "get_overlay", "list_playlists", "get_playlist"];
const readAuthorityPhases = ["owner-pro", "owner-free", "direct-pro", "direct-free", "denied-role", "custom-direct", "agency-pro", "agency-free", "agency-ceiling", "agency-inactive", "agency-custom-role", "creator-suspended", "creator-disabled"];
const deniedPhases = ["direct-free", "denied-role", "agency-inactive", "creator-suspended", "creator-disabled"];
const cases: [string, string, string | null, boolean][] = readAuthorityPhases.flatMap((phase) =>
	readAuthorityTools.map((name): [string, string, string | null, boolean] => {
		const denied = deniedPhases.includes(phase) || (["custom-direct", "agency-ceiling"].includes(phase) && ["list_playlists", "get_playlist"].includes(name)) || (phase === "agency-custom-role" && ["list_overlays", "get_overlay"].includes(name));
		return [name, phase, denied && name !== "list_creators" ? "ACCESS_DENIED" : null, denied && name === "list_creators"];
	}),
);
for (const phase of ["unapproved-creator", "missing-context", "malformed-context"]) {
	for (const name of readAuthorityTools.filter((tool) => tool !== "list_creators")) cases.push([name, phase, phase === "unapproved-creator" ? "ACCESS_DENIED" : "INVALID_INPUT", false]);
}
for (const name of ["get_overlay", "get_playlist"]) cases.push([name, "foreign-resource", "RESOURCE_UNAVAILABLE", false]);
for (const name of readAuthorityTools) cases.push([name, "empty-selection", name === "list_creators" ? null : "ACCESS_DENIED", name === "list_creators"]);
for (const name of ["create_overlay", "update_overlay_settings", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"]) cases.push([name, "agency-ceiling-write", "ACCESS_DENIED", false]);
describe("TDD-READ-AUTHORITY-001 current read permission, path and creator boundaries", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:read-authority");
	});
	test.each(cases)("%s respects %s without secret payloads or persistence changes", (name, phase, code, filtered) => {
		expect(result.outcomes.find((row: any) => row.name === name && row.phase === phase)).toEqual({ name, phase, status: 200, code, filtered, changed: false, leakedData: false });
	});
	test("executes the complete explicit catalogue", () => {
		expect(result.outcomes).toHaveLength(cases.length);
		expect(cases).toHaveLength(110);
	});
});
