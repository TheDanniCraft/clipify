import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { providerProbe, runMcpProbe } from "../../support/mcp/probe";
import { clientFixture } from "../../support/mcp/fixtures";
import { registerBrowserClient } from "../../support/mcp/browser-registration";
const { Given, When, Then, AfterScenario } = createBdd(test);
Given("a compatible client has no prior Clipify configuration", async ({ mcpWorld }) => {
	mcpWorld.input = {};
});
When("it discovers the service", async ({ mcpWorld }) => {
	mcpWorld.result = providerProbe("metadata");
});
Then("it receives the service and authorization metadata", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.status).toBe(200);
	expect(mcpWorld.result?.body.issuer).toBe("http://127.0.0.1:3107/api/auth");
	const resource = providerProbe("resource");
	expect(resource.status).toBe(200);
	expect(resource.body.resource).toBe("http://127.0.0.1:3107/mcp");
});
Given("a custom client has no Clipify session or assigned credentials", async ({ mcpWorld }) => {
	mcpWorld.input = clientFixture.build();
});
When("it registers valid client metadata", async ({ mcpWorld }) => {
	mcpWorld.result = providerProbe("register", mcpWorld.input);
});
Then("it receives a client identity but cannot read creator data", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.status).toBe(201);
	expect(mcpWorld.result?.body?.client_id).toBeTruthy();
	expect(mcpWorld.result?.body.access_token).toBeUndefined();
});
Given(/^registration metadata contains (.+)$/, async ({ mcpWorld }, invalid: string) => {
	if (invalid.endsWith("JSON root")) {
		mcpWorld.input = { rawMetadata: invalid === "a null JSON root" ? "null" : invalid === "an array JSON root" ? "[]" : "true" };
		return;
	}
	mcpWorld.input = { ...clientFixture.build(), ...(invalid === "an invalid callback" ? { redirect_uris: ["javascript:alert(1)"] } : invalid === "an unsupported scope" ? { scope: "runner-credential:read" } : { grant_types: ["client_credentials"] }) };
});
When("the client registers", async ({ mcpWorld }) => {
	mcpWorld.result = mcpWorld.input?.rawMetadata ? runMcpProbe("provider-probe", ["register", String(mcpWorld.input.rawMetadata)]) : providerProbe("register", mcpWorld.input);
});
Then("registration is rejected and no client record is created", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.status).toBe(400);
	expect(mcpWorld.result?.body?.client_id).toBeUndefined();
});

import { flowProbe } from "../../support/mcp/probe";
Given("a registered client requests read access to a creator the user owns", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "approve" };
});
When("the signed-in user approves those permissions and that creator", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("approve") };
});
Then("the client reads that creator and cannot access an unapproved creator", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body).toMatchObject({ tokenStatus: 200, hasGrant: true, accessibleRead: true, unapprovedDenied: true, approvedCreators: ["fixture-creator"] });
});
Given("the user is shown the client and requested permissions", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "deny" };
});
When("the user denies consent", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("deny") };
});
Then("no grant is issued and no creator data is accessible", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.denied).toBe(true);
	expect(mcpWorld.result?.body.hasGrant).toBeUndefined();
});
Given("an approved authorization code and matching proof exist", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "approve" };
});
Given("missing PKCE proof is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "missing-pkce" };
});
Given("incorrect PKCE proof is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "bad-pkce" };
});
Given("a reused authorization code is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "reuse-code" };
});
Given("a changed callback is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "changed-callback" };
});
When("the client exchanges the code", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("approve") };
});
When("the client exchanges authorization", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(String(mcpWorld.input?.mode)) };
});
Then("expiring access bound to Clipify MCP is issued", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body).toMatchObject({ tokenStatus: 200, hasGrant: true });
	expect(mcpWorld.result?.body.audience).toContain("http://127.0.0.1:3107/mcp");
});
Then("access is rejected without issuing tokens", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.replayStatus ?? result.tokenStatus).toBeGreaterThanOrEqual(400);
});
Given("the consent screen offers Read and Read & edit with individual permissions", async ({ mcpWorld }) => {
	mcpWorld.input = {};
});
When(/^the user selects (.+) and approves the connection$/, async ({ mcpWorld }, selection: string) => {
	mcpWorld.result = { status: 200, body: flowProbe(`selection:${selection}`) };
});
Then(/^the connection grants exactly (.+) and no unselected permission$/, async ({ mcpWorld }, permissions: string) => {
	const expected = ["creator:read", "overlay:read", "playlist:read"];
	if (permissions.includes("creates") || permissions.startsWith("read/edit")) expected.push("overlay:create", "overlay:update", "playlist:create", "playlist:update", "playlist-items:manage");
	else if (permissions.includes("playlist-item management")) expected.push("playlist-items:manage");
	if (permissions.includes("overlay deletion")) expected.push("overlay:delete");
	if (permissions.includes("playlist deletion")) expected.push("playlist:delete");
	if (permissions.includes("overlay and playlist deletion")) expected.push("overlay:delete", "playlist:delete");
	expect(mcpWorld.result?.body.hasGrant).toBe(true);
	expect(mcpWorld.result?.body.scopes.split(" ").sort()).toEqual([...new Set(expected)].sort());
});
Given("the client presents missing access", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "missing-access" };
});
Given("the client presents expired access", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "expired-access" };
});
Given("the client presents an invalid signature", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "bad-signature" };
});
Given("the client presents an incorrect issuer", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "bad-issuer" };
});
Given("the client presents an audience for another service", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "bad-audience" };
});
When("it calls a tool", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`protocol:${mcpWorld.input?.mode}`) };
});
Then("the call is rejected without reading or changing creator data", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.protocolStatus).toBe(401);
	expect(mcpWorld.result?.body.toolRead).toBe(false);
});
Given("a valid refresh grant exists", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "refresh:valid" };
});
Given("the client presents an expired refresh grant", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "refresh:expired" };
});
Given("the client presents a request for wider permissions", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "refresh:widen" };
});
When("the client refreshes access", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(String(mcpWorld.input?.mode)) };
});
Then("renewed access preserves or narrows the approved permissions", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body).toMatchObject({ refreshStatus: 200, sameRefreshGrant: true, refreshScopes: "creator:read overlay:read playlist:read offline_access" });
});
Then("refresh is rejected without widening access", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.refreshStatus).toBeGreaterThanOrEqual(400);
	expect(mcpWorld.result?.body.sameRefreshGrant).toBe(false);
});
Given("two connected clients have separate approved grants", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "connections" };
});
When("the user lists connections and revokes the first", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("connections") };
});
Then("the first client’s old access and refresh are rejected while the second remains usable", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body).toMatchObject({ connectionCount: 2, revokeStatus: 200, revokedAccess: true, revokedRefresh: true, secondUsable: true });
});
Given("an expired authorization code is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "expired-code" };
});
Given("an unregistered callback is presented", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "unregistered-callback" };
});
Given("owned, directly shared, agency-linked, and inaccessible creators exist", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:creators" };
});
When("the client lists creators", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:creators") };
});
Then("only creators permitted by both the grant and current membership appear", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult.items.map((creator: any) => creator.id)).toEqual(["agency-creator", "direct-creator", "fixture-creator"]);
});
Given("the user selects an accessible creator with current usage and grants", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:capabilities:free" };
});
When("the client requests capabilities", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:capabilities:free") };
});
Then("the effective plan, current usage, limits, and eligible operations are reported", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult).toMatchObject({ effectivePlan: "free", usage: { overlays: 1, playlists: 1 }, limits: { overlays: 1, playlists: 1, playlistItems: 50 }, operations: { create_overlay: { allowed: false, reason: "PLAN_LIMIT_REACHED" } } });
});

Given("an approved creator has an existing private overlay", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:overlays" };
});
When("the client lists that creator’s overlays", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(String(mcpWorld.input?.mode ?? "resources:overlays")) };
});
Then("safe overlay configuration and revisions are returned", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult.items).toHaveLength(1);
	expect(mcpWorld.result?.body.resourceResult.items[0]).toMatchObject({ creatorId: "fixture-creator", configurationRevision: 1 });
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toContain("private-overlay-secret");
});

Given('a listed-overlay request has "{word}"', async ({ mcpWorld }, input) => {
	mcpWorld.input = { mode: `resources:overlays:${input}` };
});
Then("the overlay request returns a safe invalid-input result", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.error?.code).toBe("INVALID_INPUT");
	expect(mcpWorld.result?.body.resourceCount).toBe(1);
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toContain("private-input-value");
});

When("the client reads that creator’s overlay", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:overlay-get") };
});
Then("the overlay’s safe configuration and revision are returned", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.overlay).toMatchObject({ creatorId: "fixture-creator", name: "Existing overlay", configurationRevision: 1 });
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toContain("private-overlay-secret");
});

Given("an approved Free creator has no overlays", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:overlay-create" };
});
When("the agent creates an overlay and retries its request", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:overlay-create") };
});
Then("one safe overlay is created and the retry returns the original result", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent overlay", configurationRevision: 1 });
	expect(mcpWorld.result?.body.resourceResult?.replayed).toEqual(mcpWorld.result?.body.resourceResult?.created);
	expect(mcpWorld.result?.body.resourceCount).toBe(1);
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toMatch(/secret|rewardId|token/);
});

When("the agent edits that overlay with its current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:overlay-update") };
});
Then("the safe edited configuration has a new revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.overlay).toMatchObject({ playerVolume: 70, configurationRevision: 2 });
	expect(mcpWorld.result?.body.persistedOverlay).toMatchObject({ name: "Existing overlay", configuration_revision: 2 });
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toContain("private-overlay-secret");
});

Given("an approved creator has an existing playlist", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:playlists" };
});
When("the client lists that creator’s playlists", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlists") };
});
Then("safe playlist summaries and revisions are returned", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.items).toEqual([expect.objectContaining({ creatorId: "fixture-creator", name: "Existing playlist", configurationRevision: 1 })]);
	expect(mcpWorld.result?.body.resourceResult?.nextCursor).toBeNull();
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toMatch(/secret|token|ownerId/);
});

Given(/^the playlist read occurs (.+)$/, async ({ mcpWorld }, concurrency: string) => {
	mcpWorld.input = { ...mcpWorld.input, playlistReadMode: concurrency === "during an atomic configuration update" ? "resources:playlist-get:snapshot" : "resources:playlist-get" };
});
When("the client reads that creator’s playlist", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(String(mcpWorld.input?.playlistReadMode ?? "resources:playlist-get")) };
});
Then("safe playlist metadata and ordered items are returned", async ({ mcpWorld }) => {
	if (mcpWorld.input?.playlistReadMode === "resources:playlist-get:snapshot") expect(mcpWorld.result?.body.snapshotInterleaved).toBe(true);
	expect(mcpWorld.result?.body.resourceResult?.items[0]).toMatchObject({ title: "First clip", duration: 10 });
	expect(mcpWorld.result?.body.resourceResult?.playlist).toMatchObject({ creatorId: "fixture-creator", name: "Existing playlist", configurationRevision: 1 });
	expect(mcpWorld.result?.body.resourceResult?.items.map((item: { id: string }) => item.id)).toEqual(["ClipFirst", "ClipSecond"]);
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toMatch(/secret|token|ownerId/);
});

Given('an approved Free creator attempts "{word}" paid settings', async ({ mcpWorld }, setting) => {
	mcpWorld.input = { mode: `resources:overlay-update:${setting}` };
});
When("the agent submits the paid overlay change", async ({ mcpWorld }) => {
	const mode = mcpWorld.input?.mode;
	if (typeof mode !== "string") throw new Error("Missing paid-setting fixture mode");
	mcpWorld.result = { status: 200, body: flowProbe(mode) };
});
Then("the paid change is rejected and the saved configuration is preserved", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.error?.code).toBe("FEATURE_RESTRICTED");
	expect(mcpWorld.result?.body.persistedOverlay).toMatchObject({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
});

When("the agent deletes the overlay with its current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:overlay-delete") };
});
Then("only that overlay is deleted", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult).toEqual({ deletedId: "79e6c5a3-5368-4813-9780-49d22d99175f" });
	expect(mcpWorld.result?.body.resourceCount).toBe(0);
});

Given("an approved Free creator has no playlists", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:playlist-create" };
});
When("the agent creates a playlist and retries its request", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-create") };
});
Then("one safe playlist is created and the retry returns the original result", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.protocolStatus).toBe(200);
	expect(mcpWorld.result?.body.resourceResult?.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent playlist", configurationRevision: 1 });
	expect(mcpWorld.result?.body.resourceResult?.replayed).toEqual(mcpWorld.result?.body.resourceResult?.created);
	expect(mcpWorld.result?.body.playlistCount).toBe(1);
	expect(JSON.stringify(mcpWorld.result?.body.resourceResult)).not.toMatch(/secret|token|ownerId/);
});

Given("a real browser has an authenticated creator and registered MCP client", async ({ page, request, mcpWorld }) => {
	test.info().setTimeout(180000);
	const origin = "http://127.0.0.1:3107";
	const fixtureResponse = await request.post(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: {} });
	expect(fixtureResponse.status()).toBe(200);
	const owner = await fixtureResponse.json();
	mcpWorld.input = { realConsentOwner: owner };
	await page.context().addCookies([owner.cookie]);
	const response = await registerBrowserClient(request, origin, { client_name: "Browser consent regression", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
	expect(response.status()).toBe(201);
	const client = await response.json();
	const verifier = "real-browser-fixture-pkce-proof-at-least-43-characters-123456";
	const { createHash } = await import("node:crypto");
	const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: "creator:read overlay:read offline_access", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "real-browser-regression", resource: `${origin}/mcp` });
	mcpWorld.result = { status: 200, body: { origin, owner, client, verifier, authorization: `${origin}/api/auth/oauth2/authorize?${query}` } };
});
When("the browser approves the provider’s signed consent request", async ({ page, mcpWorld }) => {
	const state = mcpWorld.result?.body;
	await page.route("http://127.0.0.1:49999/callback**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Local OAuth callback received</p>" }));
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(state.authorization, { timeout: 60000 });
	await expect(page.getByRole("heading", { name: "Connect Browser consent regression" })).toBeVisible();
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByRole("heading", { name: "Connect Browser consent regression" })).toBeVisible();
	const creator = page.getByRole("button", { name: state.owner.fixture.username, exact: true });
	await creator.focus();
	await creator.press("Space");
	await page.screenshot({ path: "test-results/browser/consent-permissions.png" });
	await page.getByRole("button", { name: "Review", exact: true }).click();
	const stayConnected = page.getByRole("checkbox", { name: "Stay connected between sessions" });
	await expect(stayConnected).toBeVisible();
	const control = await page.locator('[data-slot="checkbox"] [data-slot="checkbox-control"]').boundingBox();
	const label = await page.getByText("Stay connected between sessions", { exact: true }).boundingBox();
	expect(control).not.toBeNull();
	expect(label).not.toBeNull();
	expect(Math.abs(control!.y - label!.y)).toBeLessThan(8);
	await page.screenshot({ path: "test-results/browser/consent-review.png" });
	await page.clock.install();
	await page.clock.pauseAt(new Date());
	await page.getByRole("button", { name: "Authorize", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Authorization successful" })).toBeVisible();
	await page.getByRole("tab", { name: "wget", exact: true }).click();
	await expect(page.getByRole("button", { name: "Copy wget command" })).toBeVisible();
	await page.getByRole("tab", { name: "Callback URL", exact: true }).click();
	await expect(page.getByRole("button", { name: "Copy callback URL" })).toBeVisible();
	await page.clock.runFor(4000);
	await page.waitForURL("http://127.0.0.1:49999/callback**");
	state.code = new URL(page.url()).searchParams.get("code");
	expect(state.code).toBeTruthy();
});
Then("the client exchanges the code and reads its approved overlay", async ({ request, mcpWorld }) => {
	const state = mcpWorld.result?.body;
	const exchange = await request.post(`${state.origin}/api/auth/oauth2/token`, { form: { grant_type: "authorization_code", client_id: state.client.client_id, redirect_uri: state.client.redirect_uris[0], code: state.code, code_verifier: state.verifier, resource: `${state.origin}/mcp` } });
	expect(exchange.status()).toBe(200);
	const token = await exchange.json();
	const response = await request.post(`${state.origin}/mcp`, { headers: { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", Authorization: `Bearer ${token.access_token}` }, data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_overlay", arguments: { creatorId: state.owner.fixture.creatorId, overlayId: state.owner.fixture.overlayId } } } });
	expect(response.status()).toBe(200);
	const text = await response.text();
	const payload =
		text.startsWith("event:") || text.startsWith("data:")
			? text
					.split("\n")
					.find((line) => line.startsWith("data:"))
					?.slice(5)
					.trim()
			: text;
	expect(payload).toBeTruthy();
	const result = JSON.parse(payload!);
	expect(result.result?.structuredContent?.overlay).toMatchObject({ id: state.owner.fixture.overlayId, name: "E2E continuity overlay", configurationRevision: 1 });
	expect(text).not.toContain(state.owner.fixture.overlaySecret);
});

When("the agent renames the playlist with its current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-update") };
});
Then("the renamed playlist has a new revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.playlist).toMatchObject({ name: "Renamed playlist", configurationRevision: 2 });
	expect(mcpWorld.result?.body.persistedPlaylist).toMatchObject({ name: "Renamed playlist", configuration_revision: 2 });
});

Given("an approved creator has a playlist linked to an overlay and gallery", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:playlist-delete" };
});
When("the agent deletes the playlist with its current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-delete") };
});
Then("its items are removed and references are cleared with a new overlay revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult).toEqual({ deletedId: "a1dca8b8-089a-47ce-b649-1c32bb3842c1" });
	expect(mcpWorld.result?.body.deletionState).toEqual({ playlists: 0, items: 0, overlay: { playlist_id: null, configuration_revision: 2 }, gallery: { playlist_id: null, published: false } });
});

Given("an approved creator has a playlist with two ordered clips", async ({ mcpWorld }) => {
	mcpWorld.input = { mode: "resources:playlist-remove" };
});
When("the agent removes its first clip with the current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-remove") };
});
Then("the remaining clip has position zero and the playlist has a new revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.persistedItems).toEqual([{ clip_id: "ClipSecond", position: 0 }]);
	expect(mcpWorld.result?.body.resourceResult?.playlist?.configurationRevision).toBe(2);
});

When("the agent reverses all playlist items using the current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-reorder") };
});
Then("the returned and persisted order match with a new revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.persistedItems).toEqual([
		{ clip_id: "ClipSecond", position: 0 },
		{ clip_id: "ClipFirst", position: 1 },
	]);
	expect(mcpWorld.result?.body.resourceResult?.playlist?.configurationRevision).toBe(2);
});

When("the agent appends two provider-validated clips using the current revision", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("resources:playlist-add") };
});
Then("the approved playlist contains four ordered clips and a new revision", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.persistedItems).toHaveLength(4);
	expect(mcpWorld.result?.body.resourceResult?.playlist?.configurationRevision).toBe(2);
	expect(mcpWorld.result?.body.externalClipRequests).toBe(1);
});

Given("a client approved item management without playlist read access", async ({ mcpWorld }) => {
	mcpWorld.input = { scope: "playlist-items:manage" };
});
When("the agent performs {string} using its current revision", async ({ mcpWorld }, operation: string) => {
	mcpWorld.result = { status: 200, body: flowProbe(`resources:playlist-${operation}:no-read`) };
});
Then("the item operation succeeds without requiring another scope", async ({ mcpWorld }) => {
	expect(mcpWorld.result?.body.resourceResult?.playlist?.configurationRevision).toBe(2);
	expect(mcpWorld.result?.body.persistedPlaylist.configuration_revision).toBe(2);
});

AfterScenario({ tags: "@BDD-US1-025" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.realConsentOwner as any;
	if (!owner) return;
	const response = await request.delete("http://127.0.0.1:3107/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});
