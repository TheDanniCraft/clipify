import { createBdd } from "playwright-bdd";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, test, type AuthFixture } from "../support/auth-engine-rewrite";
import { expect } from "../../bdd/support/mcp-support";

const { Given, When, Then, AfterScenario } = createBdd(test);
type CommercialFixture = { owner: AuthFixture; runnerId: string; sessionId: string; destinationId: string };
const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };

Given("an existing Runner customer has saved Scheduled configuration and a legacy grant", async ({ page, request, context, authWorld }) => {
	const owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
	const state: CommercialFixture = { owner, runnerId: randomUUID(), sessionId: randomUUID(), destinationId: randomUUID() };
	authWorld.values.set("commercialRunner", state);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [owner.fixture.creatorId]);
		await pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES($1,'runner_access','partner',now()-interval '1 hour',now()+interval '1 day')", [owner.fixture.creatorId]);
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Existing local Runner',$3,'online',now(),2,$4::jsonb)", [state.runnerId, owner.fixture.creatorId, randomUUID(), JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode,rtmp_url) VALUES($1,$2,$3,$4,'24/7','scheduled','rtmp://127.0.0.1:19350/live')", [state.sessionId, owner.fixture.creatorId, state.runnerId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url) VALUES($1,$2,$3,'Saved vacation destination','custom','rtmp://127.0.0.1:19350/live')", [state.destinationId, owner.fixture.creatorId, state.runnerId]);
		await pool.query("INSERT INTO stream_session_destinations(owner_id,session_id,destination_id,position) VALUES($1,$2,$3,0)", [owner.fixture.creatorId, state.sessionId, state.destinationId]);
	} finally {
		await pool.end();
	}
	await page.goto("/legal/cookies");
	await page.waitForLoadState("networkidle");
	await expect(page.locator("html")).toHaveClass(/c15t-(?:light|dark)/);
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	const persisted = page.waitForResponse((response) => response.url().includes("/api/c15t/subjects") && response.request().method() === "POST" && response.ok());
	const refreshed = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
	await privacy.getByRole("button", { name: "Reject optional", exact: true }).click();
	await Promise.all([persisted, refreshed]);
	await expect(privacy).not.toBeVisible();
	await page.goto(`/dashboard/runners/${state.runnerId}`);
	await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: / Control$/ })).toContainText("Scheduled");
});

When("their legacy Runner grant expires and they reopen the Runner", async ({ page, authWorld }) => {
	const state = authWorld.values.get("commercialRunner") as CommercialFixture;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE entitlement_grants SET ends_at=now()-interval '1 second' WHERE user_id=$1 AND entitlement='runner_access'", [state.owner.fixture.creatorId]);
	} finally {
		await pool.end();
	}
	await page.reload();
});

Then("the saved destination remains available and they can switch to basic Manual control without a purchase", async ({ page, authWorld }) => {
	const state = authWorld.values.get("commercialRunner") as CommercialFixture;
	await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Edit Saved vacation destination", exact: true })).toBeVisible();
	const control = page.getByRole("button", { name: / Control$/ });
	await control.click();
	await expect(page.getByRole("option", { name: /Scheduled/ })).toBeEnabled();
	await expect(page.getByRole("option", { name: /Scheduled/ }).getByRole("img", { name: "Requires Pro" })).toBeVisible();
	await page.getByRole("option", { name: "Manual", exact: true }).click();
	await expect(control).toContainText("Manual");
	await control.click();
	await page.getByRole("option", { name: /Scheduled/ }).click();
	const upgrade = page.getByRole("dialog", { name: "Upgrade to Pro", exact: true });
	await expect(upgrade).toBeVisible();
	await expect(control).toContainText("Manual");
	await page.keyboard.press("Escape");
	await expect(upgrade).toHaveCount(0);
	await Promise.all([page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/dashboard/runners/${state.runnerId}` && Boolean(response.request().postData()?.includes(state.sessionId))), page.getByRole("button", { name: "Save Configuration", exact: true }).click()]);
	await expect(page.getByText("Stream session configuration saved.", { exact: true })).toBeVisible();
	await page.reload();
	await expect(control).toContainText("Manual");
	await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
	await expect(page.getByRole("dialog", { name: /Upgrade|Runner add-on/ })).toHaveCount(0);
	await page.goto("/dashboard/settings");
	await page.getByRole("tab", { name: "Billing", exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Pro", exact: true })).toBeVisible();
	await expect(page.getByRole("checkbox", { name: "Self-hosted Runner", exact: true })).toHaveCount(0);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const session = (await pool.query("SELECT overlay_id,control_mode,rtmp_url FROM stream_sessions WHERE id=$1 AND owner_id=$2", [state.sessionId, state.owner.fixture.creatorId])).rows;
		expect(session).toEqual([{ overlay_id: state.owner.fixture.overlayId, control_mode: "manual", rtmp_url: "rtmp://127.0.0.1:19350/live" }]);
		expect((await pool.query("SELECT destination_id FROM stream_session_destinations WHERE session_id=$1", [state.sessionId])).rows).toEqual([{ destination_id: state.destinationId }]);
		expect((await pool.query("SELECT count(*) FROM entitlement_grants WHERE user_id=$1 AND entitlement='runner_access'", [state.owner.fixture.creatorId])).rows[0].count).toBe("1");
	} finally {
		await pool.end();
	}
});

AfterScenario({ tags: "@runner-commercial-acceptance" }, async ({ request, authWorld }) => {
	const state = authWorld.values.get("commercialRunner") as CommercialFixture | undefined;
	if (!state) return;
	const owner = state.owner.fixture;
	const response = await request.delete("/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: owner.authUserId, creatorId: owner.creatorId, organizationIds: [owner.creatorOrganizationId, owner.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});

When("their known paid billing deadline passes while the saved plan still says Pro", async ({ page, authWorld }) => {
	const state = authWorld.values.get("commercialRunner") as CommercialFixture;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [state.owner.fixture.creatorId]);
		await pool.query("UPDATE entitlement_grants SET ends_at=now()-interval '1 second' WHERE user_id=$1 AND entitlement='runner_access'", [state.owner.fixture.creatorId]);
		const subscriptionId = "e2e-period-" + randomUUID();
		await pool.query("INSERT INTO billing_subscriptions(id,user_id,stripe_customer_id,status,current_period_end,cancel_at_period_end) VALUES($1,$2,$3,'active',now()-interval '1 second',true)", [subscriptionId, state.owner.fixture.creatorId, "e2e-customer-" + randomUUID()]);
		await pool.query("INSERT INTO billing_subscription_items(id,subscription_id,product_key,stripe_product_id,stripe_price_id,currency,billing_interval) VALUES($1,$2,'pro','e2e-pro','e2e-pro-monthly','usd','month')", ["e2e-item-" + randomUUID(), subscriptionId]);
		expect((await pool.query("SELECT plan FROM users WHERE id=$1", [state.owner.fixture.creatorId])).rows).toEqual([{ plan: "pro" }]);
	} finally {
		await pool.end();
	}
	await page.reload();
});
