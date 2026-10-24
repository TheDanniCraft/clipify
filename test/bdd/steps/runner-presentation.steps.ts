import { createBdd } from "playwright-bdd";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

import { fixtureHeaders, preparePresentationFixture, runNativePresentationProbe, state, type PresentationWorld } from "../support/runner-presentation";

type PlaybackWindow = Window & { startRunnerPlayback?: () => void };
const { Given, When, Then, AfterScenario } = createBdd(test);
Given("a Free Runner has an active broadcast without playable clips", async ({ request, mcpWorld }) => preparePresentationFixture(request, mcpWorld));
Given("a Free Runner has an active broadcast with playable clips", async ({ request, mcpWorld }) => preparePresentationFixture(request, mcpWorld, true));
Given("a Free Runner has an active live-fallback broadcast with playable clips", async ({ request, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input),
		pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE stream_sessions SET mode='failsafe' WHERE id=$1", [world.sessionId]);
		await pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=benefits_at_start || $2::jsonb WHERE session_id=$1", [world.sessionId, JSON.stringify({ ingestModeAtStart: "failsafe" })]);
	} finally {
		await pool.end();
	}
});

When("the Runner requests its generated presentation", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	world.status = response.status();
	if (world.status === 200) world.body = await response.json();
});

Then("its generated standby visibly credits Clipify", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	expect(world.status, "The assigned active Runner must receive its authorized generated presentation").toBe(200);
	expect(world.body?.url).toBe(`/runner/presentation/${world.sessionId}`);
	await page.goto(`http://127.0.0.1:3107${world.body!.url}`);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-presentation-generation", world.generation);
	await expect(page.getByText("Livestream powered", { exact: true })).toBeVisible();
	await expect(page.getByText("by Clipify.us", { exact: true })).toBeVisible();
	await page.screenshot({ path: "specs/004-runner-free-pro/tdd/evidence/E1-free-standby.png" });
	await page.goto(`http://127.0.0.1:3107${world.body!.url}?watermark=false&runnerPro=true&attributionRequired=false`);
	await expect(page.getByText("Livestream powered", { exact: true })).toBeVisible();
	await expect(page.getByText("by Clipify.us", { exact: true })).toBeVisible();
});

When("the owner opens the ordinary overlay source", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const response = await page.goto(`http://127.0.0.1:3107/overlay/${world.owner.fixture.overlayId}?secret=${encodeURIComponent(world.sourceSecret!)}&standby=true`);
	world.status = response?.status();
});

Then("the ordinary overlay contains its player without Runner attribution", async ({ page, mcpWorld }) => {
	expect(state(mcpWorld.input).status).toBe(200);
	await expect.poll(() => page.evaluate(() => typeof (window as PlaybackWindow).startRunnerPlayback)).toBe("function");
	await expect(page.locator("[data-runner-attribution]")).toHaveCount(0);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveCount(0);
	await expect(page.getByText("Livestream powered", { exact: true })).toHaveCount(0);
});

When("the Runner starts generated clip playback", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	world.status = response.status();
	if (world.status !== 200) return;
	world.body = await response.json();
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.goto(`http://127.0.0.1:3107${world.body!.url}`);
	await page.waitForFunction(() => typeof (window as PlaybackWindow).startRunnerPlayback === "function");
	await page.evaluate(() => (window as PlaybackWindow).startRunnerPlayback?.());
});

Then("its playing clip visibly retains Clipify attribution", async ({ page, mcpWorld }) => {
	expect(state(mcpWorld.input).status).toBe(200);
	await expect
		.poll(() =>
			page
				.locator("video")
				.first()
				.evaluate((video) => (video as HTMLVideoElement).currentTime),
		)
		.toBeGreaterThan(0.2);
	await expect(page.getByText("Livestream powered", { exact: true })).toBeVisible();
	await expect(page.getByText("by Clipify.us", { exact: true })).toBeVisible();
	await page.screenshot({ path: "specs/004-runner-free-pro/tdd/evidence/E1-free-playback.png" });
});

When("its live input disconnects and then returns through the native Runner", async ({ mcpWorld }) => {
	test.setTimeout(120000);
	const world = state(mcpWorld.input);
	world.nativeResult = await runNativePresentationProbe<NonNullable<PresentationWorld["nativeResult"]>>(world);
});

Then("only the generated fallback is branded in the encoded output", async ({ mcpWorld }) => {
	const result = state(mcpWorld.input).nativeResult!;
	await test.info().attach("encoded-output-observations", { body: JSON.stringify(result), contentType: "application/json" });
	await writeFile(test.info().outputPath("encoded-output-observations.json"), JSON.stringify(result, null, 2) + "\n");
	expect(result.authenticatedPresentation).toBe(true);
	expect(result.realPlayback).toBe(true);
	expect(result.live.redPixels).toBeGreaterThan(50000);
	expect(result.live.whitePixels).toBeLessThan(5);
	expect(result.fallback.bluePixels).toBeGreaterThan(30000);
	expect(result.fallback.attributionVisible).toBe(true);
	expect(result.fallback.attributionWhitePixels).toBeGreaterThan(40);
	expect(result.returned.redPixels).toBeGreaterThan(50000);
	expect(result.returned.whitePixels).toBeLessThan(5);
});

AfterScenario({ tags: "@runner-presentation-browser" }, async ({ request, mcpWorld }) => {
	const world = state(mcpWorld.input);
	if (!world) return;
	const { fixture } = world.owner;
	if (world.clipId) {
		const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
		try {
			await pool.query(`DELETE FROM "twitchCache" WHERE type='clip' AND key=$1`, [`clip:${fixture.creatorId}:${world.clipId}`]);
		} finally {
			await pool.end();
		}
	}
	const response = await request.delete("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: fixture.authUserId, creatorId: fixture.creatorId, organizationIds: [fixture.creatorOrganizationId, fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});
