import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";

test.use({ actionTimeout: 15000, navigationTimeout: 15000 });

for (const [width, theme] of [
	[1440, "dark"],
	[390, "light"],
] as const)
	test(`Admin view retains creator navigation and stream data at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
		test.setTimeout(120000);
		await page.setViewportSize({ width, height: 950 });
		await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
		const target = await seedCreatorLibrary({ page, request, tourWorld });
		const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true } });
		expect(response.status()).toBe(200);
		const admin = await response.json();
		await tourWorld.fixture.pool.query("UPDATE users SET role='admin' WHERE id=$1", [admin.fixture.creatorId]);
		await page.context().addCookies([admin.cookie]);
		await page.goto(`${tourWorld.origin}/admin`);
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.getByRole("textbox", { name: "Search users", exact: true }).fill(target.creatorId);
		const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "View as User", exact: true }) });
		await expect(row).toHaveCount(1);
		await tourWorld.fixture.pool.query("UPDATE users SET disabled=true WHERE id=$1", [target.creatorId]);
		await page.goto(`${tourWorld.origin}/admin?q=${target.creatorId}`);
		await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
		await expect(row.getByRole("button", { name: "View as User", exact: true })).toBeEnabled();
		await row.getByRole("rowheader").hover();
		await row.screenshot({ path: info.outputPath("admin-table.png") });
		await tourWorld.fixture.pool.query("UPDATE users SET disabled=false WHERE id=$1", [target.creatorId]);
		await page.reload();
		await row.getByRole("button", { name: "Manage benefits", exact: true }).click();
		const benefits = page.getByRole("dialog", { name: "Grant access or badges", exact: true });
		await expect(benefits).toBeVisible();
		await benefits.getByRole("button", { name: "Close", exact: true }).last().click();
		await row.getByRole("button", { name: "Disable", exact: true }).click();
		const access = page.getByRole("dialog", { name: /^Disable @/ });
		await expect(access.getByRole("button", { name: "Disable account", exact: true })).toBeDisabled();
		await access.getByRole("button", { name: "Cancel", exact: true }).click();
		await row.getByRole("button", { name: "View as User", exact: true }).click();
		await expect(page).toHaveURL(`${tourWorld.origin}/dashboard`);
		const banner = page.getByRole("region", { name: "Admin view", exact: true });
		await expect(banner).toBeVisible();
		await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
		const bannerBox = (await banner.boundingBox())!;
		const barBox = (await page.locator("nav").first().boundingBox())!;
		expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(barBox.y + 1);
		const sidebar = page.locator(width === 390 ? '[data-slot="sidebar-mobile"]' : '[data-slot="sidebar"]');
		if (width === 390) {
			await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			await expect(page.locator(".sidebar__mobile-sheet")).not.toHaveAttribute("data-entering");
		}
		for (const title of ["Home", "Streams", "Clip Inventory", "Overlays", "Settings"]) await expect(sidebar.getByRole("row", { name: title, exact: true })).toBeVisible();
		await expect(sidebar.getByRole("row", { name: "Clip Inventory", exact: true })).toBeInViewport();
		await page.screenshot({ path: info.outputPath("admin-view-navigation.png") });
		const clipsLink = sidebar.getByRole("row", { name: "Clip Inventory", exact: true });
		await expect(clipsLink).toBeInViewport({ ratio: 1 });
		await expect
			.poll(() =>
				clipsLink.evaluate((node) => {
					const box = node.getBoundingClientRect();
					return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
				}),
			)
			.toBe(true);
		const linkBox = (await clipsLink.boundingBox())!;
		// RAC's native swipe scroller must not be scrolled by the test driver before the click.
		await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
		await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
		await expect(page.getByText("Last night's clutch", { exact: true })).toBeVisible();
		await page.screenshot({ path: info.outputPath("admin-view-clips.png"), fullPage: true });
		await page.goto(`${tourWorld.origin}/dashboard/streams`);
		await expect(page.getByRole("heading", { name: "Streams", exact: true })).toBeVisible();
		await expect(page.getByText("ACCESS_PATH_REQUIRED", { exact: true })).toHaveCount(0);
		await expect.poll(async () => (await tourWorld.fixture.pool.query("SELECT count(*)::int AS count FROM user_content_states WHERE user_id=$1 AND content_key LIKE 'broadcast:v1:%'", [target.creatorId])).rows[0].count).toBeGreaterThan(0);
		await page.screenshot({ path: info.outputPath("admin-view-streams.png"), fullPage: true });
		await banner.getByRole("button", { name: "Exit", exact: true }).click();
		await expect(banner).toHaveCount(0);
		if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
		await expect(page.getByRole("treegrid", { name: "Admin sections", exact: true })).toBeVisible();
	});
