import { Pool } from "pg";
import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };
function fixturePool() {
	const url = new URL(process.env.MCP_BROWSER_DATABASE_URL ?? process.env.DATABASE_URL ?? "");
	if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !/^\/(clipify_e2e|mcp_[0-9a-f]{32})$/.test(url.pathname)) throw new Error("Filtered bulk proof requires isolated loopback browser database");
	return new Pool({ connectionString: url.href, max: 1 });
}
Given("a native dashboard filters two overlays to the paused overlay", async ({ page, request, mcpWorld }) => {
	test.info().setTimeout(120000);
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers, data: { withSecondOverlay: true, withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	mcpWorld.input = { filteredBulkOwner: owner };
	const pool = fixturePool();
	try {
		await pool.query("UPDATE overlays SET status='paused' WHERE id=$1 AND owner_id=$2", [owner.fixture.secondOverlayId, owner.fixture.creatorId]);
	} finally {
		await pool.end();
	}
	await page.context().addCookies([owner.cookie]);
	await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
	await expect(page.getByText("Second continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
	const support = page.getByRole("button", { name: "Enable support chat", exact: true });
	await support.focus();
	await support.press("Enter");
	const reject = page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	await Promise.all([page.waitForEvent("load"), reject.click()]);
	await expect(page.getByText("Second continuity overlay", { exact: true })).toBeVisible({ timeout: 30000 });
	await page.getByRole("button", { name: "Open Filter Options", exact: true }).click();
	const paused = page.getByRole("radio", { name: "Paused", exact: true });
	await paused.focus();
	await paused.press("Space");
	await expect(paused).toBeChecked();
	await page.keyboard.press("Escape");
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toHaveCount(0);
	const selection = page.getByRole("checkbox", { name: "Select all items", exact: true });
	await selection.focus();
	await selection.press("Space");
	await expect(selection).toBeChecked();
});
When("the creator applies bulk {string} to the filtered selection", async ({ page }, operation: string) => {
	await page.getByRole("button", { name: "Open Selected Actions", exact: true }).click();
	await page.getByRole("menuitem", { name: operation === "delete" ? "Delete" : "Toggle status", exact: true }).click();
	await expect(page.getByText(operation === "delete" ? "Successfully deleted" : "Status Updated", { exact: true })).toBeVisible();
});
Then("the active overlay outside the filter remains unchanged", async ({ page, mcpWorld }) => {
	const owner = mcpWorld.input?.filteredBulkOwner as any;
	const pool = fixturePool();
	try {
		const result = await pool.query("SELECT status,configuration_revision FROM overlays WHERE id=$1 AND owner_id=$2", [owner.fixture.overlayId, owner.fixture.creatorId]);
		expect(result.rows).toEqual([{ status: "active", configuration_revision: 1 }]);
	} finally {
		await pool.end();
	}
	await page.getByRole("button", { name: "Open Filter Options", exact: true }).click();
	const all = page.getByRole("radio", { name: "All", exact: true });
	await all.focus();
	await all.press("Space");
	await expect(all).toBeChecked();
	await page.keyboard.press("Escape");
	await expect(page.getByText("E2E continuity overlay", { exact: true })).toBeVisible();
});
AfterScenario({ tags: "@filtered-bulk-ui" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.filteredBulkOwner as any;
	if (!owner?.fixture) return;
	const response = await request.delete(`${origin}/api/test/auth-fixture`, { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});
