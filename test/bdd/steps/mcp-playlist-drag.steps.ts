import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import type { Page } from "@playwright/test";
const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
const headers = { Authorization: "Bearer clipify-playwright-auth-fixture" };

Given("a native playlist editor contains two saved clips for dragging", async ({ page, request, mcpWorld }) => {
	test.info().setTimeout(120000);
	const response = await request.post(`${origin}/api/test/auth-fixture`, { headers, data: { withPlaylist: true, withPlaylistItems: true, withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	mcpWorld.input = { dragOwner: owner };
	await page.context().addCookies([owner.cookie]);
	await page.goto(`${origin}/dashboard/playlist/${owner.fixture.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Browser playlist", { timeout: 30000 });
	const support = page.getByRole("button", { name: "Enable support chat", exact: true });
	await support.focus();
	await support.press("Enter");
	const reject = page.getByRole("dialog").getByRole("button", { name: "Reject optional", exact: true });
	await expect(reject).toBeVisible();
	await Promise.all([page.waitForEvent("load"), reject.click()]);
	await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Browser playlist");
	await expect(page.locator("li[draggable=true]")).toHaveCount(2);
});
When("the owner drags the first clip below the second and drops it", async ({ page }) => {
	const first = page.locator("li[draggable=true]").filter({ hasText: "ClipFirst" });
	const second = page.locator("li[draggable=true]").filter({ hasText: "ClipSecond" });
	await first.dispatchEvent("dragstart");
	await second.dispatchEvent("dragover");
	await second.dispatchEvent("drop");
	await first.dispatchEvent("dragend");
});
Then("the changed clip order can be saved and survives reloading", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Save Playlist", exact: true })).toBeEnabled();
	await expect(page.locator("li[draggable=true]").nth(0)).toContainText("ClipSecond");
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save Playlist", exact: true })).toBeDisabled();
	await page.reload();
	await expect(page.locator("li[draggable=true]").nth(0)).toContainText("ClipSecond");
	await expect(page.locator("li[draggable=true]").nth(1)).toContainText("ClipFirst");
});
async function openLinkedOverlay(page: Page, owner: { fixture: { overlayId: string; playlistId: string } }) {
	await page.goto(`${origin}/dashboard/overlay/${owner.fixture.overlayId}`);
	await page.getByRole("button", { name: /All Clips Overlay Type/ }).click();
	await page.getByRole("option", { name: "Playlist", exact: true }).click();
	const selector = page.getByRole("button", { name: /^(?:Select an item|Browser playlist(?: \(\d+\))?) Playlist$/ });
	await expect(selector).toBeVisible();
	await selector.click();
	const playlist = page.getByRole("option", { name: "Browser playlist (2)", exact: true });
	await expect(playlist).toBeVisible();
	await playlist.click();
	await expect(page.getByRole("button", { name: "Manage", exact: true })).toBeEnabled();
	await expect(page.getByRole("button", { name: "Save Overlay Settings", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save Overlay Settings", exact: true })).toBeDisabled();
}
When("the owner follows Manage from the linked overlay settings", async ({ page, mcpWorld }) => {
	const owner = mcpWorld.input?.dragOwner as { fixture: { overlayId: string; playlistId: string } };
	await openLinkedOverlay(page, owner);
	await expect(page.getByRole("button", { name: "Manage", exact: true })).toBeVisible({ timeout: 30000 });
	await page.getByRole("button", { name: "Manage", exact: true }).click();
	await expect(page).toHaveURL(`${origin}/dashboard/playlist/${owner.fixture.playlistId}`);
});
When("the owner opens quick editing from the linked overlay settings", async ({ page, mcpWorld }) => {
	const owner = mcpWorld.input?.dragOwner as { fixture: { overlayId: string; playlistId: string } };
	await openLinkedOverlay(page, owner);
	const quickEdit = page.getByRole("button", { name: "Quick edit playlist", exact: true });
	await expect(quickEdit).toBeVisible();
	await quickEdit.click();
});
Then("the owned playlist opens in an inline dialog without leaving overlay settings", async ({ page, mcpWorld }) => {
	const owner = mcpWorld.input?.dragOwner as { fixture: { overlayId: string } };
	await expect(page).toHaveURL(`${origin}/dashboard/overlay/${owner.fixture.overlayId}`);
	await expect(page.getByRole("dialog", { name: /^Manage Playlist:/ })).toContainText("Manage Playlist: Browser playlist");
	await expect(page.getByRole("dialog", { name: /^Manage Playlist:/ }).getByPlaceholder("Playlist name")).toHaveValue("Browser playlist");
	await expect(page.getByRole("dialog", { name: /^Manage Playlist:/ }).locator("li[draggable=true]")).toHaveCount(2);
});
Then("the quick-edited order saves and appears in the full playlist editor", async ({ page }) => {
	const dialog = page.getByRole("dialog", { name: /^Manage Playlist:/ });
	await expect(dialog.getByRole("button", { name: "Save Playlist", exact: true })).toBeEnabled();
	await expect(dialog.locator("li[draggable=true]").nth(0)).toContainText("ClipSecond");
	await dialog.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(dialog.getByRole("button", { name: "Save Playlist", exact: true })).toBeDisabled();
	await dialog.getByRole("button", { name: "Close", exact: true }).click();
	await page.getByRole("button", { name: "Manage", exact: true }).click();
	await expect(page.locator("li[draggable=true]").nth(0)).toContainText("ClipSecond");
	await expect(page.locator("li[draggable=true]").nth(1)).toContainText("ClipFirst");
});
Then("the owned playlist editor shows its saved name and both clips", async ({ page }) => {
	await expect(page.getByPlaceholder("Playlist name")).toHaveValue("Browser playlist", { timeout: 30000 });
	await expect(page.locator("li[draggable=true]")).toHaveCount(2);
});
AfterScenario({ tags: "@playlist-drag-ui" }, async ({ request, mcpWorld }) => {
	const owner = mcpWorld.input?.dragOwner as { fixture?: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string } } | undefined;
	if (!owner?.fixture) return;
	const removed = await request.delete(`${origin}/api/test/auth-fixture`, { headers, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
	expect(removed.status()).toBe(204);
});
