import { createBdd } from "playwright-bdd";
import type { Locator } from "@playwright/test";
import { test, expect } from "../support/mcp-support";
import { preparePresentationFixture, state } from "../support/runner-presentation";
import { measureRunnerAttribution } from "../support/runner-readability";

const { Given, Then } = createBdd(test);

Given("a Free Runner plays the {word} readability fixture", async ({ request, mcpWorld }, background: string) => {
	expect(["light", "dark", "busy"]).toContain(background);
	await preparePresentationFixture(request, mcpWorld, true, background as "light" | "dark" | "busy");
});

async function controlReadabilityPlayback(badge: Locator, command: "startRunnerPlayback" | "startFallback" | "stopFallback") {
	await expect.poll(() => badge.evaluate((element, name) => typeof Reflect.get(element.ownerDocument.defaultView!, name), command)).toBe("function");
	await badge.evaluate((element, name) => Reflect.get(element.ownerDocument.defaultView!, name)(), command);
	await expect
		.poll(() =>
			badge.evaluate((element, stopped) => {
				const videos = [...element.ownerDocument.querySelectorAll("video")];
				return stopped ? videos.every((video) => Number(getComputedStyle(video).opacity) < 0.01 && video.paused) : videos.some((video) => !video.paused && video.currentTime > 0.2);
			}, command === "stopFallback"),
		)
		.toBe(true);
}

async function expectReadableAttribution(badge: Locator, background: string | null, width: number) {
	await expect(badge).toBeVisible();
	await expect(badge.getByText("Livestream powered", { exact: true })).toBeVisible();
	await expect(badge.getByText("by Clipify.us", { exact: true })).toBeVisible();
	const metrics = await measureRunnerAttribution(badge, background !== null);
	if (background === "light") expect(metrics.rawMin, "The controlled decoded frame must actually be light").toBeGreaterThan(240);
	if (background === "dark" || background === null) expect(metrics.rawMax, "The controlled frame must actually be dark").toBeLessThan(20);
	if (background === "busy") {
		expect(metrics.rawMin).toBeLessThan(20);
		expect(metrics.rawMax).toBeGreaterThan(240);
	}
	expect(Math.abs(metrics.surfaceWidth - metrics.viewportWidth)).toBeLessThanOrEqual(0.5);
	expect(Math.abs(metrics.surfaceHeight - metrics.viewportHeight)).toBeLessThanOrEqual(0.5);
	const scale = metrics.surfaceHeight / 1080;
	expect(metrics.font).toBeCloseTo(56 * scale, 1);
	expect(metrics.lineHeight).toBeCloseTo(64 * scale, 1);
	expect(metrics.logoWidth).toBeCloseTo(112 * scale, 1);
	expect(metrics.logoHeight).toBeCloseTo(112 * scale, 1);
	expect(metrics.textOpacity).toBe(0.85);
	expect(metrics.logoOpacity).toBe(0.85);
	expect(metrics.left).toBeGreaterThanOrEqual(0);
	expect(metrics.top).toBeGreaterThanOrEqual(0);
	expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 0.5);
	expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 0.5);
	if (width === 360) {
		expect(metrics.font * metrics.visualScale, "Mobile preview text must physically retain the 10.5px reference minimum").toBeGreaterThanOrEqual(10.49);
		expect(metrics.font * metrics.visualScale).toBeCloseTo(10.5, 1);
	}
	expect(metrics.minimumContrast, "Decoded frame plus actual fixed foreground/backing must provide at least 4.5:1 text contrast").toBeGreaterThanOrEqual(4.5);
}

async function inspectReadabilitySurfaces(badge: Locator, background: string, width: number) {
	await controlReadabilityPlayback(badge, "stopFallback");
	await expectReadableAttribution(badge, null, width);
	await controlReadabilityPlayback(badge, "startRunnerPlayback");
	await expectReadableAttribution(badge, background, width);
	await controlReadabilityPlayback(badge, "startFallback");
	await expectReadableAttribution(badge, background, width);
}

Then("its actual attribution is readable on {word} frames at {int} pixels", async ({ page, mcpWorld }, background: string, width: number) => {
	await page.setViewportSize({ width, height: width === 360 ? 800 : 1080 });
	if (width === 360) {
		const frame = page.locator('iframe[title="Runner appearance preview"]');
		await frame.scrollIntoViewIfNeeded();
		await expect.poll(async () => (await frame.boundingBox())?.width).toBeCloseTo(360, 0);
		const box = await frame.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.width, "The mobile preview must actually use the complete 360px viewport").toBeCloseTo(360, 0);
		expect(box!.x).toBeGreaterThanOrEqual(-0.5);
		expect(box!.x + box!.width).toBeLessThanOrEqual(360.5);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
		expect(
			await frame.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				const y = (rect.top + rect.bottom) / 2;
				return [1, innerWidth - 2].every((x) => document.elementFromPoint(x, y) === element);
			}),
			"Both preview edges must be exposed rather than clipped by an ancestor",
		).toBe(true);
	}
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true });
	await inspectReadabilitySurfaces(preview, background, width);
	await page.locator('iframe[title="Runner appearance preview"]').screenshot({ path: `specs/004-runner-free-pro/tdd/evidence/E2-readable-${background}-${width}-preview.png` });
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.setViewportSize({ width, height: width === 360 ? 203 : 1080 });
	await page.goto(`http://127.0.0.1:3107${url}`);
	await inspectReadabilitySurfaces(page.getByLabel("Livestream powered by Clipify.us", { exact: true }), background, width);
	await page.screenshot({ path: `specs/004-runner-free-pro/tdd/evidence/E2-readable-${background}-${width}-output.png` });
});
