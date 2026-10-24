import { createBdd } from "playwright-bdd";
import type { Locator } from "@playwright/test";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { preparePresentationFixture, state } from "../support/runner-presentation";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { Given, Then } = createBdd(test);

Given("a branded Runner previews a Pro clip panel above its bottom-left preference", async ({ request, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [world.owner.fixture.creatorId]);
		await pool.query("UPDATE overlays SET show_channel_info=false,show_clip_info=true,show_timer=false,show_progress_bar=false,border_size=0,clip_scale=100,clip_info_x=0,clip_info_y=83,overlay_info_fade_out_seconds=30 WHERE id=$1 AND owner_id=$2", [world.owner.fixture.overlayId, world.owner.fixture.creatorId]);
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner,pro_show_attribution) VALUES($1,$2,'bottom_left',true)", [world.owner.fixture.creatorId, world.runnerId]);
	} finally {
		await pool.end();
	}
});

async function expectThemedShadowClearance(badge: Locator) {
	await expect(badge).toBeVisible();
	await expect.poll(() => badge.evaluate((element) => typeof Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback"))).toBe("function");
	await badge.evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback")());
	const title = badge.locator("..").locator('[data-player-overlay="panel"]').getByText("Controlled Runner clip", { exact: true });
	await expect(title).toBeVisible();
	const measured = await title.evaluate((element) => {
		const panel = element.closest<HTMLElement>('[data-player-overlay="panel"]')!;
		const box = panel.getBoundingClientRect();
		const badge = element.ownerDocument.querySelector('[data-runner-attribution="true"]')!.getBoundingClientRect();
		const root = element.closest("[data-runner-presentation-generation]")!.getBoundingClientRect();
		const style = getComputedStyle(panel),
			scale = Number.parseFloat(style.scale) || 1;
		let left = box.left,
			top = box.top,
			right = box.right,
			bottom = box.bottom;
		for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
			if (shadow.includes("inset")) continue;
			const lengths = (shadow.match(/-?\d*\.?\d+px/g) ?? []).map(Number.parseFloat);
			if (lengths.length < 2) continue;
			const [x, y, blur = 0, spread = 0] = lengths;
			// Independent minimum CSS-shadow bounds; the renderer may be more conservative.
			left = Math.min(left, box.left + (x - blur - spread) * scale);
			right = Math.max(right, box.right + (x + blur + spread) * scale);
			top = Math.min(top, box.top + (y - blur - spread) * scale);
			bottom = Math.max(bottom, box.bottom + (y + blur + spread) * scale);
		}
		const gap = (12 * root.height) / 1080;
		return { shadowBottom: bottom - box.bottom, panelWidth: box.width, panelHeight: box.height, clear: badge.right + gap <= left || right + gap <= badge.left || badge.bottom + gap <= top || bottom + gap <= badge.top };
	});
	expect(measured.panelWidth).toBeGreaterThan(0);
	expect(measured.panelHeight).toBeGreaterThan(0);
	expect(measured.shadowBottom, "The real theme must actually render an outset shadow").toBeGreaterThan(0);
	expect(measured.clear, "Attribution must clear the actual theme shadow as well as the panel border box").toBe(true);
}

Then("the preview and generated attribution clear the actual themed shadow", async ({ page, mcpWorld }) => {
	await expectThemedShadowClearance(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }));
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectThemedShadowClearance(page.getByLabel("Livestream powered by Clipify.us", { exact: true }));
});

Given("a branded Runner previews all corner panels and its progress bar", async ({ request, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [world.owner.fixture.creatorId]);
		await pool.query("UPDATE overlays SET show_channel_info=true,show_clip_info=true,show_timer=true,show_progress_bar=true,border_size=0,clip_scale=100,overlay_info_fade_out_seconds=30 WHERE id=$1 AND owner_id=$2", [world.owner.fixture.overlayId, world.owner.fixture.creatorId]);
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner,pro_show_attribution) VALUES($1,$2,'bottom_left',true)", [world.owner.fixture.creatorId, world.runnerId]);
	} finally {
		await pool.end();
	}
});

async function expectProgressClearance(badge: Locator) {
	await expect(badge).toBeVisible();
	await expect.poll(() => badge.evaluate((element) => typeof Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback"))).toBe("function");
	await badge.evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback")());
	await expect(badge.locator("..").getByText("Controlled Runner clip", { exact: true })).toBeVisible();
	await expect
		.poll(() =>
			badge.evaluate((element) => {
				const doc = element.ownerDocument;
				const root = element.closest("[data-runner-presentation-generation]")!.getBoundingClientRect();
				const box = element.getBoundingClientRect();
				const panels = Array.from(doc.querySelectorAll<HTMLElement>("[data-player-overlay]")).filter((panel) => Number(getComputedStyle(panel).opacity) > 0.01);
				const progress = panels.find((panel) => panel.dataset.playerOverlay === "progress");
				const gap = (12 * root.height) / 1080;
				return {
					progress: Boolean(progress && progress.getBoundingClientRect().height > 0),
					panels: panels.length,
					clear: panels.every((panel) => {
						const rect = panel.getBoundingClientRect();
						return box.right + gap <= rect.left || rect.right + gap <= box.left || box.bottom + gap <= rect.top || rect.bottom + gap <= box.top;
					}),
					fixedFont: getComputedStyle(element.querySelector("span") ?? element).fontSize,
				};
			}),
		)
		.toMatchObject({ progress: true, panels: 4, clear: true });
}

Then("the preview and generated attribution clear all panels and progress", async ({ page, mcpWorld }) => {
	await expectProgressClearance(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }));
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectProgressClearance(page.getByLabel("Livestream powered by Clipify.us", { exact: true }));
});
