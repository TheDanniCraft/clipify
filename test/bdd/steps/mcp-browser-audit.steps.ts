import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("a shared browser playlist mutation is {word}", async ({ mcpWorld }, mode: string) => {
	mcpWorld.input = { mode };
});
When("its verified session mutation completes", async ({ mcpWorld }) => {
	mcpWorld.result = runMcpProbe("browser-playlist-delete-probe", [String(mcpWorld.input?.mode)]);
});
Then("its audit is {word} for the verified browser session", async ({ mcpWorld }, action: string) => {
	const result = mcpWorld.result as any;
	expect(result.deleted).toBe(true);
	expect(result.activity).toHaveLength(1);
	expect(result.activity[0]).toMatchObject({ action, actor_user_id: "owner", actor_session_id: result.sessionId });
	expect(result.activity[0].metadata.clientId).toBeUndefined();
	expect(result.activity[0].metadata.grantId).toBeUndefined();
});

Then("the browser item order is committed at the next revision", async ({ mcpWorld }) => {
	const result = mcpWorld.result as any;
	expect(result.deleted).toMatchObject({ playlist: { configurationRevision: 2 }, items: [{ id: "ClipFirst", position: 0 }] });
	expect(result.activity[0]).toMatchObject({ action: "playlist.items.reorder", actor_session_id: result.sessionId });
});
Then("the browser item order remains unchanged", async ({ mcpWorld }) => {
	const result = mcpWorld.result as any;
	expect(result.deleted).toBeNull();
	expect(result.revision).toBe(1);
	expect(result.state.items).toBe(1);
	expect(result.activity).toEqual([]);
});

Then("the browser clip edit commits once", async ({ mcpWorld }) => {
	const result = mcpWorld.result as any;
	expect(result.deleted).toMatchObject({ configurationRevision: 2 });
	expect(result.revision).toBe(2);
	expect(result.activity).toHaveLength(1);
	expect(result.activity[0]).toMatchObject({ action: "playlist.items.save", actor_session_id: result.sessionId });
});
Then("the browser clip edit is not committed", async ({ mcpWorld }) => {
	const result = mcpWorld.result as any;
	expect(result.deleted).toBeNull();
	expect(result.state.items).toBe(mcpWorld.input?.mode === "items-limit" ? 50 : 1);
	expect(result.activity).toEqual([]);
});

Then("the Pro import is committed with its browser audit", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toMatchObject({ configurationRevision: 2 });
	expect(r.activity[0]).toMatchObject({ action: "playlist.items.import", actor_session_id: r.sessionId });
});

Then("the browser overlay is deleted with verified session attribution", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toBe(true);
	expect(r.overlayCount).toBe(0);
	expect(r.activity[0]).toMatchObject({ action: "overlay.delete", actor_session_id: r.sessionId });
});
Then("the browser overlay deletion is refused", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toBe(false);
	expect(r.overlayCount).toBe(1);
	expect(r.activity).toEqual([]);
});

Then("the browser overlay edit commits at its next revision", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toMatchObject({ configurationRevision: 2 });
	expect(r.storedOverlay.configuration_revision).toBe(2);
	expect(r.activity[0]).toMatchObject({ action: "overlay.update", actor_session_id: r.sessionId });
});
Then("the browser overlay edit is refused", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toBeNull();
	expect(r.storedOverlay.configuration_revision).toBe(1);
	expect(r.activity).toEqual([]);
});

Then("the stored overlay configuration is normalized for {word}", async ({ mcpWorld }, mode: string) => {
	const r = mcpWorld.result as any;
	expect(r.storedOverlay).toMatchObject(mode === "font" ? { theme_font_family: "inherit" } : mode === "color" ? { theme_text_color: "#FFFFFF" } : { type: "Featured", playback_mode: "random", playlist_id: null });
	expect(r.deleted).toMatchObject({ configurationRevision: 2 });
});

Then("the browser selected reward is committed", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.deleted).toMatchObject({ configurationRevision: 2, rewardId: "RewardOne" });
	expect(r.storedOverlay.reward_id).toBe("RewardOne");
});

Then("all overlay volumes and revisions are committed", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	if (!String(mcpWorld.input?.mode).startsWith("volume-public")) expect(r.deleted).toBe(73);
	expect(r.volumeRows).toEqual([
		{ player_volume: 73, configuration_revision: 2 },
		{ player_volume: 73, configuration_revision: 2 },
	]);
	expect(r.volumeActivity).toHaveLength(2);
});
Then("no overlay volume or revision change is committed", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	if (!String(mcpWorld.input?.mode).startsWith("volume-public")) expect(r.deleted).toBeNull();
	expect(r.volumeRows.every((row: any) => row.player_volume === 50)).toBe(true);
	expect(r.volumeActivity).toEqual([]);
});
