import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Given, Then } = createBdd(test);
const origin = "http://127.0.0.1:3107";
async function createOverviewActor(request: any, page: any, role: "admin" | "user") {
	const response = await request.post(origin + "/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { actorRole: role, withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	await page.context().addCookies([owner.cookie]);
	return owner;
}
Given("an administrator opens the MCP operational overview", async ({ page, request, mcpWorld }) => {
	test.setTimeout(180000);
	mcpWorld.input = { overviewOwner: await createOverviewActor(request, page, "admin") };
	const rejected = await request.post(origin + "/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_creators", arguments: {} } }, headers: { Accept: "application/json, text/event-stream" } });
	expect(rejected.status()).toBe(401);
	await page.goto(origin + "/admin");
});
Then("process-local metrics and self-reported client adoption are accessible", async ({ page, request, mcpWorld }) => {
	try {
		await expect(page.getByRole("heading", { name: "MCP activity", exact: true })).toBeVisible();
		await expect(page.getByText(/This process, since/)).toBeVisible();
		await expect(page.getByRole("grid", { name: "MCP tool usage" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "MCP client adoption", exact: true })).toBeVisible();
		await expect(page.getByText(/not verified vendor identities/)).toBeVisible();
		await expect(page.getByRole("grid", { name: "MCP client adoption" })).toBeVisible();
		await page.getByRole("columnheader", { name: "Tool", exact: true }).click();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByRole("heading", { name: "MCP activity", exact: true })).toBeVisible();
		await page.screenshot({ path: "test-results/browser/admin-mcp-mobile.png", fullPage: true });
	} finally {
		await request.delete(origin + "/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: (mcpWorld.input?.overviewOwner as any).fixture.authUserId } });
	}
});
Given("a creator opens the administrative MCP overview", async ({ page, request, mcpWorld }) => {
	test.setTimeout(180000);
	mcpWorld.input = { overviewOwner: await createOverviewActor(request, page, "user") };
	await page.goto(origin + "/admin");
});
Then("MCP operational statistics are not exposed", async ({ page, request, mcpWorld }) => {
	try {
		await expect(page.getByRole("heading", { name: "MCP activity", exact: true })).toHaveCount(0);
		await expect(page.getByRole("grid", { name: "MCP client adoption" })).toHaveCount(0);
	} finally {
		await request.delete(origin + "/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: (mcpWorld.input?.overviewOwner as any).fixture.authUserId } });
	}
});
