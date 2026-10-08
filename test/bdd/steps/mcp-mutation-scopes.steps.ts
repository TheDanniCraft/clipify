import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let selected: { name: string; permission: string };
let result: any;
Given("the valid token lacks {string} for {string}", async ({}, permission: string, name: string) => {
	selected = { name, permission };
});

let readResult: any;
const isRead = () => selected.name.startsWith("list_") || selected.name.startsWith("get_");
When("the authenticated client attempts the affected operation without its scope", async () => {
	if (isRead()) readResult ??= flowProbe("catalogue:read-scopes");
	else result ??= flowProbe("catalogue:mutation-scopes");
});
Then("the missing scope is rejected before inputs or resources are processed", async () => {
	const current = isRead() ? readResult : result;
	expect(current.outcomes).toHaveLength(isRead() ? 6 : 9);
	expect(current.outcomes.find((row: any) => row.name === selected.name)).toEqual({
		...selected,
		status: 403,
		insufficientScope: true,
		counts: { overlays: isRead() ? 1 : 0, playlists: isRead() ? 1 : 0, retries: 0, effects: 0 },
		...(isRead() ? { leakedData: false } : {}),
	});
});
