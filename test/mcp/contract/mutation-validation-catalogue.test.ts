/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
const verbs = ["create_overlay", "update_overlay_settings", "delete_overlay", "create_playlist", "update_playlist", "delete_playlist", "add_playlist_items", "remove_playlist_items", "reorder_playlist_items"];
const classes = ["unknown-field", "invalid-identifier", "wrong-type", "out-of-range"];

describe("all mutation validation catalogue through the authenticated public route", () => {
	let result: any;
	beforeAll(() => {
		result = flowProbe("catalogue:mutation-validation");
	});
	test("the actual approved resource can be read before negative mutation cases", () => {
		expect(result.control).toEqual({ status: 200, name: "Validation overlay" });
	});
	test.each(verbs.flatMap((name) => classes.map((boundary) => [name, boundary])))("%s rejects %s without partial persistence", (name, boundary) => {
		expect(result.outcomes.find((row: any) => row.name === name && row.boundary === boundary)).toEqual({ name, boundary, status: 200, code: "INVALID_INPUT", isError: true, unchanged: true });
	});
	test.each([
		["remove_playlist_items", "unknown-item"],
		["remove_playlist_items", "mixed-known-unknown"],
		["remove_playlist_items", "duplicate-item"],
		["reorder_playlist_items", "missing-item"],
		["reorder_playlist_items", "extra-item"],
		["reorder_playlist_items", "replaced-item"],
		["reorder_playlist_items", "duplicate-item"],
	])("%s rejects %s without changing membership or order", (name, boundary) => {
		expect(result.itemOutcomes.find((row: any) => row.name === name && row.boundary === boundary)).toEqual({ name, boundary, status: 200, code: "INVALID_INPUT", isError: true, unchanged: true });
	});
});
