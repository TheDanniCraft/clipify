import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
Given("a native Pro browser actor owns access to a separate Free creator overlay", async ({ page, request, mcpWorld }) => {
	const state: { actors: any[]; target?: any } = { actors: [] };
	mcpWorld.input = { themeOwnerPlan: state };
	for (let index = 0; index < 2; index++) {
		const response = await request.post(origin + "/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: {} });
		expect(response.status()).toBe(200);
		state.actors.push(await response.json());
	}
	const actor = state.actors[0],
		target = state.actors[1];
	state.target = target.fixture;
	const url = new URL(process.env.MCP_BROWSER_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !/^\/(clipify_e2e|mcp_[0-9a-f]{32})$/.test(url.pathname)) throw new Error("Theme owner plan requires the isolated loopback browser database");
	const pool = new Pool({ connectionString: url.href, max: 1 });
	try {
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [target.fixture.creatorId]);
		await pool.query("INSERT INTO auth.member(id,organization_id,user_id,role,created_at) VALUES($1,$2,$3,'owner',now())", [randomUUID(), target.fixture.creatorOrganizationId, actor.fixture.authUserId]);
	} finally {
		await pool.end();
	}
	await page.context().addCookies([actor.cookie]);
});
When("that actor opens the Free creator theme editor", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.themeOwnerPlan as any;
	await page.goto(`${origin}/dashboard/overlay/${state.target.overlayId}/theme`);
	await expect(page.getByRole("button", { name: "Save Style", exact: true })).toBeVisible();
});
Then("the actual theme editor displays its creator Pro feature lock", async ({ page }) => {
	await expect(page.getByText("Pro Feature Locked", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Upgrade to Pro", exact: true })).toBeVisible();
});
AfterScenario({ tags: "@theme-owner-plan" }, async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.themeOwnerPlan as any;
	for (const actor of [...(state?.actors ?? [])].reverse()) {
		const fixture = actor.fixture;
		const response = await request.delete(origin + "/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: fixture.authUserId, creatorId: fixture.creatorId, organizationIds: [fixture.creatorOrganizationId, fixture.agencyOrganizationId] } });
		expect(response.status()).toBe(204);
	}
});
