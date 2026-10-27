import { test, expect } from "../bdd/support/user-tour";

test.use({ deploymentId: "deployment-before-update" });

test("Settings detects a deployment without reloading and restores its draft only after explicit refresh", async ({ page, request, context, tourWorld }) => {
	test.setTimeout(120000);
	let updated = false;
	let checks = 0;
	await page.route("**/api/deployment", (route) => {
		checks++;
		return route.fulfill({ status: 204, headers: { "x-clipify-deployment-id": updated ? "deployment-after-update" : "deployment-before-update" } });
	});
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, billingState: "active" } });
	expect(response.ok()).toBe(true);
	const owner = await response.json();
	await context.addCookies([owner.cookie]);
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=creator`);
	await expect(page.getByRole("button", { name: "Reject optional", exact: true })).toBeVisible();
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	const title = page.getByRole("textbox", { name: "Preview title", exact: true });
	await expect(title).toBeVisible();
	await expect.poll(() => checks).toBeGreaterThan(0);
	const savedTitle = (await tourWorld.fixture.pool.query('SELECT creator_page_social_title FROM "userSettings" WHERE id=$1', [owner.fixture.creatorId])).rows[0].creator_page_social_title;
	await title.fill("Keep this unsaved preview title");
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	updated = true;
	await page.evaluate(() => window.dispatchEvent(new Event("online")));
	const update = page.getByRole("dialog", { name: "Clipify has been updated", exact: true });
	await expect(update).toBeVisible();
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	await expect(title).toHaveValue("Keep this unsaved preview title");
	await update.getByRole("button", { name: "Close update dialog", exact: true }).click();
	const beforeCheck = checks;
	await page.evaluate(() => window.dispatchEvent(new Event("online")));
	await expect.poll(() => checks).toBeGreaterThan(beforeCheck);
	await expect(update).toBeHidden();
	await expect(page.getByRole("button", { name: "Refresh required", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Refresh required", exact: true }).click();
	page.on("dialog", (dialog) => dialog.accept());
	await Promise.all([page.waitForEvent("load"), update.getByRole("button", { name: "Refresh Clipify", exact: true }).click()]);
	await expect(title).toHaveValue("Keep this unsaved preview title");
	expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(timeOrigin);
	expect((await tourWorld.fixture.pool.query('SELECT creator_page_social_title FROM "userSettings" WHERE id=$1', [owner.fixture.creatorId])).rows[0].creator_page_social_title).toBe(savedTitle);
});
