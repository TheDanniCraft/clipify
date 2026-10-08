import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { flowProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd();
let catalogue: any;
let row: any;
When("the public MCP create retry is {word} {word}", async ({}, kind: string, mode: string) => {
	catalogue ??= flowProbe("catalogue:create-retries");
	row = catalogue.outcomes.find((value: any) => value.kind === kind && value.mode === mode);
	expect(row).toBeDefined();
});
Then("the retry returns the original resource with exactly one creation", async () => {
	expect(row.firstError).toBeNull();
	expect(row.secondError).toBeNull();
	expect(row.initialId).toEqual(expect.any(String));
	expect(row.secondId).toBe(row.initialId);
	expect(row.after[row.kind === "overlay" ? "overlays" : "playlists"] - row.before[row.kind === "overlay" ? "overlays" : "playlists"]).toBe(1);
	expect(row.after.retries - row.before.retries).toBe(1);
	expect(row.retained).toBe(true);
	expect(row.safe).toBe(true);
});
Then("the changed retry is rejected and the original resource is preserved", async () => {
	expect(row.firstError).toBeNull();
	expect(row.secondError).toBe("RETRY_CONFLICT");
	expect(row.secondId).toBeNull();
	expect(row.after[row.kind === "overlay" ? "overlays" : "playlists"] - row.before[row.kind === "overlay" ? "overlays" : "playlists"]).toBe(1);
	expect(row.after.retries - row.before.retries).toBe(1);
	expect(row.safe).toBe(true);
});
