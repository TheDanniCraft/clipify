import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { createAuthenticatedFixture } from "../atdd/support/auth-engine-rewrite";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { defaultProgress, guideContentKey, journeys } from "../../src/app/lib/userTour";

test("admin and authenticated instance health share guide completion metrics", async ({ page, request, context }, info) => {
	test.setTimeout(120000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	const owner = await createAuthenticatedFixture(request, context, { actorRole: "admin", withProviderCredentials: true });
	try {
		const progress = { ...defaultProgress(), completed: journeys.flatMap((section) => section.tasks.map((task) => task.id)) };
		await pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3) ON CONFLICT(user_id,content_key) DO UPDATE SET state=excluded.state", [owner.fixture.creatorId, guideContentKey, JSON.stringify(progress)]);
		const denied = await request.get("/internal/health/instance");
		expect(denied.status()).toBe(401);
		const response = await request.get("/internal/health/instance", { headers: { Authorization: `Bearer ${process.env.INSTANCE_HEALTH_TOKEN}` } });
		expect(response.status()).toBe(200);
		expect(response.headers()["cache-control"]).toBe("no-store");
		const { onboarding } = await response.json();
		expect(onboarding).toMatchObject({ trackedAccounts: 1, completedAccounts: 1, completionRate: 1, averageProgress: 1 });
		expect(JSON.stringify(onboarding)).not.toContain(owner.fixture.creatorId);
		await page.goto("/admin");
		await expect(page.getByRole("region", { name: "Onboarding guides", exact: true })).toBeVisible();
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		const panel = page.getByRole("region", { name: "Onboarding guides", exact: true });
		await expect(panel.getByRole("grid", { name: "Onboarding completion by guide section" })).toBeVisible();
		for (const section of journeys) await expect(panel.getByText(section.title, { exact: true })).toBeVisible();
		await expect(panel.getByText("100.0%", { exact: true }).first()).toBeVisible();
		for (const theme of ["dark", "light"]) {
			await page.evaluate((value) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(value);
				document.documentElement.style.colorScheme = value;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await panel.scrollIntoViewIfNeeded();
				await panel.screenshot({ path: info.outputPath(`onboarding-${theme}-${width}.png`) });
				if (width === 390) {
					const scroll = panel.locator('[data-slot="table-scroll-container"]');
					await scroll.evaluate((element) => {
						element.scrollLeft = element.scrollWidth;
					});
					await expect(panel.getByRole("columnheader", { name: "Skipped tasks", exact: true })).toBeInViewport();
					await panel.screenshot({ path: info.outputPath(`onboarding-${theme}-${width}-scrolled.png`) });
					await scroll.evaluate((element) => {
						element.scrollLeft = 0;
					});
				}
			}
		}
	} finally {
		await pool.end();
		const cleanup = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
		expect(cleanup.status()).toBe(204);
	}
});
