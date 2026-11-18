import { test, expect } from "../bdd/support/user-tour";
test.use({ actionTimeout: 15000, navigationTimeout: 15000 });

for (const [width, theme] of [
	[1440, "dark"],
	[390, "light"],
] as const) {
	test(`Administrator provisions and revokes application connections at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
		test.setTimeout(120000);
		await page.setViewportSize({ width, height: 960 });
		await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
		const fixtureResponse = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, actorRole: "admin" } });
		expect(fixtureResponse.status()).toBe(200);
		const owner = await fixtureResponse.json();
		await page.context().addCookies([owner.cookie]);
		await page.goto(`${tourWorld.origin}/admin/connections`);
		if (await page.getByRole("button", { name: "Reject optional", exact: true }).isVisible()) {
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		}
		await expect(page.getByText("No applications connected yet.")).toBeVisible();
		await page.getByRole("button", { name: "Add connection", exact: true }).click();
		const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add application connection", exact: true }) });
		await dialog.getByRole("textbox", { name: /^Application name/ }).fill("Browser Awards");
		await dialog.getByRole("combobox", { name: /^Creator/ }).fill(owner.fixture.username);
		await page.getByRole("option").filter({ hasText: owner.fixture.username }).click();
		await dialog.getByText("Play clips", { exact: true }).click();
		await expect(dialog.getByRole("checkbox", { name: "Play clips", exact: true })).not.toBeChecked();
		const signIn = dialog.getByRole("checkbox", { name: "Allow sign-in with Clipify", exact: true });
		await signIn.focus();
		await signIn.press("Space");
		await expect(signIn).toBeChecked();
		await dialog.getByRole("textbox", { name: /^Sign-in callback URL/ }).fill("https://awards.example/api/auth/callback/clipify");
		await dialog.screenshot({ path: info.outputPath(`connection-create-${width}-${theme}.png`) });
		await tourWorld.fixture.pool.query(`UPDATE auth.session SET created_at=now()-interval '10 minutes' WHERE user_id=$1`, [owner.fixture.authUserId]);
		await dialog.getByRole("button", { name: "Create connection", exact: true }).click();
		await expect(page.getByText("Sign in again before creating application credentials.")).toBeVisible();
		await page.getByRole("dialog", { name: "Action could not be completed", exact: true }).getByRole("button", { name: "Close message", exact: true }).click();
		await expect(dialog.getByRole("textbox", { name: /^Application name/ })).toHaveValue("Browser Awards");
		expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM connected_app_grants")).rows[0].count)).toBe(0);
		await tourWorld.fixture.pool.query("UPDATE auth.session SET created_at=now() WHERE user_id=$1", [owner.fixture.authUserId]);
		// An actual denial preserves the draft and has no credential side effects.
		await page.route("**/api/connected-apps/admin", async (route) => {
			if (route.request().method() === "POST") {
				await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "ACCESS_DENIED" } }) });
				await page.unroute("**/api/connected-apps/admin");
			} else await route.continue();
		});
		await dialog.getByRole("button", { name: "Create connection", exact: true }).click();
		await expect(page.getByText("Access denied. Check your administrator session and the creator’s account.")).toBeVisible();
		await page.getByRole("dialog", { name: "Action could not be completed", exact: true }).getByRole("button", { name: "Close message", exact: true }).click();
		await expect(dialog.getByRole("textbox", { name: /^Application name/ })).toHaveValue("Browser Awards");
		const created = page.waitForResponse((response) => response.url().endsWith("/api/connected-apps/admin") && response.request().method() === "POST");
		await dialog.getByRole("button", { name: "Create connection", exact: true }).click();
		const response = await created;
		expect(response.status()).toBe(201);
		const connection = (await response.json()).data;
		const secrets = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Save your application credentials" }) });
		await expect(secrets.getByRole("textbox", { name: "Connection configuration" })).toHaveValue(/CLIPIFY_CLIENT_SECRET/);
		const stored = await tourWorld.fixture.pool.query("SELECT client_id,client_secret,require_pkce,redirect_uris,client_credentials_scopes FROM auth.oauth_client WHERE client_id=ANY($1)", [[connection.clientId, connection.identity.clientId]]);
		expect(stored.rowCount).toBe(2);
		expect(stored.rows.some((row) => [connection.clientSecret, connection.identity.clientSecret].includes(row.client_secret))).toBe(false);
		expect(stored.rows.find((row) => row.client_id === connection.identity.clientId)).toMatchObject({ require_pkce: true, redirect_uris: ["https://awards.example/api/auth/callback/clipify"], client_credentials_scopes: [] });
		await secrets.getByRole("button", { name: "I’ve saved the credentials" }).click();
		await expect(page.getByRole("textbox", { name: "Connection configuration" })).toHaveCount(0);
		const row = page.getByRole("row").filter({ hasText: "Browser Awards" });
		await expect(row).toBeVisible();
		await expect(row.getByText("Play clips", { exact: true })).toHaveCount(0);
		await page.screenshot({ path: info.outputPath(`connection-list-${width}-${theme}.png`), fullPage: true });
		const tokenResponse = await request.post(`${tourWorld.origin}/api/auth/oauth2/token`, { headers: { Authorization: `Basic ${Buffer.from(`${connection.clientId}:${connection.clientSecret}`).toString("base64")}` }, form: { grant_type: "client_credentials", scope: "creator:read", resource: `${tourWorld.origin}/api/connected-apps` } });
		expect(tokenResponse.status(), await tokenResponse.text()).toBe(200);
		const token = (await tokenResponse.json()).access_token;
		const deniedPlayback = await request.post(`${tourWorld.origin}/api/connected-apps`, { headers: { Authorization: `Bearer ${token}` }, data: { operation: "get_clip_playback", input: { creatorId: owner.fixture.creatorId, reference: "AValidClipSlug" } } });
		expect(deniedPlayback.status()).toBe(403);
		await row.getByRole("button", { name: "Revoke", exact: true }).click();
		await page.getByRole("dialog", { name: "Revoke application access?" }).getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(row.getByText("Active", { exact: true })).toBeVisible();
		await tourWorld.fixture.pool.query("UPDATE auth.oauth_client SET disabled=true WHERE client_id=$1", [connection.clientId]);
		await page.reload();
		await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
		await expect(row.getByRole("button", { name: "Revoke", exact: true })).toBeEnabled();
		await row.getByRole("button", { name: "Revoke", exact: true }).click();
		await page.getByRole("dialog", { name: "Revoke application access?" }).getByRole("button", { name: "Revoke access", exact: true }).click();
		await expect(row.getByText("Revoked", { exact: true })).toBeVisible();
		const revoked = await tourWorld.fixture.pool.query("SELECT disabled FROM auth.oauth_client WHERE client_id=ANY($1)", [[connection.clientId, connection.identity.clientId]]);
		expect(revoked.rows.every((row) => row.disabled)).toBe(true);
		const noLongerAllowed = await request.post(`${tourWorld.origin}/api/connected-apps`, { headers: { Authorization: `Bearer ${token}` }, data: { operation: "search_clips", input: { creatorId: owner.fixture.creatorId } } });
		expect(noLongerAllowed.status()).toBe(403);
		const list = await request.get(`${tourWorld.origin}/api/connected-apps/admin`, { headers: { Cookie: `${owner.cookie.name}=${owner.cookie.value}` } });
		expect(await list.text()).not.toMatch(new RegExp(`${connection.clientSecret}|${connection.identity.clientSecret}`));
		await page.reload();
		await expect(page.getByRole("textbox", { name: "Connection configuration" })).toHaveCount(0);
	});
}

test("Non-administrators cannot list or provision application connections", async ({ page, request, tourWorld }) => {
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const viewer = await response.json();
	await page.context().addCookies([viewer.cookie]);
	const headers = { Cookie: `${viewer.cookie.name}=${viewer.cookie.value}`, Origin: tourWorld.origin };
	expect((await request.get(`${tourWorld.origin}/api/connected-apps/admin`, { headers })).status()).toBe(403);
	const denied = await request.post(`${tourWorld.origin}/api/connected-apps/admin`, { headers, data: { action: "provision", name: "Not allowed", creatorId: viewer.fixture.creatorId, operations: ["search_clips"], expiresAt: new Date(Date.now() + 86400000).toISOString() } });
	expect(denied.status()).toBe(403);
	const clients = await tourWorld.fixture.pool.query("SELECT count(*) FROM connected_app_grants");
	expect(Number(clients.rows[0].count)).toBe(0);
});
