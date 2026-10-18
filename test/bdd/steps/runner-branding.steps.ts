import { createBdd } from "playwright-bdd";
import type { Locator } from "@playwright/test";
import { test, expect } from "../support/mcp-support";
import { state } from "../support/runner-presentation";

const { When, Then } = createBdd(test);

When("its owner opens the Runner appearance settings", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	await page.context().addCookies([world.owner.cookie]);
	await page.goto("http://127.0.0.1:3107/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.goto(`http://127.0.0.1:3107/dashboard/runners/${world.runnerId}`);
	await expect(page.getByRole("heading", { name: "Destinations", exact: true })).toBeVisible();
});

async function expectCornerAttribution(badge: Locator, selectedCorner: string) {
	await expect(badge).toBeVisible();
	await expect(badge.getByText("Livestream powered", { exact: true })).toBeVisible();
	await expect(badge.getByText("by Clipify.us", { exact: true })).toBeVisible();
	const geometry = await badge.evaluate((element) => {
		const box = element.getBoundingClientRect();
		return { left: box.left, top: box.top, right: innerWidth - box.right, bottom: innerHeight - box.bottom, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
	});
	const scale = Math.min(geometry.viewportWidth / 1920, geometry.viewportHeight / 1080);
	expect(selectedCorner.endsWith("left") ? geometry.left : geometry.right).toBeCloseTo(24 * scale, 0);
	expect(selectedCorner.startsWith("top") ? geometry.top : geometry.bottom).toBeCloseTo(24 * scale, 0);
	expect(geometry.width).toBeGreaterThan(0);
	expect(geometry.height).toBeGreaterThan(0);
	const fontSize = await badge.getByText("Livestream powered", { exact: true }).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
	expect(fontSize).toBeCloseTo(56 * scale, 0);
}

Then("choosing {word} persists and the preview and generated presentation use that corner", async ({ page, mcpWorld }, selectedCorner: string) => {
	const label = ({ "top-left": "Top left", "top-right": "Top right", "bottom-left": "Bottom left", "bottom-right": "Bottom right" } as Record<string, string>)[selectedCorner];
	const corner = page.getByRole("button", { name: /Attribution corner$/ });
	await expect(corner, "The owner must have an attribution corner selector").toBeVisible();
	await corner.click();
	const option = page.getByRole("option", { name: label, exact: true });
	await expect(option, `The owner must be able to choose ${label}`).toBeVisible();
	await option.click();
	await expectCornerAttribution(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await expect(corner).toContainText(label);
	await expectCornerAttribution(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectCornerAttribution(page.getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
});
