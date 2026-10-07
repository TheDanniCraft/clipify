import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let result: any;
let selected: { name: string; boundary: string };
const operations: Record<string, string> = { "create overlay": "create_overlay", "update overlay": "update_overlay", "delete overlay": "delete_overlay", "create playlist": "create_playlist", "update playlist": "update_playlist", "delete playlist": "delete_playlist", "add playlist items": "add_playlist_items", "remove playlist items": "remove_playlist_items", "reorder playlist items": "reorder_playlist_items" };
for (const [phrase, boundary] of [
	["an unknown input field", "unknown-field"],
	["an invalid identifier", "invalid-identifier"],
	["a wrong field type", "wrong-type"],
	["an out-of-range value", "out-of-range"],
]) {
	Given(new RegExp(`^a (.+) request includes ${phrase}$`), async ({}, operation: string) => {
		selected = { name: operations[operation], boundary };
		expect(selected.name).toBeTruthy();
	});
}
When(/^the client submits (?!the mutation$)(.+)$/, async ({}, operation: string) => {
	expect(operations[operation]).toBe(selected.name);
	// One immutable denial journey supplies every explicit example in this worker.
	// Every request and post-call database snapshot is executed by the actual probe.
	result ??= flowProbe("catalogue:mutation-validation");
});
Given("the request includes an invalid playlist item reference", async () => {
	selected = { name: "remove_playlist_items", boundary: "item-reference-catalogue" };
});
Given("the request includes a non-permutation playlist reorder", async () => {
	selected = { name: "reorder_playlist_items", boundary: "item-reference-catalogue" };
});
When("the client submits the mutation", async () => {
	result ??= flowProbe("catalogue:mutation-validation");
});
Then("an invalid-input error is returned and no partial change occurs", async () => {
	expect(result.control).toEqual({ status: 200, name: "Validation overlay" });
	expect(result.outcomes).toHaveLength(36);
	if (selected.boundary === "item-reference-catalogue") {
		const rows = result.itemOutcomes.filter((row: any) => row.name === selected.name);
		expect(rows).toHaveLength(selected.name === "remove_playlist_items" ? 3 : 4);
		for (const row of rows) expect(row).toMatchObject({ status: 200, code: "INVALID_INPUT", isError: true, unchanged: true });
		return;
	}
	expect(result.outcomes.find((row: any) => row.name === selected.name && row.boundary === selected.boundary)).toEqual({ ...selected, status: 200, code: "INVALID_INPUT", isError: true, unchanged: true });
});
