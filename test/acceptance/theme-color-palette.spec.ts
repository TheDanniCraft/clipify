import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };

test("theme palettes recover stored equivalent colors and save native swatch selections", async ({ page, request, context }, info) => {
	test.setTimeout(120000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true, billingState: "active" });
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [owner.fixture.creatorId]);
		await context.addInitScript(() => localStorage.setItem("clipify:overlay-theme-recent-colors", JSON.stringify(["#fff", "rgba(255, 255, 255, 1)", "hsl(0, 0%, 100%)", "rgba(255, 255, 255, 0.5)", "not-a-color"])));
		await page.goto("/legal/cookies");
		const consent = page.getByRole("complementary", { name: "Your privacy choices", exact: true });
		await consent.getByRole("button", { name: "Reject optional", exact: true }).click();
		await expect(consent).not.toBeVisible();
		await page.reload();
		for (const [index, theme, width] of [
			[1, "dark", 390],
			[2, "light", 1280],
		] as const) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`/dashboard/overlay/${owner.fixture.overlayId}/theme`);
			await page.evaluate((theme) => {
				document.documentElement.classList.remove("light", "dark");
				document.documentElement.classList.add(theme);
			}, theme);
			const save = page.getByRole("button", { name: "Save Style", exact: true });
			await expect(save).toBeDisabled();
			const trigger = page.getByRole("button", { name: "Pick Background Color", exact: true });
			await trigger.click();
			const options = page.getByRole("option");
			await expect(options).toHaveCount(6);
			const ids = await options.evaluateAll((nodes) => nodes.map((node) => node.id));
			expect(new Set(ids).size).toBe(ids.length);
			await options.nth(index).click();
			await page.keyboard.press("Escape");
			await expect(options).toHaveCount(0);
			await trigger.focus();
			await page.keyboard.press("Enter");
			await expect(options).toHaveCount(6);
			const reset = page.getByRole("button", { name: "Reset to default", exact: true });
			await reset.scrollIntoViewIfNeeded();
			await expect(reset).toBeInViewport();
			await page.screenshot({ path: info.outputPath(`theme-palette-${theme}-${width}.png`), animations: "disabled" });
			await page.keyboard.press("Escape");
			await expect(save).toBeEnabled();
			await save.click();
			await expect(save).toBeDisabled();
			await expect.poll(async () => (await pool.query("SELECT theme_background_color FROM overlays WHERE id=$1", [owner!.fixture.overlayId])).rows[0]?.theme_background_color).toBe(index === 1 ? "rgba(124, 58, 237, 1)" : "rgba(145, 70, 255, 1)");
		}
		expect(errors).toEqual([]);
	} finally {
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.ok()).toBe(true);
		}
		await pool.end();
	}
});
