import { Pool } from "pg";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { test, expect } from "@playwright/test";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

test("feature upgrades preserve intent and account upgrades remain generic", async ({ page, request, context }, testInfo) => {
	test.setTimeout(180000);
	page.setDefaultTimeout(30000);
	let owner: AuthFixture | undefined;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let priceFixtureApplied = false;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [owner.fixture.creatorId]);
		await page.goto("/legal/cookies");
		await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
		const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
		await preferences.focus();
		await preferences.press("Enter");
		const consent = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
		await Promise.all([page.waitForEvent("load"), consent.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.route("**/dashboard/settings*", async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			const response = await route.fetch();
			const original = await response.text();
			// Replace unavailable price metadata only. No payment request is submitted.
			const fixture = original.replace('"monthly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"monthly":{"amount":2,"currency":"EUR","formatted":"€2.00"}').replace('"yearly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"yearly":{"amount":20,"currency":"EUR","formatted":"€20.00"}');
			if (fixture !== original) priceFixtureApplied = true;
			await route.fulfill({ response, body: fixture });
		});
		const cases = [
			["runner_scheduling", "Schedule your broadcasts with Pro"],
			["theme_studio", "Design your overlay with Pro"],
			["gallery_filters", "Refine your gallery with Pro"],
			["playlist_import", "Build playlists faster with Pro"],
			["multi_overlay", "Create more overlays with Pro"],
			["multi_playlist", "Build more playlists with Pro"],
			["multi_gallery", "Publish more galleries with Pro"],
			["advanced_filters", "Choose the right clips with Pro"],
			["creator_analytics", "Understand your audience with Pro"],
			["creator_social_preview", "Make every share yours with Pro"],
			["trial_active", "Keep your Pro features"],
			["account", "Upgrade Account"],
			["constructor", "Upgrade Account"],
		];
		for (const [feature, title] of cases) {
			await page.goto(`/dashboard/settings?upgrade&cycle=monthly&source=upgrade_modal&feature=${feature}`);
			const dialog = page.getByRole("dialog", { name: title, exact: true });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByRole("button", { name: "Upgrade to Pro for €2.00/month", exact: true })).toBeEnabled();
			await expect(dialog.getByText(title === "Upgrade Account" ? "What’s included with Pro" : "Also included with Pro", { exact: true })).toBeVisible();
			const compare = dialog.getByRole("link", { name: "Compare Free and Pro", exact: true });
			await expect(compare).toHaveAttribute("href", "/pricing");
			expect(await dialog.innerText()).not.toContain("—");
			if (feature === "theme_studio" || feature === "account") await dialog.screenshot({ path: testInfo.outputPath(`${feature}.png`), animations: "disabled" });
			await page.keyboard.press("Escape");
			await expect(dialog).not.toBeVisible();
		}
		expect(priceFixtureApplied).toBe(true);
	} finally {
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
