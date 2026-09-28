import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

type AuthFixture = {
	cookie: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: "Lax" };
	fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string; overlayId: string; overlaySecret: string };
};

async function createFixture(request: APIRequestContext, context: BrowserContext, activeContext: "creator" | "agency") {
	const response = await request.post("/api/test/auth-fixture", { headers: fixtureHeaders, data: { activeContext } });
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
	let fixture: AuthFixture | undefined;
	try {
		fixture = await createFixture(request, context, "creator");
		await page.goto(`/dashboard/settings/team?organization=${encodeURIComponent(fixture.fixture.creatorOrganizationId)}`);
		await expect(page.getByRole("heading", { name: "Team members" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("E2E Creator Account", { exact: false })).toBeVisible({ timeout: 30_000 });
		await page.goto("/dashboard/settings/account/recovery");
		await expect(page.getByRole("heading", { name: "Account suspended pending deletion" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("Your resources are retained", { exact: false })).toBeVisible();
	} finally {
		await page.close();
		await deleteFixture(request, fixture);
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
		await page.close();
		await deleteFixture(request, fixture);
	}
});

test("overlay runtime URL remains usable independently of dashboard auth", async ({ page, request, context }) => {
	let fixture: AuthFixture | undefined;
	try {
		fixture = await createFixture(request, context, "creator");
		await context.clearCookies();
		await page.goto(`/overlay/${fixture.fixture.overlayId}?secret=${encodeURIComponent(fixture.fixture.overlaySecret)}`);
		await expect(page.getByText("Overlay paused", { exact: true })).toBeVisible({ timeout: 30_000 });
	} finally {
		await page.close();
		await deleteFixture(request, fixture);
	}
});
