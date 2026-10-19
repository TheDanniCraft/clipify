import { openRunnerAppearance } from "../../support/runner/editor";
import { createBdd } from "playwright-bdd";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "../support/runner-free-pro";
import { preparePresentationFixture, state, fixtureHeaders } from "../../bdd/support/runner-presentation";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";
const { Given, When, Then, AfterScenario } = createBdd(test);
Given("a Pro creator has a saved custom standby and a playable generated source", async ({ request, page, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true);
	const world = state(mcpWorld.input);
	const sharp = (await import("sharp")).default;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	const logoId = randomUUID(),
		backgroundId = randomUUID();
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [world.owner.fixture.creatorId]);
		await pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=benefits_at_start || '{\"runnerPro\":true}'::jsonb WHERE session_id=$1", [world.sessionId]);
		for (const asset of [
			{ id: logoId, kind: "logo", color: { r: 180, g: 40, b: 120 } },
			{ id: backgroundId, kind: "background", color: { r: 20, g: 60, b: 90 } },
		]) {
			const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: asset.color } })
				.png()
				.toBuffer();
			await pool.query("INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES($1,$2,$3,'image/png',$4,32,32,$5,$6)", [asset.id, world.owner.fixture.creatorId, asset.kind, bytes.length, createHash("sha256").update(bytes).digest("hex"), bytes]);
		}
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner,pro_show_attribution,standby_background_color,logo_asset_id,background_asset_id,message) VALUES($1,$2,'bottom_right',true,'#16324f',$3,$4,'Back soon <3')", [world.owner.fixture.creatorId, world.runnerId, logoId, backgroundId]);
	} finally {
		await pool.end();
	}
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
	await openRunnerAppearance(page);
	await expect(page.getByTitle("Runner appearance preview")).toBeVisible();
});
When("they review real standby and clip previews at all four attribution corners", async ({ page }) => {
	await page.getByRole("tab", { name: "Standby", exact: true }).click();
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]');
	await expect(preview.getByRole("img", { name: "Standby logo", exact: true })).toBeVisible();
	await expect(preview.getByText("Back soon <3", { exact: true })).toBeVisible();
	for (const corner of [
		{ label: "Top left", right: false, bottom: false },
		{ label: "Top right", right: true, bottom: false },
		{ label: "Bottom left", right: false, bottom: true },
		{ label: "Bottom right", right: true, bottom: true },
	]) {
		await page.getByRole("radiogroup", { name: "Attribution position", exact: true }).getByText(corner.label, { exact: true }).click();
		const badge = preview.getByLabel("Livestream powered by Clipify.us", { exact: true });
		await expect(badge).toBeVisible();
		await expect
			.poll(async () => {
				const geometry = await badge.evaluate((element) => {
					const box = element.getBoundingClientRect();
					return { left: box.left, right: innerWidth - box.right, top: box.top, bottom: innerHeight - box.bottom, scale: innerHeight / 1080 };
				});
				return Math.max(Math.abs((corner.right ? geometry.right : geometry.left) - 24 * geometry.scale), Math.abs((corner.bottom ? geometry.bottom : geometry.top) - 24 * geometry.scale));
			})
			.toBeLessThan(0.5);

		const geometry = await badge.evaluate((element) => {
			const box = element.getBoundingClientRect();
			return { left: box.left, right: innerWidth - box.right, top: box.top, bottom: innerHeight - box.bottom, scale: innerHeight / 1080 };
		});
		expect(corner.right ? geometry.right : geometry.left).toBeCloseTo(24 * geometry.scale, 0);
		expect(corner.bottom ? geometry.bottom : geometry.top).toBeCloseTo(24 * geometry.scale, 0);
	}
	await page.getByRole("tab", { name: "Clips", exact: true }).click();
	await expect
		.poll(() =>
			preview
				.locator("video")
				.first()
				.evaluate((video) => (video as HTMLVideoElement).currentTime),
		)
		.toBeGreaterThan(0.2);
	await expect(preview.locator("[data-runner-standby]")).toHaveCount(0);
	await page.getByRole("tab", { name: "Standby", exact: true }).click();
	await expect(preview.locator("[data-runner-standby]")).toBeVisible();
});
Then("clearing optional images previews the saved color and message before applying them", async ({ page, mcpWorld }) => {
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]');
	await page.getByRole("button", { name: "Remove logo", exact: true }).click();
	await page.getByRole("button", { name: "Remove background image", exact: true }).click();
	await expect(preview.getByRole("img", { name: "Standby logo", exact: true })).toHaveCount(0);
	await expect(preview.getByRole("img", { name: "Standby background", exact: true })).toHaveCount(0);
	await expect(preview.locator("[data-runner-standby]")).toHaveCSS("background-color", "rgb(22, 50, 79)");
	await expect(preview.getByText("Back soon <3", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expect(page.locator("[data-runner-standby]")).toHaveCSS("background-color", "rgb(22, 50, 79)");
	await expect(page.getByText("Back soon <3", { exact: true })).toBeVisible();
	await expect(page.getByRole("img", { name: "Standby logo", exact: true })).toHaveCount(0);
	await expect(page.getByRole("img", { name: "Standby background", exact: true })).toHaveCount(0);
	await expect(page.getByLabel("Livestream powered by Clipify.us", { exact: true })).toBeVisible();
});
AfterScenario({ tags: "@runner-standby-acceptance" }, async ({ request, mcpWorld }) => {
	const world = state(mcpWorld.input);
	if (!world) return;
	const fixture = world.owner.fixture;
	const response = await request.delete("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: fixture.authUserId, creatorId: fixture.creatorId, organizationIds: [fixture.creatorOrganizationId, fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});
