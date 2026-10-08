import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let catalogue: any;
let tool: string;
When("an authorized MCP client reads all pages of {word}", async ({}, name: string) => {
	tool = name;
	catalogue ??= flowProbe("catalogue:pagination");
});
Then("the pages preserve stable order, bounded sizes and safe resource metadata", async () => {
	const row = catalogue.outcomes.find((value: any) => value.name === tool);
	const ids = row.pages.flatMap((page: any) => page.ids);
	expect(ids).toEqual(row.expected);
	expect(new Set(ids).size).toBe(ids.length);
	expect(row.pages.every((page: any) => page.ids.length <= 25 && page.safe)).toBe(true);
	expect(row.pages.at(-1).cursor).toBeNull();
	for (const limit of [1, 100]) {
		const boundary = catalogue.boundaries.find((value: any) => value.name === tool && value.limit === limit);
		expect(boundary.first.result.items).toHaveLength(limit);
		expect(boundary.first.safe).toBe(true);
	}
});
Then("malformed, tampered, expired and other-grant cursors cannot read another page", async () => {
	for (const mode of ["malformed", "tampered", "expired", "other-grant"]) expect(catalogue.invalid.find((row: any) => row.name === tool && row.mode === mode)).toMatchObject({ error: "INVALID_INPUT", safe: true });
	if (tool !== "list_creators") {
		for (const mode of ["other-tool", "other-creator"]) expect(catalogue.invalid.find((row: any) => row.name === tool && row.mode === mode)).toMatchObject({ error: "INVALID_INPUT", safe: true });
	}
});
