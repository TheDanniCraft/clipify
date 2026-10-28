import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";

test("linked accounts and AI access share the Connections settings tab", async ({ page, context, request }, info) => {
	test.setTimeout(120000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		await pool.query(`INSERT INTO auth.account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES ($1, $2, 'google', $3, now(), now())`, [`e2e-secondary-${owner.fixture.authUserId}`, "isolated-secondary-channel", owner.fixture.authUserId]);
		await pool.query("INSERT INTO mcp_connection_grants(id,auth_user_id,client_id,resource,issuer,scopes,active) VALUES($1,$2,'persistent-browser-client','http://127.0.0.1:3107/mcp','http://127.0.0.1:3107/api/auth',ARRAY['creator:read','offline_access'],true)", [randomUUID(), owner.fixture.authUserId]);
		await page.goto("/dashboard/settings?tab=connections");
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await expect(page.getByText("No fixed expiry", { exact: true })).toBeVisible();
		await expect(page.getByRole("tab", { name: "Connections", exact: true })).toHaveAttribute("aria-selected", "true");
		await expect(page.getByRole("heading", { name: "Linked accounts", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Connected AI apps", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "AI app activity", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect", exact: true }).first()).toBeVisible();
		await expect(page.getByRole("button", { name: "Primary account", exact: true })).toBeDisabled();
		const primary = await pool.query(`SELECT id FROM auth.account WHERE user_id=$1 AND provider_id='twitch'`, [owner.fixture.authUserId]);
		const denied = await context.request.post("/api/auth/unlink-account", { data: { providerId: "twitch", accountId: primary.rows[0].id }, headers: { Origin: "http://127.0.0.1:3107" } });
		expect(denied.status()).toBe(400);
		expect((await denied.json()).code).toBe("PRIMARY_TWITCH_ACCOUNT_REQUIRED");
		for (const theme of ["dark", "light"]) {
			await page.evaluate((nextTheme) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(nextTheme);
				document.documentElement.style.colorScheme = nextTheme;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await expect(page.getByRole("heading", { name: "Linked accounts", exact: true })).toBeVisible();
				await page.screenshot({ path: info.outputPath(`connections-${theme}-${width}.png`), fullPage: true });
			}
		}
		await pool.query(`UPDATE auth.session SET created_at = now() - interval '10 minutes' WHERE user_id = $1`, [owner.fixture.authUserId]);
		await page.getByRole("button", { name: "Disconnect", exact: true }).first().click();
		const disconnect = page.getByRole("dialog", { name: /^Disconnect (Google|Twitch)\?$/ });
		await disconnect.getByRole("button", { name: "Disconnect", exact: true }).click();
		const verification = page.getByRole("dialog", { name: "Sign in again to continue", exact: true });
		await expect(verification).toContainText("To verify it's you, please sign in again.");
		await expect(verification.getByRole("button", { name: "Continue with Google" })).toBeVisible();
		await verification.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(verification).toBeHidden();
		const linkedAccounts = await pool.query("SELECT id FROM auth.account WHERE user_id=$1 AND provider_id IN ($2,$3)", [owner.fixture.authUserId, "google", "twitch"]);
		expect(linkedAccounts.rowCount).toBeGreaterThan(0);
	} finally {
		await pool.end();
		if (owner) {
			const result = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(result.status()).toBe(204);
		}
	}
});
