import { createBdd } from "playwright-bdd";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { Given, When, Then, AfterScenario } = createBdd(test);

Given("a visitor is viewing Clipify's public pricing", async ({ page }) => {
	await page.goto("http://127.0.0.1:3107/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.goto("http://127.0.0.1:3107/pricing");
	await expect(page.getByRole("heading", { name: "Compare plans & features.", exact: true })).toBeVisible();
});

When("they open the Pro setup dialog", async ({ page }) => {
	await page.getByRole("button", { name: "Get Pro", exact: true }).first().click();
	await expect(page.getByRole("dialog", { name: "Complete your Pro setup", exact: true })).toBeVisible();
});

Then("Pro setup offers checkout without a separate Runner purchase", async ({ page }) => {
	const setup = page.getByRole("dialog", { name: "Complete your Pro setup", exact: true });
	await expect(setup.getByRole("checkbox", { name: /Runner/ })).toHaveCount(0);
	await expect(setup.getByRole("link", { name: "Continue to checkout" })).toHaveAttribute("href", /plan=pro/);
	await expect(setup.locator('a[href*="runner=true"]')).toHaveCount(0);
});

When("they follow an old Runner purchase link", async ({ page }) => {
	await page.goto("http://127.0.0.1:3107/checkout/start?plan=pro&runner=true&cycle=monthly");
});

Then("they return to pricing without a Runner checkout intent", async ({ page, context }) => {
	await expect(page).toHaveURL("http://127.0.0.1:3107/pricing");
	await expect(page.getByRole("heading", { name: "Compare plans & features.", exact: true })).toBeVisible();
	expect((await context.cookies()).some((cookie) => cookie.name === "clipify_checkout_intent")).toBe(false);
});

Then("public pricing explains included Runner limits without an add-on offer", async ({ page }) => {
	await expect(page.getByText("Runner and broadcasting", { exact: true }).last()).toBeVisible();
	await expect(page.getByText("Streaming hours", { exact: true }).last()).toBeVisible();
	await expect(page.getByText("Active broadcasts", { exact: true }).last()).toBeVisible();
	await expect(page.locator("body")).not.toContainText("Runner is an optional add-on");
	await expect(page.locator('a[href*="runner=true"]')).toHaveCount(0);
});

type CommercialOwner = { fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string }; cookie: Parameters<import("@playwright/test").BrowserContext["addCookies"]>[0][number] };
const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };

async function setFreeCommercialPlan(owner: CommercialOwner) {
	// The shared auth fixture defaults to Pro for unrelated auth journeys.
	expect(owner.fixture.creatorId).toMatch(/^e2e-creator-/);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const result = await pool.query("UPDATE users SET plan='free' WHERE id=$1 RETURNING plan", [owner.fixture.creatorId]);
		expect(result.rows).toEqual([{ plan: "free" }]);
	} finally {
		await pool.end();
	}
}

When("a Free creator opens their billing controls", async ({ page, request, mcpWorld }) => {
	const response = await request.post("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = (await response.json()) as CommercialOwner;
	await setFreeCommercialPlan(owner);
	mcpWorld.input = { commercialOwner: owner };
	await page.context().addCookies([owner.cookie]);
	await page.goto("http://127.0.0.1:3107/dashboard/settings");
	await page.getByRole("tab", { name: "Billing", exact: true }).click();
	await expect(page.getByText("Your plan", { exact: true })).toBeVisible();
});

Then("billing offers Pro without a separate Runner purchase", async ({ page }) => {
	await expect(page.getByRole("checkbox", { name: "Self-hosted Runner", exact: true })).toHaveCount(0);
	await expect(page.getByRole("checkbox", { name: "Pro", exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox", { name: "Pro", exact: true })).toBeVisible();
	await page.goto("http://127.0.0.1:3107/dashboard/settings?addon=runner");
	await expect(page.getByText("Your plan", { exact: true })).toBeVisible();
	await expect(page.getByRole("dialog", { name: /Upgrade with Runner|Add the Runner add-on/ })).toHaveCount(0);
	await expect(page.getByRole("checkbox", { name: "Pro", exact: true })).toBeVisible();
});

AfterScenario({ tags: "@runner-commercial-browser" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.commercialOwner as CommercialOwner | undefined;
	if (!owner) return;
	const response = await request.delete("http://127.0.0.1:3107/api/test/auth-fixture", { maxRetries: 2, headers: fixtureHeaders, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});

When("a Free creator opens Runner onboarding", async ({ page, request, mcpWorld }) => {
	const response = await request.post("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = (await response.json()) as CommercialOwner;
	await setFreeCommercialPlan(owner);
	mcpWorld.input = { commercialOwner: owner };
	await page.context().addCookies([owner.cookie]);
	await page.goto("http://127.0.0.1:3107/dashboard");
	await page.getByRole("tab", { name: "Runners", exact: true }).click();
});

Then("Runner onboarding creates a Runner without checkout", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Add Runner", exact: true })).toBeEnabled();
	await expect(page.locator("body")).not.toContainText("Purchase the Runner add-on");
	await page.getByRole("button", { name: "Add Runner", exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/runners\/[a-f0-9-]+$/);
	await expect(page.getByRole("heading", { name: "Setup Your Runner", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Download for Windows", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Download for Linux", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Download for macOS", exact: true })).toBeVisible();
	await expect(page.getByRole("dialog", { name: /Upgrade|Runner add-on/ })).toHaveCount(0);
});

Then("pricing, features and served reference documents agree on the two included Runner plans", async ({ page, request }) => {
	for (const path of ["/llms.txt", "/llms-full.txt"]) {
		const response = await request.get(`http://127.0.0.1:3107${path}`);
		expect(response.status()).toBe(200);
		const text = await response.text();
		expect(text).toMatch(/Runner is included with Free and Pro/);
		expect(text).toMatch(/unlimited streaming hours/i);
		expect(text).not.toMatch(/Runner access is a separate optional product|Pro and Runner prices|separate Runner access/);
	}
	await page.goto("http://127.0.0.1:3107/#features");
	await expect(page.getByRole("heading", { name: "Self-hosted Runner", level: 3, exact: true })).toBeVisible();
	await expect(page.locator("body")).not.toContainText("3 EUR per month or 30 EUR per year");
	await expect(page.getByRole("heading", { name: "Self-hosted Runner add-on", exact: true })).toHaveCount(0);
	await expect(page.locator('a[href*="runner=true"],a[href*="addon=runner"]')).toHaveCount(0);
	await page.goto("http://127.0.0.1:3107/pricing");
	await page.setViewportSize({ width: 1280, height: 1000 });
	await expect(page.getByText("Runner and broadcasting", { exact: true }).last()).toBeVisible();
	await page.screenshot({ path: "specs/004-runner-free-pro/tdd/evidence/C1-pricing-desktop.png", fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	const group = page.getByRole("button", { name: "Runner and broadcasting", exact: true });
	await expect(group).toBeVisible();
	await expect(page.getByText("Streaming hours", { exact: true }).first()).toBeVisible();
	const overflow = await page.evaluate(() => ({
		viewport: window.innerWidth,
		document: document.documentElement.scrollWidth,
		elements: [...document.querySelectorAll("body *")]
			.map((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return { tag: element.tagName, className: element.className, left: rect.left, right: rect.right, width: rect.width, position: style.position, overflowX: style.overflowX, text: element.textContent?.slice(0, 80) };
			})
			.filter((element) => element.width > 0 && (element.left < -1 || element.right > window.innerWidth + 1))
			.sort((a, b) => b.right - a.right)
			.slice(0, 40),
	}));
	if (overflow.document > overflow.viewport) await (await import("node:fs/promises")).writeFile("specs/004-runner-free-pro/tdd/evidence/C1-mobile-overflow-before.json", JSON.stringify(overflow, null, 2));
	expect(overflow.document <= overflow.viewport).toBe(true);
	await group.scrollIntoViewIfNeeded();
	await page.screenshot({ path: "specs/004-runner-free-pro/tdd/evidence/C1-pricing-mobile.png", fullPage: false });
});
