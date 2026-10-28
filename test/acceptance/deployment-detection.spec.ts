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
	await page.route("**/dashboard/settings?tab=creator", async (route) => {
		// Keep initialization asynchronous so visibility cannot stand in for loaded settings.
		if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 500));
		if (!updated || !route.request().isNavigationRequest()) return route.continue();
		const response = await route.fetch();
		// Simulate the updated document as well as its version endpoint after refresh.
		await route.fulfill({ response, body: (await response.text()).replaceAll("deployment-before-update", "deployment-after-update") });
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
	await expect(title).toBeEnabled();
	await expect.poll(() => checks).toBeGreaterThan(0);
	const savedTitle = (await tourWorld.fixture.pool.query('SELECT creator_page_social_title FROM "userSettings" WHERE id=$1', [owner.fixture.creatorId])).rows[0].creator_page_social_title;
	await title.fill("Keep this unsaved preview title");
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	updated = true;
	await page.evaluate(() => window.dispatchEvent(new Event("focus")));
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

for (const failure of ["detected update", "missing action"] as const) {
	test(`Settings export handles ${failure} without a false export failure or automatic reload`, async ({ page, request, context, tourWorld }) => {
		test.setTimeout(120000);
		let updated = false;
		let checks = 0;
		let mutations = 0;
		await page.route("**/api/deployment", (route) => {
			checks++;
			return route.fulfill({ status: 204, headers: { "x-clipify-deployment-id": updated ? "deployment-after-update" : "deployment-before-update" } });
		});
		const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, billingState: "active" } });
		expect(response.ok()).toBe(true);
		const owner = await response.json();
		await context.addCookies([owner.cookie]);
		await page.goto(`${tourWorld.origin}/dashboard/settings`);
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await expect(page.getByRole("button", { name: "Export Account Data", exact: true })).toBeVisible();
		await expect.poll(() => checks).toBeGreaterThan(0);
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: "Export Account Data", exact: true }).click();
		const exportDialog = page.getByRole("dialog", { name: "Request your Clipify data", exact: true });
		await expect(exportDialog).toBeVisible();
		const timeOrigin = await page.evaluate(() => performance.timeOrigin);
		await page.route("**/dashboard/settings", (route) => {
			const req = route.request();
			if (req.method() === "POST" && req.headers()["next-action"]) {
				mutations++;
				return route.continue({ headers: { ...req.headers(), "next-action": req.headers()["next-action"].slice(0, 2) + "0".repeat(40) } });
			}
			return route.continue();
		});
		updated = failure === "detected update";
		await exportDialog.getByRole("button", { name: "Email download link", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Clipify has been updated", exact: true })).toBeVisible();
		await expect(exportDialog).toBeHidden();
		await expect(page.getByText("Export request failed", { exact: true })).toHaveCount(0);
		expect(mutations).toBe(failure === "detected update" ? 0 : 1);
		if (failure === "detected update") {
			const update = page.getByRole("dialog", { name: "Clipify has been updated", exact: true });
			await update.getByRole("button", { name: "Close update dialog", exact: true }).click();
			await page.getByRole("button", { name: "Export Account Data", exact: true }).click();
			await exportDialog.getByRole("button", { name: "Email download link", exact: true }).click();
			await expect(update).toBeVisible();
			await expect(exportDialog).toBeHidden();
			expect(mutations).toBe(0);
		}

		expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	});
}
