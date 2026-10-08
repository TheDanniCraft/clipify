import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };
Given("a native authenticated creator dashboard is ready for overlay creation", async ({ page, request, mcpWorld }) => {
	test.info().setTimeout(120000);
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	mcpWorld.input = { createFailureOwner: owner, interrupted: false };
	await page.context().addCookies([owner.cookie]);
	await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
	const support = page.getByRole("button", { name: "Enable support chat", exact: true });
	await support.focus();
	await support.press("Enter");
	const reject = page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	await Promise.all([page.waitForEvent("load"), reject.click()]);
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
});
When("the overlay creation server request loses its connection", async ({ page, mcpWorld }) => {
	await page.route(`${origin}/dashboard`, async (route) => {
		let argumentsMatch = false;
		try {
			const args = JSON.parse(route.request().postData() ?? "null");
			const owner = mcpWorld.input?.createFailureOwner as any;
			argumentsMatch = Array.isArray(args) && args.length === 1 && args[0] === owner.fixture.creatorId;
		} catch {}
		if (!mcpWorld.input?.interrupted && argumentsMatch && route.request().method() === "POST" && route.request().headers()["next-action"]) {
			mcpWorld.input!.interrupted = true;
			await route.abort("connectionfailed");
		} else await route.continue();
	});
	await page.getByRole("button", { name: "Add Overlay", exact: true }).click();
	await expect.poll(() => mcpWorld.input?.interrupted).toBe(true);
});
Then("the dashboard reports creation failure and keeps its create button usable", async ({ page }) => {
	await expect(page.getByText("Failed to create overlay. Please try again.", { exact: true })).toBeVisible();
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
	await expect(page.getByRole("button", { name: "Add Overlay", exact: true })).toBeEnabled();
});
AfterScenario({ tags: "@overlay-create-failure" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.createFailureOwner as any;
	if (!owner?.fixture) return;
	const response = await request.delete(`${origin}/api/test/auth-fixture`, { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});
