import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let resource: string;
let approved: boolean;
let result: any;
let discovery: any;
const results = new Map<string, any>();
Given(/^(overlay|playlist) belongs to an accessible creator and the client has (explicit overlay delete permission|explicit playlist delete permission|read\/edit without delete permission)$/, async ({}, kind: string, permission: string) => {
	resource = kind;
	approved = permission.startsWith("explicit");
});
When(/^(a client that confirms destructive calls|a client that ignores destructive hints|a custom client that ignores destructive hints) calls its accurately annotated destructive deletion tool$/, async ({}, _profile: string) => {
	// Controlled local profiles; this is not evidence of a named vendor's prompt UI.
	discovery ??= flowProbe("catalogue:tool-results").discovery;
	expect(discovery.annotations.find((row: any) => row.name === `delete_${resource}`).annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false });
	const mode = `resources:${resource}-delete${approved ? "" : ":no-scope"}`;
	if (!results.has(mode)) results.set(mode, flowProbe(mode));
	result = results.get(mode);
});
Then("deletion succeeds without a dashboard confirmation", async () => {
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult?.deletedId).toEqual(expect.any(String));
	if (resource === "overlay") expect(result.resourceCount).toBe(0);
	else expect(result.deletionState).toMatchObject({ playlists: 0, items: 0, overlay: { playlist_id: null, configuration_revision: 2 }, gallery: { playlist_id: null, published: false } });
});
Then("deletion is denied without changing state", async () => {
	expect(result.protocolStatus).toBe(403);
	expect(result.challenge).toContain("insufficient_scope");
	if (resource === "overlay") expect(result.resourceCount).toBe(1);
	else expect(result.deletionState).toMatchObject({ playlists: 1, items: 2, overlay: { configuration_revision: 1 }, gallery: { published: true } });
});
