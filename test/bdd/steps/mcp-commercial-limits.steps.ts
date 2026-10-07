import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("the creator has Pro through {string} while the actor personal creator is Free", async ({ mcpWorld }, source: string) => {
	expect(["subscription", "trial", "grant", "allocation"]).toContain(source);
	mcpWorld.input = { mode: `resources:overlay-create:entitlement-${source}` };
});
When("the MCP client requests another overlay for that creator", async ({ mcpWorld }) => {
	const result = flowProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the second overlay follows creator entitlement source {string} and replays safely", async ({ mcpWorld }, source: string) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.commercialObservation).toEqual({ actorPersonalPlan: "free", ownerEffectivePlan: "pro", ownerEntitlementSource: source });
	expect(result.resourceResult.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent overlay", configurationRevision: 1 });
	expect(result.resourceResult.replayed).toEqual(result.resourceResult.created);
	expect(result.resourceCount).toBe(2);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
});

Given("a Free creator has saved overlay settings before a {string} change", async ({ mcpWorld }, mode: string) => {
	expect(["free", "free-filter", "free-styling"]).toContain(mode);
	mcpWorld.input = { mode: `resources:overlay-update:${mode}` };
});
When("the MCP client requests the paid settings change", async ({ mcpWorld }) => {
	const result = flowProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the paid settings error preserves the overlay name volume and revision", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(result.persistedOverlay).toEqual({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
});

Given("a Free creator has one existing overlay before an MCP create", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:overlay-create:limit-one" };
});
When("the MCP client requests a second overlay", async ({ mcpWorld }) => {
	const result = flowProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the quota error reports one used overlay and a limit of one without changing saved data", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceCount).toBe(1);
	expect(result.quotaStateChanged).toBe(false);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
});

Given("the actor personal creator is Pro while the target creator is Free with one overlay", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:overlay-create:entitlement-inverse-actor" };
});
Then("actor Pro does not bypass the target creator quota or create an overlay on retry", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.commercialObservation).toMatchObject({ actorPersonalPlan: "pro", ownerEffectivePlan: "free" });
	expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceCount).toBe(1);
});

Given("a verified creator owner already has the one Free overlay", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "overlay-create-quota-feedback" };
});
When("the browser owner requests another overlay through backend creation", async ({ mcpWorld }) => {
	const result = runMcpProbe("browser-playlist-delete-probe", [String(mcpWorld.input?.mode)]);
	mcpWorld.result = { status: 200, body: result };
});
Then("the browser receives one used overlay and limit one without another saved overlay", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.creationFeedbackAvailable).toBe(true);
	expect(result.creationFeedback).toEqual({ overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 } });
	expect(result.overlayCount).toBe(1);
});

Given("creator entitlement state is {string} with one existing overlay", async ({ mcpWorld }, source: string) => {
	expect(["trial-expired", "grant-expired", "grant-future", "grant-revoked", "allocation-expired", "allocation-future", "allocation-removal-active"]).toContain(source);
	mcpWorld.input = { mode: `resources:overlay-create:entitlement-${source}` };
});
Then("inactive creator entitlement keeps usage one and limit one on initial request and retry", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.commercialObservation).toMatchObject({ actorPersonalPlan: "free", ownerEffectivePlan: "free" });
	expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
	expect(result.resourceCount).toBe(1);
});

Given("a downgraded creator retains an overlay outside the Free allowance", async ({ mcpWorld }) => {
	mcpWorld.input = { retainedCreator: true };
});
When("the MCP client reads that retained overlay", async ({ mcpWorld }) => {
	const result = flowProbe("resources:overlay-get:retained");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the retained overlay remains readable with its saved paid settings intact", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.overlay).toMatchObject({ id: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6", name: "Retained paid overlay", playerVolume: 83, themeAccentColor: "#123456", configurationRevision: 1 });
	expect(result.retainedStateUnchanged).toBe(true);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-retained-secret|secret|token/);
});
When("the MCP client changes that retained overlay", async ({ mcpWorld }) => {
	const result = flowProbe("resources:overlay-update:retained");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the retained update is denied without clearing its saved paid settings", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.status).toBe(200);
	expect(mcpWorld.result?.body.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(mcpWorld.result?.body.retainedStateUnchanged).toBe(true);
});

When("the MCP client attempts to activate the retained overlay", async ({ mcpWorld }) => {
	const result = flowProbe("resources:overlay-update:retained-run");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("activation is denied and existing overlay runtime policy keeps it unavailable", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(result.retainedStateUnchanged).toBe(true);
	expect(result.retainedRuntimeObservation).toEqual({ allowed: false, reason: "plan-restricted", primaryAllowed: true, effectivePlaylistId: null });
});
Given("a downgraded creator retains a playlist outside the Free allowance", async ({ mcpWorld }) => {
	mcpWorld.input = { retainedPlaylist: true };
});
When("the MCP client reads the retained playlist", async ({ mcpWorld }) => {
	const result = flowProbe("resources:playlist-get:retained");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("saved playlist metadata and ordered clips remain readable and intact", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.playlist).toMatchObject({ name: "Retained playlist", configurationRevision: 1 });
	expect(result.resourceResult.items).toEqual([{ id: "RetainedClip", position: 0, title: "Saved retained clip", duration: 12 }]);
	expect(result.retainedPlaylistStateUnchanged).toBe(true);
});
When("the MCP client renames the retained playlist", async ({ mcpWorld }) => {
	const result = flowProbe("resources:playlist-update:retained");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the retained playlist change is denied without losing saved clips", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.status).toBe(200);
	expect(mcpWorld.result?.body.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(mcpWorld.result?.body.retainedPlaylistStateUnchanged).toBe(true);
});
When("the MCP client selects that playlist for the active Free overlay", async ({ mcpWorld }) => {
	const result = flowProbe("resources:overlay-update:retained-playlist-run");
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("saved selection remains intact but runtime policy excludes retained playlist clips", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.resourceResult.overlay).toMatchObject({ type: "Playlist", playlistId: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6", configurationRevision: 2 });
	expect(result.retainedPlaylistStateUnchanged).toBe(true);
	expect(result.retainedRuntimeObservation).toEqual({ allowed: true, reason: null, primaryAllowed: true, effectivePlaylistId: null, retainedClipCount: 0, storedPlaylistId: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" });
});

Given("an approved MCP client has connected before {string}", async ({ mcpWorld }, transition: string) => {
	expect(["upgrade", "downgrade", "trial-expiry", "grant-expiry", "team-removal", "agency-unlink", "suspension"]).toContain(transition);
	mcpWorld.input = { mode: `resources:overlay-update:transition-${transition}` };
});
When("the creator authority change commits and the client edits without reconnecting", async ({ mcpWorld }) => {
	const result = flowProbe(String(mcpWorld.input?.mode));
	mcpWorld.result = { status: result.protocolStatus, body: result };
});
Then("the mutation follows current authority for {string} and preserves denied settings", async ({ mcpWorld }, transition: string) => {
	const result = mcpWorld.result?.body;
	expect(mcpWorld.result?.status).toBe(200);
	expect(result.transitionObservation).toEqual({ baselineStatus: 200, baselineOverlayCount: 1, changeCommitted: true, reusedOriginalToken: true });
	if (transition === "upgrade") {
		expect(result.resourceResult.overlay).toMatchObject({ name: "Edited by agent", playerVolume: 70, configurationRevision: 2 });
		expect(result.persistedOverlay).toEqual({ name: "Edited by agent", player_volume: 70, configuration_revision: 2 });
	} else {
		expect(result.resourceResult.error.code).toBe(["downgrade", "trial-expiry", "grant-expiry"].includes(transition) ? "FEATURE_RESTRICTED" : "ACCESS_DENIED");
		expect(result.persistedOverlay).toEqual({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
	}
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
});
