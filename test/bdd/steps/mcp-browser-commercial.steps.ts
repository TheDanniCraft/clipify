import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the browser commercial operation is {string}", async ({}, value: string) => {
	mode = value;
});
When("the verified browser session executes its commercial operation", async () => {
	result = runMcpProbe("browser-playlist-delete-probe", [`commercial:${mode}`]).commercialObservation;
});
Then("the browser update is denied and retained saved data is unchanged", async () => {
	expect(result).toEqual({ saved: false, unchanged: true });
});
Then("the browser creates a second overlay while actor personal plan remains Free", async () => {
	expect(result).toEqual({ created: true, error: null, resources: 2, actorPersonalPlan: "free" });
});
Then("the retained browser overlay is readable with its saved accent and unchanged data", async () => {
	expect(result).toEqual({ available: true, savedAccent: "#123456", unchanged: true });
});
Then("retained overlay activation and runtime are denied with unchanged data", async () => {
	expect(result).toEqual({ saved: false, runtimeAllowed: false, unchanged: true });
});
Then("the retained browser playlist keeps its readable saved clip and unchanged data", async () => {
	expect(result).toEqual({ clipIds: ["RetainedClip"], unchanged: true });
});
Then("browser playlist selection remains saved but runtime excludes retained clips", async () => {
	expect(result).toEqual({ saved: true, runtimeClips: 0, effectivePlaylistId: null, storedRetainedSelection: true, unchanged: true });
});
