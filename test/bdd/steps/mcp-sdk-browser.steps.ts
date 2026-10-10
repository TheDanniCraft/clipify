import { createBdd } from "playwright-bdd";
import { createHash } from "node:crypto";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { connectMcpClient } from "../../support/mcp/client";
import { registerBrowserClient } from "../../support/mcp/browser-registration";
const { When } = createBdd(test);
const origin = "http://127.0.0.1:3107";

When("the official SDK completes {word} approval edit abandoned consent and revoke through Clipify pages", async ({ page, request }, area: string) => {
	test.setTimeout(300000);
	page.setDefaultTimeout(15000);
	page.setDefaultNavigationTimeout(60000);
	const fixture = await request.post(`${origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, withPlaylist: true, withPlaylistItems: true } });
	expect(fixture.status()).toBe(200);
	const owner = await fixture.json();
	const databaseUrl = browserDatabaseUrl();
	const fixturePool = new Pool({ connectionString: databaseUrl, max: 1 });
	try {
		await fixturePool.query("UPDATE users SET plan = 'free' WHERE id = $1", [owner.fixture.creatorId]);
	} finally {
		await fixturePool.end();
	}
	let connected: Awaited<ReturnType<typeof connectMcpClient>> | undefined;
	try {
		await page.context().addCookies([owner.cookie]);
		const metadata = await request.get(`${origin}/.well-known/oauth-protected-resource/mcp`);
		expect(metadata.status()).toBe(200);
		const registered = await registerBrowserClient(request, origin, { client_name: "Official SDK browser acceptance", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
		expect(registered.status()).toBe(201);
		const client = await registered.json();
		const verifier = "official-sdk-real-browser-proof-at-least-43-characters-12345";
		const authorization = `${origin}/api/auth/oauth2/authorize?${new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: "creator:read overlay:read overlay:create overlay:update overlay:delete playlist:read playlist:create playlist:update playlist:delete playlist-items:manage offline_access", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${origin}/mcp`, state: "official-sdk-browser" })}`;
		await page.route("http://127.0.0.1:49999/callback**", (route) => route.fulfill({ contentType: "text/html", body: "Local callback" }));
		await page.goto(authorization);
		await expect(page.getByRole("heading", { name: "Connect Official SDK browser acceptance" })).toBeVisible();
		await page.getByRole("button", { name: "Enable support chat", exact: true }).press("Enter");
		await Promise.all([page.waitForEvent("domcontentloaded", { timeout: 60000 }), page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.waitForLoadState("load");
		await page.getByRole("button", { name: owner.fixture.username, exact: true }).focus();
		await page.getByRole("button", { name: owner.fixture.username, exact: true }).press("Space");
		await page.getByRole("radiogroup", { name: "General permissions" }).getByRole("radio", { name: "Write", exact: true }).click();
		await page.getByRole("button", { name: "Review", exact: true }).click();
		await page.getByRole("button", { name: "Authorize", exact: true }).click();
		await expect(page.getByRole("heading", { name: "Authorization successful" })).toBeVisible();
		await page.getByRole("link", { name: "Continue to Official SDK browser acceptance" }).click();
		await page.waitForURL("http://127.0.0.1:49999/callback**");
		const code = new URL(page.url()).searchParams.get("code");
		expect(Boolean(code)).toBe(true);
		const exchange = await request.post(`${origin}/api/auth/oauth2/token`, { form: { grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: code!, code_verifier: verifier, resource: `${origin}/mcp` } });
		expect(exchange.status()).toBe(200);
		const tokens = await exchange.json();
		connected = await connectMcpClient(new URL(`${origin}/mcp`), tokens.access_token, "auto");
		const tools = await connected.client.listTools();
		expect(tools.tools.length).toBe(66);
		const prompts = await connected.client.listPrompts();
		expect(prompts.prompts).toHaveLength(6);
		expect(tools.tools.find((tool) => tool.name === "delete_overlay")?.annotations?.destructiveHint).toBe(true);
		const args = { creatorId: owner.fixture.creatorId, overlayId: owner.fixture.overlayId };
		const creators = await connected.client.callTool({ name: "list_creators", arguments: {} });
		expect((creators.structuredContent as any)?.items).toEqual([{ id: args.creatorId, name: owner.fixture.username }]);
		const capabilities = await connected.client.callTool({ name: "get_capabilities", arguments: { creatorId: args.creatorId } });
		expect(capabilities.structuredContent).toMatchObject({ creatorId: args.creatorId, effectivePlan: "free", usage: { overlays: 1, playlists: 1, playlistItems: 2 }, limits: { overlays: 1, playlists: 1 }, operations: { create_overlay: { allowed: false, reason: "PLAN_LIMIT_REACHED" }, create_playlist: { allowed: false, reason: "PLAN_LIMIT_REACHED" } } });
		if (area === "overlays") {
			const read = await connected.client.callTool({ name: "get_overlay", arguments: args });
			expect((read.structuredContent as any)?.overlay?.configurationRevision).toBe(1);
			const edited = await connected.client.callTool({ name: "update_overlay_settings", arguments: { ...args, expectedRevision: 1, patch: { name: "Official SDK browser edit" } } });
			expect((edited.structuredContent as any)?.configurationRevision).toBe(2);
			await page.goto(`${origin}/dashboard/overlay/${owner.fixture.overlayId}`);
			await expect(page.getByRole("textbox", { name: /^Overlay Name\*?$/ })).toHaveValue("Official SDK browser edit", { timeout: 30000 });
			const listed = await connected.client.callTool({ name: "list_overlays", arguments: { creatorId: args.creatorId } });
			expect((listed.structuredContent as any)?.items?.some((item: any) => item.id === args.overlayId && item.name === "Official SDK browser edit")).toBe(true);
			await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await expect(page.getByText("Official SDK browser edit", { exact: true })).toBeVisible();
			const limited = await connected.client.callTool({ name: "create_overlay", arguments: { creatorId: args.creatorId, retryKey: "sdk-browser-over-limit", name: "Must not appear" } });
			expect((limited.structuredContent as any)?.error?.code).toBe("PLAN_LIMIT_REACHED");
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await expect(page.getByText("Must not appear", { exact: true })).toHaveCount(0);
			const deleted = await connected.client.callTool({ name: "delete_overlay", arguments: { ...args, expectedRevision: 2 } });
			expect((deleted.structuredContent as any)?.deletedId).toBe(args.overlayId);
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await expect(page.getByText("Official SDK browser edit", { exact: true })).toHaveCount(0);
			const created = await connected.client.callTool({ name: "create_overlay", arguments: { creatorId: args.creatorId, retryKey: "sdk-browser-create-after-delete", name: "Official SDK created overlay" } });
			expect(typeof (created.structuredContent as any)?.id).toBe("string");
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await expect(page.getByText("Official SDK created overlay", { exact: true })).toBeVisible();
		}
		if (area === "playlists") {
			await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			const playlistArgs = { creatorId: args.creatorId, playlistId: owner.fixture.playlistId };
			const playlistRead = await connected.client.callTool({ name: "get_playlist", arguments: playlistArgs });
			expect((playlistRead.structuredContent as any)?.items.map((item: any) => item.id)).toEqual(["ClipFirst", "ClipSecond"]);
			const playlistList = await connected.client.callTool({ name: "list_playlists", arguments: { creatorId: args.creatorId } });
			expect((playlistList.structuredContent as any)?.items.some((item: any) => item.id === playlistArgs.playlistId)).toBe(true);
			await page.getByRole("tab", { name: "Playlists", exact: true }).click();
			await expect(page.getByText("Browser playlist", { exact: true })).toBeVisible();
			await page.goto(`${origin}/dashboard/playlist/${playlistArgs.playlistId}`);
			await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Browser playlist", { timeout: 30000 });
			await expect(page.getByText("ClipFirst", { exact: true })).toBeVisible();
			const playlistEdit = await connected.client.callTool({ name: "update_playlist", arguments: { ...playlistArgs, expectedRevision: 1, name: "Official SDK playlist edit" } });
			expect((playlistEdit.structuredContent as any)?.playlist.configurationRevision).toBe(2);
			const reordered = await connected.client.callTool({ name: "reorder_playlist_items", arguments: { ...playlistArgs, expectedRevision: 2, itemIds: ["ClipSecond", "ClipFirst"] } });
			expect((reordered.structuredContent as any)?.playlist.configurationRevision).toBe(3);
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Official SDK playlist edit", { timeout: 30000 });
			const clipTitles = page.getByRole("listitem").filter({ hasText: /Clip(First|Second)/ });
			await expect(clipTitles).toHaveCount(2);
			await expect(clipTitles.nth(0)).toContainText("ClipSecond");
			await expect(clipTitles.nth(1)).toContainText("ClipFirst");
			const providerClipId = `SdkBrowser_${owner.fixture.creatorId.slice("e2e-creator-".length)}`;
			const added = await connected.client.callTool({ name: "add_playlist_items", arguments: { ...playlistArgs, expectedRevision: 3, clipIds: [providerClipId] } });
			expect((added.structuredContent as any)?.playlist.configurationRevision).toBe(4);
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Official SDK playlist edit", { timeout: 30000 });
			await expect(page.getByText("Official SDK added clip", { exact: true })).toBeVisible();
			const removed = await connected.client.callTool({ name: "remove_playlist_items", arguments: { ...playlistArgs, expectedRevision: 4, itemIds: ["ClipFirst"] } });
			expect((removed.structuredContent as any)?.playlist.configurationRevision).toBe(5);
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Official SDK playlist edit", { timeout: 30000 });
			await expect(page.getByText("ClipSecond", { exact: true })).toBeVisible();
			await expect(page.getByText("ClipFirst", { exact: true })).toHaveCount(0);
			const playlistLimit = await connected.client.callTool({ name: "create_playlist", arguments: { creatorId: args.creatorId, retryKey: "sdk-browser-playlist-limit", name: "Must not create playlist" } });
			expect((playlistLimit.structuredContent as any)?.error?.code).toBe("PLAN_LIMIT_REACHED");
			const playlistDelete = await connected.client.callTool({ name: "delete_playlist", arguments: { ...playlistArgs, expectedRevision: 5 } });
			expect((playlistDelete.structuredContent as any)?.deletedId).toBe(playlistArgs.playlistId);
			await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await page.getByRole("tab", { name: "Playlists", exact: true }).click();
			await expect(page.getByText("Official SDK playlist edit", { exact: true })).toHaveCount(0);
			const playlistCreate = await connected.client.callTool({ name: "create_playlist", arguments: { creatorId: args.creatorId, retryKey: "sdk-browser-new-playlist", name: "Official SDK created playlist" } });
			expect(typeof (playlistCreate.structuredContent as any)?.id).toBe("string");
			await page.reload({ waitUntil: "domcontentloaded" });
			await expect(page.getByText("Loading overlays", { exact: true })).toHaveCount(0, { timeout: 30000 });
			await page.getByRole("tab", { name: "Playlists", exact: true }).click();
			await expect(page.getByText("Official SDK created playlist", { exact: true })).toBeVisible();
		}
		await page.goto(authorization);
		await expect(page.getByRole("heading", { name: "Connect Official SDK browser acceptance" })).toBeVisible();
		await expect(page.getByRole("button", { name: /Deny|Cancel connection/ })).toHaveCount(0);
		// Leaving the consent page does not submit an approval or callback code.
		expect(new URL(page.url()).searchParams.has("code")).toBe(false);
		await page.goto(`${origin}/dashboard/settings`);
		const suggestions = page.getByRole("button", { name: "Ideas to try with your AI app" });
		await expect(suggestions).toBeVisible();
		await suggestions.click();
		await expect(page.getByText("Give my overlay a purple theme with rounded corners and a visible progress bar.", { exact: true })).toBeVisible();
		await page.screenshot({ path: `test-results/browser/focused-prompts-${area}.png`, fullPage: true });

		const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Disconnect Official SDK browser acceptance", exact: true }) });
		await expect(row).toHaveCount(1, { timeout: 30000 });
		await row.getByRole("button", { name: "Disconnect Official SDK browser acceptance", exact: true }).click();
		await page.getByRole("dialog", { name: "Disconnect this app?", exact: true }).getByRole("button", { name: "Disconnect", exact: true }).click();
		await expect(page.getByRole("status").filter({ hasText: "The app is disconnected" })).toBeVisible({ timeout: 30000 });
		await expect(row).toHaveCount(0);
		await page.getByRole("button", { name: /^Show inactive/ }).click();
		await expect(page.getByRole("row").filter({ hasText: "Official SDK browser acceptance" }).getByText("Disconnected", { exact: true })).toBeVisible({ timeout: 30000 });
		let denied = false;
		try {
			await connected.client.callTool({ name: "get_overlay", arguments: args });
		} catch {
			denied = true;
		}
		expect(denied).toBe(true);
		const refreshed = await request.post(`${origin}/api/auth/oauth2/token`, { form: { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: client.client_id, resource: `${origin}/mcp` } });
		expect(refreshed.status()).toBe(400);
	} finally {
		await connected?.close();
		// Keep cleanup independent of the Playwright request context on scenario timeout.
		if (!/^e2e-creator-[a-f0-9-]{36}$/.test(owner.fixture.creatorId)) throw new Error("Disposable fixture identity required for cleanup");
		const cleanupPool = new Pool({ connectionString: databaseUrl.toString(), max: 1 });
		const cleanup = await cleanupPool.connect();
		try {
			await cleanup.query("BEGIN");
			await cleanup.query("DELETE FROM auth.organization WHERE id = ANY($1::text[])", [[owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId]]);
			await cleanup.query("DELETE FROM users WHERE id = $1", [owner.fixture.creatorId]);
			await cleanup.query('DELETE FROM auth."user" WHERE id = $1 AND email_verified = true', [owner.fixture.authUserId]);
			await cleanup.query("COMMIT");
		} catch (error) {
			await cleanup.query("ROLLBACK");
			throw error;
		} finally {
			cleanup.release();
			await cleanupPool.end();
		}
	}
});
