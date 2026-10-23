import { test, expect } from "@playwright/test";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

test("linked accounts and AI access share the Connections settings tab", async ({ page, context, request }, info) => {
	test.setTimeout(120000);
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		await page.goto("/dashboard/settings?tab=connections");
		await expect(page.getByRole("tab", { name: "Connections", exact: true })).toHaveAttribute("aria-selected", "true");
		await expect(page.getByRole("heading", { name: "Linked accounts", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Connected AI apps", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "AI app activity", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Disconnect", exact: true }).first()).toBeVisible();
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
	} finally {
		if (owner) {
			const result = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(result.status()).toBe(204);
		}
	}
});
