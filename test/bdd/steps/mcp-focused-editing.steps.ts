import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "../support/mcp-support";
const { Given, When, Then } = createBdd(test);
import { flowProbe } from "../../support/mcp/probe";

Given("an AI app is authorized to edit an overlay theme", async ({ mcpWorld }) => {
	mcpWorld.input = {};
});
When("it changes only the overlay text color", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:update_overlay_theme:success") };
});
Then("the theme revision advances and the overlay name, filters and playback remain unchanged", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result.structuredContent).toMatchObject({ configurationRevision: 2, theme: { themeTextColor: "#abcdef" } });
	expect(row.storedOverlay).toMatchObject({ name: "Workflow overlay", player_volume: 50, min_clip_views: 0, configuration_revision: 2 });
});
Given("an AI app is authorized to edit a gallery layout", async ({ mcpWorld }) => {
	mcpWorld.input = {};
});
When("it changes only the gallery layout", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:update_gallery_layout:success") };
});
Then("the layout revision advances and the gallery name and theme remain unchanged", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result.structuredContent).toMatchObject({ configurationRevision: 2, layout: { layout: "list" } });
	expect(row.storedGallery).toMatchObject({ name: "Workflow gallery", layout: "list", accent_color: "#7C3AED", configuration_revision: 2 });
	expect(row.result.structuredContent).not.toHaveProperty("accentColor");
});
When("an AI app submits a cross-area patch to {string}", async ({ mcpWorld }, tool: string) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:${tool}:cross_area`) };
});
Then("the focused tool rejects the patch without changing either resource", async ({ mcpWorld }) => {
	const row = mcpWorld.result?.body;
	expect(row.result.structuredContent.error.code).toBe("INVALID_INPUT");
	expect(row.storedOverlay.configuration_revision).toBe(1);
	expect(row.storedGallery.configuration_revision).toBe(1);
});
