import { createBdd } from "playwright-bdd";
import type { Locator } from "@playwright/test";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { preparePresentationFixture, runNativePresentationProbe, state } from "../support/runner-presentation";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { Given, When, Then } = createBdd(test);

Given("a Free Runner plays with a {word} attribution preference", async ({ request, mcpWorld }, corner: string) => {
	expect(["top-left", "top-right", "bottom-left", "bottom-right"]).toContain(corner);
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner) VALUES($1,$2,$3)", [world.owner.fixture.creatorId, world.runnerId, corner.replace("-", "_")]);
	} finally {
		await pool.end();
	}
});

async function expectTitleClearance(badge: Locator) {
	await expect(badge).toBeVisible();
	await expect.poll(() => badge.evaluate((element) => typeof Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback"))).toBe("function");
	await badge.evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback")());
	const title = badge.locator("..").getByText("Controlled Runner clip", { exact: true });
	await expect(title).toBeVisible();
	const panels = badge.locator("..").locator('[data-player-overlay="panel"]');
	await expect(panels).toHaveCount(2);
	const clearances = await panels.evaluateAll((elements) =>
		elements.map((element) => {
			const rect = element.getBoundingClientRect();
			const badge = element.ownerDocument.querySelector('[data-runner-attribution="true"]')!.getBoundingClientRect();
			const gap = (12 * innerHeight) / 1080;
			return { clear: badge.right + gap <= rect.left || rect.right + gap <= badge.left || badge.bottom + gap <= rect.top || rect.bottom + gap <= badge.top, width: rect.width, height: rect.height, badgeWidth: badge.width, badgeHeight: badge.height };
		}),
	);
	for (const clearance of clearances) {
		expect(clearance.width).toBeGreaterThan(0);
		expect(clearance.height).toBeGreaterThan(0);
		expect(clearance.badgeWidth).toBeGreaterThan(0);
		expect(clearance.badgeHeight).toBeGreaterThan(0);
		expect(clearance.clear, "Actual attribution must leave 12 reference pixels around every visible title/channel panel").toBe(true);
	}
}

Then("the preview and generated attribution avoid the visible overlay panels", async ({ page, mcpWorld }) => {
	await expectTitleClearance(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }));
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectTitleClearance(page.getByLabel("Livestream powered by Clipify.us", { exact: true }));
});

async function expectReturnAfterFade(badge: Locator) {
	await expectTitleClearance(badge);
	await expect(badge.locator("..").locator('[data-player-overlay="panel"]')).toHaveCount(0, { timeout: 10000 });
	await expect
		.poll(async () =>
			badge.evaluate((element) => {
				const box = element.getBoundingClientRect();
				const edge = (24 * innerHeight) / 1080;
				return Math.abs(box.left - edge) < 0.1 && Math.abs(box.top - edge) < 0.1;
			}),
		)
		.toBe(true);
}

Then("the attribution avoids visible panels and returns to top-left after they fade", async ({ page, mcpWorld }) => {
	await expectReturnAfterFade(page.frameLocator('iframe[title="Runner appearance preview"]').getByLabel("Livestream powered by Clipify.us", { exact: true }));
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expectReturnAfterFade(page.getByLabel("Livestream powered by Clipify.us", { exact: true }));
});

Given("an admitted branded Runner has a later Pro layout filling its mobile frame", async ({ request, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true, undefined, "Controlled Runner clip with an intentionally wide title that wraps across the broadcast overlay");
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		// The admitted Free broadcast keeps its captured branding policy after upgrade.
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [world.owner.fixture.creatorId]);
		// A Pro owner explicitly retains attribution in this branded-layout fixture.
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,pro_show_attribution) VALUES($1,$2,true)", [world.owner.fixture.creatorId, world.runnerId]);
		await pool.query("UPDATE overlays SET channel_scale=250,clip_scale=250,border_size=32,channel_info_x=35,channel_info_y=16,clip_info_x=35,clip_info_y=89,overlay_info_fade_out_seconds=30 WHERE id=$1 AND owner_id=$2", [world.owner.fixture.overlayId, world.owner.fixture.creatorId]);
	} finally {
		await pool.end();
	}
});

Then("the fully occupied preview reports that the overlay layout must be adjusted", async ({ page, mcpWorld }) => {
	await page.setViewportSize({ width: 360, height: 800 });
	const frame = page.frameLocator('iframe[title="Runner appearance preview"]');
	const body = frame.locator("body");
	await expect.poll(() => body.evaluate((element) => typeof Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback"))).toBe("function");
	await body.evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback")());
	await expect(frame.getByText(state(mcpWorld.input).clipTitle!, { exact: true })).toBeVisible();
	await expect(frame.locator('[data-player-overlay="panel"]')).toHaveCount(2);
	await expect
		.poll(
			() =>
				frame.locator('[data-player-overlay="panel"]').evaluateAll((elements) => {
					const root = elements[0].ownerDocument.querySelector("[data-runner-presentation-generation]")!;
					const canvas = root.getBoundingClientRect();
					const badge = root.querySelector('[data-runner-attribution="true"]')!.getBoundingClientRect();
					const gap = (12 * canvas.height) / 1080,
						edge = (24 * canvas.height) / 1080;
					const boxes = elements.map((element) => {
						const box = element.getBoundingClientRect();
						return { left: box.left - canvas.left, top: box.top - canvas.top, right: box.right - canvas.left, bottom: box.bottom - canvas.top };
					});
					const xs = [edge, canvas.width - badge.width - edge, ...boxes.flatMap((box) => [box.left - badge.width - gap, box.right + gap])];
					const ys = [edge, canvas.height - badge.height - edge, ...boxes.flatMap((box) => [box.top - badge.height - gap, box.bottom + gap])];
					return !xs.some((left) => left >= edge && left + badge.width <= canvas.width - edge && ys.some((top) => top >= edge && top + badge.height <= canvas.height - edge && boxes.every((box) => left + badge.width + gap <= box.left || box.right + gap <= left || top + badge.height + gap <= box.top || box.bottom + gap <= top)));
				}),
			{ message: "Actual paid overlay rectangles must leave no clear region for the fixed badge" },
		)
		.toBe(true);
	await expect(frame.getByRole("alert").filter({ hasText: "Adjust your overlay layout" })).toBeVisible();
});

Then("saving that blocked appearance is refused without changing the profile", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const before = await pool.query("SELECT id,revision,watermark_corner FROM runner_branding_profiles WHERE runner_id=$1 AND owner_id=$2", [world.runnerId, world.owner.fixture.creatorId]);
		await page.getByRole("button", { name: "Save appearance", exact: true }).click();
		await expect(page.getByRole("alert").filter({ hasText: "Adjust your overlay layout" })).toBeVisible();
		await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toHaveCount(0);
		const after = await pool.query("SELECT id,revision,watermark_corner FROM runner_branding_profiles WHERE runner_id=$1 AND owner_id=$2", [world.runnerId, world.owner.fixture.creatorId]);
		expect(after.rows).toEqual(before.rows);
	} finally {
		await pool.end();
	}
});

Then("the known conflict remains blocked when the preview returns to standby", async ({ page, mcpWorld }) => {
	const frame = page.frameLocator('iframe[title="Runner appearance preview"]');
	await frame.locator("body").evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "stopFallback")());
	await expect(frame.locator('[data-player-overlay="panel"]')).toHaveCount(0);
	await expect(frame.getByRole("alert").filter({ hasText: "Adjust your overlay layout" })).toBeVisible();
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const before = await pool.query("SELECT id,revision,watermark_corner FROM runner_branding_profiles WHERE runner_id=$1 AND owner_id=$2", [world.runnerId, world.owner.fixture.creatorId]);
		await page.getByRole("button", { name: "Save appearance", exact: true }).click();
		await expect(page.getByRole("alert").filter({ hasText: "Adjust your overlay layout" })).toBeVisible();
		const after = await pool.query("SELECT id,revision,watermark_corner FROM runner_branding_profiles WHERE runner_id=$1 AND owner_id=$2", [world.runnerId, world.owner.fixture.creatorId]);
		expect(after.rows).toEqual(before.rows);
	} finally {
		await pool.end();
	}
});

Given("a Free Runner previews a {word} broadcast", async ({ request, mcpWorld }, resolution: string) => {
	expect(["720p", "1080p"]).toContain(resolution);
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE stream_sessions SET resolution=$3 WHERE id=$1 AND owner_id=$2", [world.sessionId, world.owner.fixture.creatorId, resolution]);
	} finally {
		await pool.end();
	}
});

Then("its mobile preview uses the configured broadcast resolution", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let resolution: string;
	try {
		const result = await pool.query("SELECT resolution FROM stream_sessions WHERE id=$1 AND owner_id=$2", [world.sessionId, world.owner.fixture.creatorId]);
		expect(result.rows).toHaveLength(1);
		resolution = result.rows[0].resolution;
	} finally {
		await pool.end();
	}
	const expected = resolution === "1080p" ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
	await page.setViewportSize({ width: 360, height: 800 });
	const frame = page.locator('iframe[title="Runner appearance preview"]');
	await frame.scrollIntoViewIfNeeded();
	expect((await frame.boundingBox())!.width).toBeCloseTo(360, 0);
	await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow!.innerWidth)).toBe(expected.width);
	await expect.poll(() => frame.evaluate((element) => (element as HTMLIFrameElement).contentWindow!.innerHeight)).toBe(expected.height);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

When("its native Runner attempts to start the blocked generated layout", async ({ mcpWorld }) => {
	test.setTimeout(120000);
	mcpWorld.result = { status: 200, body: await runNativePresentationProbe(state(mcpWorld.input), { checkBlockedStartup: true }) };
});

Then("no encoder or destination opens and the Runner returns a normal layout refusal", async ({ mcpWorld }) => {
	const result = mcpWorld.result!.body as { startup: { accepted: boolean; encoderOpened: boolean; receivedBytes: number; observedLayout: { status: string; generation: string; panels: number }; status: string } };
	await test.info().attach("blocked-startup-observations", { body: JSON.stringify(result), contentType: "application/json" });
	expect(result.startup.observedLayout).toMatchObject({ status: "blocked", generation: state(mcpWorld.input).generation });
	expect(result.startup.observedLayout.panels).toBeGreaterThan(0);
	expect(result.startup.accepted).toBe(false);
	expect(result.startup.encoderOpened).toBe(false);
	expect(result.startup.receivedBytes).toBe(0);
	expect(result.startup.status).toMatch(/layout|presentation is unavailable/i);
});
