import { openConsentPage } from "../../support/consent-page";
import { openRunnerAppearance } from "../../support/runner/editor";
import { createBdd } from "playwright-bdd";
import type { Locator } from "@playwright/test";
import { test, expect } from "../support/mcp-support";
import { state } from "../support/runner-presentation";

const { When, Then } = createBdd(test);

When("its owner opens the Runner appearance settings", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	await page.context().addCookies([world.owner.cookie]);
	await openConsentPage(page);
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.goto(`http://127.0.0.1:3107/dashboard/runners/${world.runnerId}`);
	await openRunnerAppearance(page);
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
	const corner = page.getByRole("radiogroup", { name: "Attribution position", exact: true });
	await expect(corner, "The owner must have a visual attribution position picker").toBeVisible();
	const option = corner.getByRole("radio", { name: label, exact: true });
	await corner.getByText(label, { exact: true }).click();
	await expect(option).toBeChecked();
	await expectCornerAttribution(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(option).toBeChecked();
	await expectCornerAttribution(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectCornerAttribution(page.getByLabel("Livestream powered by Clipify.us", { exact: true }), selectedCorner);
});
