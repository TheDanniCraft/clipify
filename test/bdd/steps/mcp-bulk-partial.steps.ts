import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };
Given("an authenticated dashboard has two overlays and one becomes stale", async ({ page, request, mcpWorld }) => {
	test.info().setTimeout(120000);
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers, data: { withSecondOverlay: true, withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	mcpWorld.input = { bulkOwner: owner };
	await page.context().addCookies([owner.cookie]);
	await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
	await expect(page.getByText("Second continuity overlay", { exact: true })).toBeVisible();
	const support = page.getByRole("button", { name: "Enable support chat", exact: true });
	await support.focus();
	await support.press("Enter");
	const reject = page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	await Promise.all([page.waitForEvent("load"), reject.click()]);
	await expect(page.getByText("Second continuity overlay", { exact: true })).toBeVisible();
	const stale = await request.patch(`${origin}/api/test/auth-fixture`, { headers, data: { creatorId: owner.fixture.creatorId, overlayId: owner.fixture.secondOverlayId, bumpOverlayRevision: true } });
	expect(stale.status()).toBe(200);
	expect(await stale.json()).toEqual({ updated: true });
	const selection = page.getByRole("checkbox", { name: "Select all items", exact: true });
	await selection.focus();
	await selection.press("Space");
	await expect(selection).toBeChecked();
});
When("the creator performs bulk {string} on both overlays", async ({ page }, operation: string) => {
	await page.getByRole("button", { name: "Open Selected Actions", exact: true }).click();
	await page.getByRole("menuitem", { name: operation === "status" ? "Toggle status" : "Delete", exact: true }).click();
});
Then("the successful {string} result is visible and the stale row remains", async ({ page }, operation: string) => {
	await expect(page.getByText(operation === "status" ? "One or more overlays could not be updated." : "One or more overlays could not be deleted.", { exact: true })).toBeVisible();
	await expect(page.getByText("Second continuity overlay", { exact: true })).toBeVisible();
	if (operation === "delete") await expect(page.getByText("E2E continuity overlay", { exact: true })).toHaveCount(0);
	else {
		const row = page.getByRole("row").filter({ has: page.getByText("E2E continuity overlay", { exact: true }) });
		await expect(row.getByText("paused", { exact: true })).toBeVisible();
	}
});
AfterScenario({ tags: "@bulk-partial-ui" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.bulkOwner as any;
	if (!owner?.fixture) return;
	const result = await request.delete(`${origin}/api/test/auth-fixture`, { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(result.status()).toBe(204);
});
