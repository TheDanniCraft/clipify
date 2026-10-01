import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

type AuthFixture = {
	cookie: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: "Lax" };
	fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string; overlayId: string; overlaySecret: string };
};

async function createFixture(request: APIRequestContext, context: BrowserContext, activeContext: "creator" | "agency", deletionState: "none" | "suspended" = "none") {
	const response = await request.post("/api/test/auth-fixture", { headers: fixtureHeaders, data: { activeContext, deletionState } });
	expect(response.ok(), await response.text()).toBe(true);
	const fixture = (await response.json()) as AuthFixture;
	await context.addCookies([fixture.cookie]);
	return fixture;
}

async function deleteFixture(request: APIRequestContext, fixture: AuthFixture | undefined) {
	if (!fixture) return;
	const response = await request.delete("/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: fixture.fixture.authUserId, creatorId: fixture.fixture.creatorId, organizationIds: [fixture.fixture.creatorOrganizationId, fixture.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
}

test("authenticated creator can open team and recovery boundaries", async ({ page, request, context }) => {
	const fixtures: AuthFixture[] = [];
	try {
		const fixture = await createFixture(request, context, "creator");
		fixtures.push(fixture);
		await page.goto(`/dashboard/settings/team?organization=${encodeURIComponent(fixture.fixture.creatorOrganizationId)}`);
		await expect(page.getByRole("heading", { name: "Team members" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("E2E Creator Account", { exact: false })).toBeVisible({ timeout: 30_000 });

		const suspendedFixture = await createFixture(request, context, "creator", "suspended");
		fixtures.push(suspendedFixture);
		await page.goto("/dashboard/settings/account/recovery");
		await expect(page.getByRole("heading", { name: "Account suspended pending deletion" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("Your resources are retained", { exact: false })).toBeVisible();
	} finally {
		for (const fixture of fixtures.reverse()) await deleteFixture(request, fixture);
	}
});

test("authenticated agency owner can select a creator without direct membership", async ({ page, request, context }) => {
	let fixture: AuthFixture | undefined;
	try {
		fixture = await createFixture(request, context, "agency");
		await page.goto(`/dashboard/agency?creator=${encodeURIComponent(fixture.fixture.creatorOrganizationId)}`);
		await expect(page.getByRole("heading", { name: "Creator management" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("navigation", { name: "Linked creator context" })).toContainText(fixture.fixture.creatorOrganizationId);
	} finally {
		await deleteFixture(request, fixture);
	}
});

test("overlay runtime URL remains usable independently of dashboard auth", async ({ page, request, context }) => {
	let fixture: AuthFixture | undefined;
	try {
		fixture = await createFixture(request, context, "creator");
		await context.clearCookies();
		const response = await page.goto(`/overlay/${fixture.fixture.overlayId}?secret=${encodeURIComponent(fixture.fixture.overlaySecret)}`);
		expect(response?.ok()).toBe(true);
		await expect(page.locator("body")).toBeVisible();
		await expect(page.getByText("Overlay not found or invalid secret", { exact: true })).toHaveCount(0);
		await expect(page.getByText("Your account has been disabled. Please contact support.", { exact: true })).toHaveCount(0);
	} finally {
		await deleteFixture(request, fixture);
	}
});
