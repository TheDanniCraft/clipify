import { createBdd } from "playwright-bdd";
import type { Route } from "@playwright/test";
import { createHash } from "node:crypto";
import { test, expect } from "../support/mcp-support";
import { registerBrowserClient } from "../../support/mcp/browser-registration";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
async function callTool(request: any, state: any, name: string, arguments_: Record<string, unknown>) {
	const response = await request.post(`${origin}/mcp`, { headers: { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", Authorization: `Bearer ${state.token}` }, data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: arguments_ } } });
	expect(response.status()).toBe(200);
	const text = await response.text();
	const payload =
		text.startsWith("event:") || text.startsWith("data:")
			? text
					.split("\n")
					.find((line: string) => line.startsWith("data:"))
					?.slice(5)
					.trim()
			: text;
	expect(payload).toBeTruthy();
	return JSON.parse(payload!).result?.structuredContent;
}
async function connectBrowserPlaylist({ page, request, mcpWorld, withProviderCredentials, withPlaylistItems, requestedScopes }: any) {
	// This journey includes OAuth, privacy-choice reload and multiple real pages.
	// Individual backend deadline contracts remain in their native owning suites.
	test.info().setTimeout(180000);
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withPlaylist: true, withProviderCredentials: withProviderCredentials === true, withPlaylistItems: withPlaylistItems === true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	expect(owner.fixture.playlistId).toBeTruthy();
	const state: any = { owner };
	mcpWorld.input = { browserRevisionState: state };
	await page.context().addCookies([owner.cookie]);
	const registered = await registerBrowserClient(request, origin, { client_name: "Browser playlist revision", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
	expect(registered.status()).toBe(201);
	const client = await registered.json();
	const verifier = "browser-playlist-revision-proof-at-least-43-characters-12345";
	const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: requestedScopes ?? "creator:read playlist:read playlist:update", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${origin}/mcp`, state: "browser-playlist-revision" });
	await page.route("http://127.0.0.1:49999/callback**", (route: Route) => route.fulfill({ contentType: "text/html", body: "Connection approved" }));
	await page.goto(`${origin}/api/auth/oauth2/authorize?${query}`);
	await expect(page.getByRole("heading", { name: "Connect Browser playlist revision" })).toBeVisible();
	const support = page.getByRole("button", { name: "Enable support chat", exact: true });
	await support.focus();
	await support.press("Enter");
	const reject = page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	await Promise.all([page.waitForEvent("load"), reject.click()]);
	await expect(page.getByRole("heading", { name: "Connect Browser playlist revision" })).toBeVisible();
	await page.getByRole("button", { name: owner.fixture.username, exact: true }).focus();
	await page.getByRole("button", { name: owner.fixture.username, exact: true }).press("Space");
	await page.getByRole("radiogroup", { name: "General permissions" }).getByRole("radio", { name: "Write", exact: true }).click();
	await page.getByRole("button", { name: "Review", exact: true }).click();
	await page.getByRole("button", { name: "Authorize", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Authorization successful", exact: true })).toBeVisible();
	await page.getByRole("link", { name: "Continue to Browser playlist revision", exact: true }).click();
	await page.waitForURL("http://127.0.0.1:49999/callback**");
	const code = new URL(page.url()).searchParams.get("code");
	expect(code).toBeTruthy();
	const token = await request.post(`${origin}/api/auth/oauth2/token`, { form: { grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: code!, code_verifier: verifier, resource: `${origin}/mcp` } });
	expect(token.status()).toBe(200);
	state.token = (await token.json()).access_token;
	const read = await callTool(request, state, "get_playlist", { creatorId: owner.fixture.creatorId, playlistId: owner.fixture.playlistId });
	expect(read.playlist.configurationRevision).toBe(1);
	if (withPlaylistItems === true) expect(read.items.map((item: any) => item.id)).toEqual(["ClipFirst", "ClipSecond"]);
	state.revision = read.playlist.configurationRevision;
	await page.goto(`${origin}/dashboard/playlist/${owner.fixture.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Browser playlist", { timeout: 30000 });
}
Given("a browser and MCP client have read the same owned playlist", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld });
});

When("the browser renames and saves that playlist", async ({ page }) => {
	await page.getByPlaceholder("Playlist name").fill("Browser saved name");
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
});
Then("the MCP edit with its old revision conflicts and preserves the browser name", async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "update_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId, name: "Stale MCP overwrite", expectedRevision: state.revision });
	expect(result.error?.code).toBe("CONFLICT");
	const current = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(current.playlist).toMatchObject({ name: "Browser saved name", configurationRevision: 2 });
});

When("the MCP client renames that playlist first", async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "update_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId, name: "MCP saved name", expectedRevision: state.revision });
	expect(result.error).toBeUndefined();
	expect(result.playlist).toMatchObject({ name: "MCP saved name", configurationRevision: 2 });
});
When("the browser tries to save its stale playlist name", async ({ page }) => {
	await page.getByPlaceholder("Playlist name").fill("Stale browser overwrite");
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
});
Then("the browser receives reload guidance and preserves the MCP name", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Playlist changed or access was updated. Reload and try again.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const current = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(current.playlist).toMatchObject({ name: "MCP saved name", configurationRevision: 2 });
});

Given("a connected AI app has successful and denied playlist activity", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld });
	const state = mcpWorld.input?.browserRevisionState as any;
	const denied = await callTool(request, state, "update_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId, name: "Uncommitted private edit", expectedRevision: 99 });
	expect(denied.error.code).toBe("CONFLICT");
});
When("the creator owner inspects AI app activity in settings", async ({ page }) => {
	await page.goto(`${origin}/dashboard/settings`);
	await expect(page.getByRole("heading", { name: "AI app activity", exact: true })).toBeVisible();
});
Then("the activity shows safe actor app creator operation time and outcome", async ({ page, mcpWorld }) => {
	const panel = page.getByRole("region", { name: "AI app activity" });
	const state = mcpWorld.input?.browserRevisionState as any;
	await expect(panel.getByText("Read playlist", { exact: true })).toBeVisible();
	await expect(panel.getByText("Rename playlist", { exact: true })).toBeVisible();
	await expect(panel.getByText("Completed", { exact: true })).toBeVisible();
	await expect(panel.getByText("Blocked", { exact: true })).toBeVisible();
	await expect(panel.getByText("Clipify E2E Owner", { exact: true }).first()).toBeVisible();
	await expect(panel.getByText("Browser playlist revision", { exact: true }).first()).toBeVisible();
	await expect(panel.getByRole("grid", { name: "AI app activity log" }).getByText(state.owner.fixture.username, { exact: true }).first()).toBeVisible();
	expect(await panel.locator("time").count()).toBe(2);
	expect(await panel.textContent()).not.toContain("Uncommitted private edit");
	await panel.scrollIntoViewIfNeeded();
	for (let index = 0; index < 10; index++) await callTool(page.request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	await panel.getByRole("button", { name: "Refresh activity", exact: true }).click();
	await expect(panel.locator("time")).toHaveCount(12);
	const scrollContainer = panel.locator('[data-slot="table-scroll-container"]');
	const header = panel.locator('[data-slot="table-header"]');
	const headerTop = (await header.boundingBox())!.y;
	await scrollContainer.evaluate((element) => {
		element.scrollTop = 150;
	});
	expect(await scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect.poll(async () => Math.abs((await header.boundingBox())!.y - headerTop)).toBeLessThan(2);
	await panel.screenshot({ path: "test-results/mcp/activity-settings-desktop.png" });
	await page.setViewportSize({ width: 390, height: 844 });
	await panel.scrollIntoViewIfNeeded();
	expect(await panel.evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
	await panel.screenshot({ path: "test-results/mcp/activity-settings-mobile.png" });
	await page.locator("[aria-labelledby=connected-apps-title]").screenshot({ path: "test-results/mcp/connections-settings-mobile.png" });
});
Given("the browser dashboard has read a playlist deletion revision", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld, withProviderCredentials: true });
	await page.goto(`${origin}/dashboard`);
	await page.getByText("E2E continuity overlay", { exact: true }).waitFor({ state: "visible" });
	await page.getByRole("tab", { name: "Playlists", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Playlists", exact: true })).toHaveAttribute("aria-selected", "true");
	await page.getByText("Browser playlist", { exact: true }).waitFor({ state: "visible" });
	await expect(page.getByText("Browser playlist", { exact: true })).toBeVisible();
});
When("the browser confirms deletion of its cached playlist", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Delete Browser playlist", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Delete Browser playlist", exact: true }).click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();
});
Then("the deleted playlist is unavailable through MCP", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Playlist deleted", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(result.error.code).toBe("RESOURCE_UNAVAILABLE");
});
Then("the stale browser deletion is blocked and the MCP rename remains", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Playlist changed or access was updated. Reload and try again.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(result.playlist).toMatchObject({ name: "MCP saved name", configurationRevision: 2 });
});
AfterScenario({ tags: "@browser-playlist-revision" }, async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	if (!state?.owner?.fixture) return;
	if (state.foreignOwner?.fixture) {
		const foreign = state.foreignOwner.fixture;
		const removed = await request.delete(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: foreign.authUserId, creatorId: foreign.creatorId, organizationIds: [foreign.creatorOrganizationId, foreign.agencyOrganizationId] } });
		expect(removed.status()).toBe(204);
	}
	const owner = state.owner.fixture;
	const cleanup = await request.delete(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.authUserId, creatorId: owner.creatorId, organizationIds: [owner.creatorOrganizationId, owner.agencyOrganizationId] } });
	expect(cleanup.status()).toBe(204);
});

Given("the browser and MCP have read a populated playlist", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld, withPlaylistItems: true });
	await expect(page.getByText("ClipFirst", { exact: true })).toBeVisible();
});
When("the browser removes its cached clips and saves", async ({ page }) => {
	await page.getByRole("button", { name: "Select all", exact: true }).click();
	await page.getByRole("button", { name: "Remove selected (2)", exact: true }).click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
});
Then("the cleared playlist has its next revision through MCP", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const current = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(current.playlist.configurationRevision).toBe(2);
	expect(current.items).toEqual([]);
});
Then("the stale browser clip save preserves the MCP playlist and its clips", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Playlist changed or access was updated. Reload and try again.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const current = await callTool(request, state, "get_playlist", { creatorId: state.owner.fixture.creatorId, playlistId: state.owner.fixture.playlistId });
	expect(current.playlist).toMatchObject({ configurationRevision: 2, name: "MCP saved name" });
	expect(current.items.map((item: any) => item.id)).toEqual(["ClipFirst", "ClipSecond"]);
});

Given("the browser dashboard has read an overlay deletion revision", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld, withProviderCredentials: true, requestedScopes: "creator:read playlist:read overlay:read overlay:update" });
	await page.goto(`${origin}/dashboard`);
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible();
});
When("the browser confirms deletion of its cached overlay", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Delete E2E continuity overlay", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Delete E2E continuity overlay", exact: true }).click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();
});
When("the MCP client renames the cached overlay first", async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "update_overlay_settings", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId, expectedRevision: 1, patch: { name: "Remote overlay edit" } });
	expect(result).toMatchObject({ overlayId: state.owner.fixture.overlayId, configurationRevision: 2, settings: { name: "Remote overlay edit" } });
});
Then("the deleted overlay is unavailable through MCP", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Successfully deleted", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "get_overlay", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId });
	expect(result.error?.code).toBe("RESOURCE_UNAVAILABLE");
});
Then("the stale overlay deletion preserves the MCP edit", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Overlay changed or access was updated. Reload and try again.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const result = await callTool(request, state, "get_overlay", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId });
	expect(result.overlay).toMatchObject({ name: "Remote overlay edit", configurationRevision: 2 });
});

Given("the browser overlay editor has read its configuration", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld, withProviderCredentials: true, requestedScopes: "creator:read playlist:read overlay:read overlay:update" });
	const state = mcpWorld.input?.browserRevisionState as any;
	await page.goto(`${origin}/dashboard/overlay/${state.owner.fixture.overlayId}`);
	await expect(page.getByRole("textbox", { name: /^Overlay Name\*?$/ })).toHaveValue("E2E continuity overlay");
});
When("the browser saves a new overlay name", async ({ page }) => {
	await page.getByRole("textbox", { name: /^Overlay Name\*?$/ }).fill("Browser overlay saved");
	await expect(page.getByRole("textbox", { name: /^Overlay Name\*?$/ })).toHaveValue("Browser overlay saved");
	await expect(page.getByRole("button", { name: "Save Overlay Settings", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
});
Then("MCP observes the browser overlay name at the next revision", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const r = await callTool(request, state, "get_overlay", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId });
	expect(r.overlay).toMatchObject({ name: "Browser overlay saved", configurationRevision: 2 });
});
Then("the stale overlay save preserves the MCP edit", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Overlay changed or access was updated. Reload and try again.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const r = await callTool(request, state, "get_overlay", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId });
	expect(r.overlay).toMatchObject({ name: "Remote overlay edit", configurationRevision: 2 });
});

Given("the browser style editor has read its configuration", async ({ page, request, mcpWorld }) => {
	await connectBrowserPlaylist({ page, request, mcpWorld, withProviderCredentials: true, requestedScopes: "creator:read playlist:read overlay:read overlay:update" });
	const state = mcpWorld.input?.browserRevisionState as any;
	await page.goto(`${origin}/dashboard/overlay/${state.owner.fixture.overlayId}/theme`);
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toBeVisible();
});
When("the browser saves a new overlay text color", async ({ page }) => {
	const field = page.getByRole("textbox", { name: "Text Color", exact: true });
	await field.fill("#123456");
	await field.press("Tab");
	await expect(page.getByRole("button", { name: "Save Style", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Save Style", exact: true }).click();
});
Then("MCP observes the browser style at the next revision", async ({ page, request, mcpWorld }) => {
	await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.browserRevisionState as any;
	const r = await callTool(request, state, "get_overlay", { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId });
	expect(r.overlay).toMatchObject({ configurationRevision: 2, themeTextColor: "#123456" });
});

When("a different creator inspects AI app activity in settings", async ({ page, request, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: {} });
	expect(response.status()).toBe(200);
	state.foreignOwner = await response.json();
	await page.context().clearCookies();
	await page.context().addCookies([state.foreignOwner.cookie]);
	await page.goto(`${origin}/dashboard/settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
});
Then("the owner's creator and AI app activity are unavailable to that creator", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.browserRevisionState as any;
	const panel = page.getByRole("region", { name: "AI app activity" });
	await expect(panel.getByText("No activity yet", { exact: true })).toBeVisible({ timeout: 30000 });
	await expect(panel.getByText("Read playlist", { exact: true })).toHaveCount(0);
	await expect(panel.getByText("Rename playlist", { exact: true })).toHaveCount(0);
	await expect(panel.getByText("Browser playlist revision", { exact: true })).toHaveCount(0);
	expect(await panel.textContent()).not.toContain(state.owner.fixture.username);
	await panel.getByRole("button", { name: /Creator/ }).click();
	await expect(page.getByRole("option", { name: state.owner.fixture.username, exact: true })).toHaveCount(0);
});

When("the browser commits the exact overlay text color ABCDEF", async ({ page }) => {
	const field = page.getByRole("textbox", { name: "Text Color", exact: true });
	await field.fill("#ABCDEF");
	await field.press("Tab");
	await page.getByRole("button", { name: "Pick Text Color", exact: true }).click();
	await page.keyboard.press("Escape");
});
Then("the recent theme palette preserves its exact RGB channels", async ({ page }) => {
	const colors = await page.evaluate(() => JSON.parse(window.localStorage.getItem("clipify:overlay-theme-recent-colors") ?? "[]"));
	expect(colors[0]).toBe("rgba(171, 205, 239, 1)");
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toHaveValue(/^#abcdef$/i);
});
