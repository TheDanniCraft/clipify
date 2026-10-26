import { openRunnerAppearance, openRunnerDestinations } from "../../support/runner/editor";
import type { Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test, expect } from "../support/mcp-support";
import { preparePresentationFixture, state as presentationState } from "../support/runner-presentation";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { Given, When, Then, AfterScenario } = createBdd(test);
const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
type OwnerFixture = { fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string }; cookie: Parameters<import("@playwright/test").BrowserContext["addCookies"]>[0][number] };
type ManualWorld = { owner: OwnerFixture; runnerId: string };

Given("a Free creator is configuring a local Runner in the browser", async ({ page, request, mcpWorld }) => {
	const response = await request.post("http://127.0.0.1:3107/api/test/auth-fixture", { headers: fixtureHeaders, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = (await response.json()) as OwnerFixture;
	expect(owner.fixture.creatorId).toMatch(/^e2e-creator-/);
	const runnerId = randomUUID();
	mcpWorld.input = { runnerManual: { owner, runnerId } satisfies ManualWorld };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [owner.fixture.creatorId]);
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Free local runner',$3,'online',now(),2,$4::jsonb)", [runnerId, owner.fixture.creatorId, randomUUID(), JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"])]);
	} finally {
		await pool.end();
	}
	await page.context().addCookies([owner.cookie]);
	// The banner is policy-dependent. Use the existing always-available preferences
	// control and its real keyboard flow instead of guessing whether a banner appears.
	await page.goto("http://127.0.0.1:3107/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.goto(`http://127.0.0.1:3107/dashboard/runners/${runnerId}`);
	await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
});

When("they choose Live fallback with Manual control and save its destination", async ({ page }) => {
	const behavior = page.getByRole("button", { name: /Broadcast behavior$/ });
	await expect(behavior).toContainText("Clip playback");
	await behavior.click();
	await page.getByRole("option", { name: "Live fallback", exact: true }).click();
	const control = page.getByRole("button", { name: / Control$/ });
	await expect(control).toContainText("Manual");
	await control.click();
	await expect(page.getByRole("option", { name: /Scheduled/ })).toBeDisabled();
	await expect(page.getByRole("option", { name: /Scheduled/ }).getByRole("img", { name: "Requires Pro" })).toBeVisible();
	await page.keyboard.press("Escape");
	const manager = await openRunnerDestinations(page);
	await manager.getByRole("button", { name: "Add destination", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Add destination", exact: true });
	await editor.getByLabel("Destination name", { exact: true }).fill("Twitch");
	await editor.getByRole("tab", { name: "Stream key", exact: true }).click();
	await editor.getByLabel("Destination stream key", { exact: true }).fill("fixture-runner-stream-key");
	await editor.getByRole("button", { name: "Save destination", exact: true }).click();
	await expect(editor).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(manager).not.toBeVisible();
	const selected = page.getByRole("group", { name: "Broadcast destinations" }).getByRole("button", { name: /Broadcast destinations$/ });
	await expect(selected).toContainText("Twitch");
	await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
	await expect(selected).toContainText("Twitch");
	await expect(page.getByRole("textbox", { name: /Stream Key/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
});

Then("the browser retains manual fallback and keeps scheduling unavailable", async ({ page }) => {
	await page.reload();
	await expect(page.getByRole("button", { name: /Broadcast behavior$/ })).toContainText("Live fallback");
	await expect(page.getByRole("button", { name: / Control$/ })).toContainText("Manual");
	await expect(page.getByText("rtmp://localhost:1935/live", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: / Control$/ }).click();
	await expect(page.getByRole("option", { name: /Scheduled/ })).toBeDisabled();
	await expect(page.getByRole("option", { name: /Scheduled/ }).getByRole("img", { name: "Requires Pro" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByText("Runner add-on required", { exact: false })).toHaveCount(0);
});

When("another Runner already occupies their Free broadcast slot", async ({ mcpWorld }) => {
	const state = mcpWorld.input?.runnerManual as ManualWorld;
	const runnerId = randomUUID(),
		sessionId = randomUUID();
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Other active Runner',$3)", [runnerId, state.owner.fixture.creatorId, randomUUID()]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,desired_state,actual_state) SELECT $1,owner_id,$2,overlay_id,'24/7','running','running' FROM stream_sessions WHERE runner_id=$3", [sessionId, runnerId, state.runnerId]);
		await pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,session_id,execution_generation,state,configuration_revision,benefits_at_start) VALUES($1,$2,$3,$4,'active',1,$5::jsonb)", [state.owner.fixture.creatorId, runnerId, sessionId, randomUUID(), JSON.stringify({ runnerPro: false })]);
	} finally {
		await pool.end();
	}
});

When("they request Start for this Runner", async ({ page }) => {
	await page.getByRole("button", { name: "Start", exact: true }).click();
});

Then("the browser explains the denied Start and this broadcast remains stopped", async ({ page, mcpWorld }) => {
	await expect(page.getByText("Cannot start broadcast", { exact: true })).toBeVisible();
	await expect(page.getByText(/Free allows one active broadcast|previous Runner has not confirmed/)).toBeVisible();
	const state = mcpWorld.input?.runnerManual as ManualWorld;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const sessions = (await pool.query("SELECT desired_state FROM stream_sessions WHERE runner_id=$1", [state.runnerId])).rows;
		expect(sessions).toEqual([{ desired_state: "stopped" }]);
	} finally {
		await pool.end();
	}
});

When("their Pro broadcast reports one retrying and one live destination", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.runnerManual as ManualWorld;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [state.owner.fixture.creatorId]);
		const session = (await pool.query("SELECT s.id,s.configuration_revision,d.destination_id FROM stream_sessions s JOIN stream_session_destinations d ON d.session_id=s.id WHERE s.runner_id=$1", [state.runnerId])).rows[0];
		const targetId = randomUUID();
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key) SELECT $1,owner_id,'YouTube','youtube',rtmp_url,encrypted_stream_key FROM runner_destinations WHERE id=$2", [targetId, session.destination_id]);
		await pool.query("INSERT INTO stream_session_destinations(owner_id,session_id,destination_id,position) VALUES($1,$2,$3,1)", [state.owner.fixture.creatorId, session.id, targetId]);
		await pool.query("UPDATE stream_sessions SET desired_state='running',actual_state='running' WHERE id=$1", [session.id]);
		await pool.query("UPDATE runners SET last_heartbeat_at=now() WHERE id=$1", [state.runnerId]);
		const outputs = [
			{ id: session.destination_id, state: "retrying" },
			{ id: targetId, state: "streaming" },
		];
		await pool.query("INSERT INTO runner_broadcast_admissions(owner_id,runner_id,session_id,execution_generation,state,configuration_revision,benefits_at_start,target_ids_snapshot,output_states) VALUES($1,$2,$3,$4,'active',$5,$6::jsonb,$7::uuid[],$8::jsonb)", [state.owner.fixture.creatorId, state.runnerId, session.id, randomUUID(), session.configuration_revision, JSON.stringify({ runnerPro: true }), [session.destination_id, targetId], JSON.stringify(outputs)]);
	} finally {
		await pool.end();
	}
	await page.reload();
});

Then("the browser shows each named destination's own status", async ({ page, mcpWorld }) => {
	const selector = page.getByRole("group", { name: "Broadcast destinations" });
	await expect(selector.getByRole("status", { name: "Twitch: Retrying", exact: true })).toBeVisible();
	await expect(selector.getByRole("status", { name: "YouTube: Live", exact: true })).toBeVisible();
	const state = mcpWorld.input?.runnerManual as ManualWorld;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const report = (await pool.query("SELECT output_states FROM runner_broadcast_admissions WHERE runner_id=$1 AND state='active'", [state.runnerId])).rows[0].output_states;
		await pool.query("UPDATE runner_broadcast_admissions SET output_states='[]'::jsonb WHERE runner_id=$1 AND state='active'", [state.runnerId]);
		await expect(selector.getByRole("status", { name: "Twitch: Awaiting status", exact: true })).toBeVisible();
		const trigger = selector.getByRole("button", { name: /Broadcast destinations$/ });
		const awaiting = await trigger.boundingBox();
		const savePosition = await page.getByRole("button", { name: "Save Configuration", exact: true }).boundingBox();
		await pool.query("UPDATE runner_broadcast_admissions SET output_states=$2::jsonb WHERE runner_id=$1 AND state='active'", [state.runnerId, JSON.stringify(report)]);
		await expect(selector.getByRole("status", { name: "YouTube: Live", exact: true })).toBeVisible();
		expect(await trigger.boundingBox()).toEqual(awaiting);
		expect(await page.getByRole("button", { name: "Save Configuration", exact: true }).boundingBox()).toEqual(savePosition);
	} finally {
		await pool.end();
	}
	await selector.getByRole("button", { name: /Broadcast destinations$/ }).click();
	await expect(page.getByRole("option", { name: /^Twitch\b/ })).toContainText("Retrying");
	await expect(page.getByRole("option", { name: /^YouTube\b/ })).toContainText("Live");
	await page.getByRole("option", { name: /^Twitch\b/ }).press("Escape");
	await expect(selector.getByRole("button", { name: /Broadcast destinations$/ })).toHaveAttribute("aria-expanded", "false");
	await expect(page.getByRole("heading", { name: "Destination status" })).toHaveCount(0);
	for (const theme of ["dark", "light"]) {
		await page.evaluate((theme) => {
			document.documentElement.classList.remove("dark", "light");
			document.documentElement.classList.add(theme);
			document.documentElement.style.colorScheme = theme;
		}, theme);
		for (const width of [1280, 390]) {
			await page.setViewportSize({ width, height: 960 });
			const trigger = selector.getByRole("button", { name: /Broadcast destinations$/ });
			await expect(trigger).toBeVisible();
			const closed = await trigger.boundingBox();
			await trigger.focus();
			await page.keyboard.press("ArrowDown");
			await expect(page.getByRole("option", { name: /^YouTube\b/ })).toBeVisible();
			await page.screenshot({ path: test.info().outputPath(`destination-status-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
			await page.getByRole("option", { name: /^YouTube\b/ }).press("Escape");
			await expect(trigger).toHaveAttribute("aria-expanded", "false");
			await expect(trigger).toBeFocused();
			expect(await trigger.boundingBox()).toEqual(closed);
		}
	}
});

AfterScenario({ tags: "@runner-manual-browser" }, async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.runnerManual as ManualWorld | undefined;
	if (!state) return;
	const response = await request.delete("http://127.0.0.1:3107/api/test/auth-fixture", { maxRetries: 2, headers: fixtureHeaders, data: { authUserId: state.owner.fixture.authUserId, creatorId: state.owner.fixture.creatorId, organizationIds: [state.owner.fixture.creatorOrganizationId, state.owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});

Given("a Pro Runner has an active broadcast with playable clips", async ({ request, mcpWorld }) => {
	await preparePresentationFixture(request, mcpWorld, true);
	const world = presentationState(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [world.owner.fixture.creatorId]);
		await pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=benefits_at_start || $2::jsonb WHERE session_id=$1", [world.sessionId, JSON.stringify({ runnerPro: true })]);
	} finally {
		await pool.end();
	}
});

async function verifyPreviewAttribution(page: Page, enabled: boolean) {
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]');
	await expect.poll(() => preview.locator("body").evaluate((element) => typeof Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback"))).toBe("function");
	await preview.locator("body").evaluate((element) => Reflect.get(element.ownerDocument.defaultView!, "startRunnerPlayback")());
	await expect
		.poll(() =>
			preview
				.locator("video")
				.first()
				.evaluate((video) => (video as HTMLVideoElement).currentTime),
		)
		.toBeGreaterThan(0.2);
	const surface = page.frameLocator('iframe[title="Runner appearance preview"]').locator("[data-runner-presentation-generation]");
	await expect(surface).toHaveAttribute("data-runner-layout-status", enabled ? "placed" : "clean");
	await expect(page.frameLocator('iframe[title="Runner appearance preview"]').locator("[data-runner-attribution]")).toHaveCount(enabled ? 1 : 0);
}

async function verifySavedAttribution(page: Page, mcpWorld: { input?: Record<string, unknown> }, enabled: boolean) {
	const attribution = page.getByRole("switch", { name: "Show Clipify attribution", exact: true });
	await expect(attribution, "Pro owners need an explicit saved attribution choice").toBeVisible();
	await expect(attribution).toBeEnabled();
	if ((await attribution.isChecked()) !== enabled) {
		await attribution.focus();
		await attribution.press("Space");
	}
	await expect(attribution).toBeChecked({ checked: enabled });
	await verifyPreviewAttribution(page, enabled);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(attribution).toBeChecked({ checked: enabled });
	await verifyPreviewAttribution(page, enabled);
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await page.waitForFunction(() => typeof (window as Window & { startRunnerPlayback?: () => void }).startRunnerPlayback === "function");
	await page.evaluate(() => (window as Window & { startRunnerPlayback?: () => void }).startRunnerPlayback?.());
	await expect
		.poll(() =>
			page
				.locator("video")
				.first()
				.evaluate((video) => (video as HTMLVideoElement).currentTime),
		)
		.toBeGreaterThan(0.2);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-layout-status", enabled ? "placed" : "clean");
	await expect(page.locator("[data-runner-attribution]")).toHaveCount(enabled ? 1 : 0);
}

Then("choosing branding off persists clean preview and generated playback", async ({ page, mcpWorld }) => verifySavedAttribution(page, mcpWorld, false));

Then("choosing branding on persists branded preview and generated playback", async ({ page, mcpWorld }) => verifySavedAttribution(page, mcpWorld, true));

When("its admitted paid deadline is reached during generated playback", async ({ page, mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const deadline = Date.now() + 20000;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("UPDATE users SET plan='free' WHERE id=$1", [world.owner.fixture.creatorId]);
		await pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES($1,'pro_access','reverse_trial',now()-interval '1 hour',$2)", [world.owner.fixture.creatorId, new Date(deadline)]);
		await pool.query("UPDATE runner_broadcast_admissions SET benefits_at_start=benefits_at_start || $2::jsonb WHERE session_id=$1", [world.sessionId, JSON.stringify({ runnerPro: true, validUntil: new Date(deadline).toISOString() })]);
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner,pro_show_attribution) VALUES($1,$2,'top_left',false)", [world.owner.fixture.creatorId, world.runnerId]);
	} finally {
		await pool.end();
	}
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await page.waitForFunction(() => typeof (window as Window & { startRunnerPlayback?: () => void }).startRunnerPlayback === "function");
	await page.evaluate(() => (window as Window & { startRunnerPlayback?: () => void }).startRunnerPlayback?.());
	const video = page.locator("video").first();
	await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0.2);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-layout-status", "clean");
	await expect(page.locator("[data-runner-attribution]")).toHaveCount(0);
	expect(Date.now(), "Fixture must still be paid before the observed transition").toBeLessThan(deadline);
	const beforeTime = await video.evaluate((element, marker) => {
		(element as HTMLVideoElement).dataset.expiryContinuity = marker;
		return (element as HTMLVideoElement).currentTime;
	}, world.generation);
	mcpWorld.input = { ...mcpWorld.input, runnerPresentationExpiry: { deadline, beforeTime } };
});

Then("required branding returns while its original clip and execution keep running", async ({ page, mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const { deadline, beforeTime } = mcpWorld.input!.runnerPresentationExpiry as { deadline: number; beforeTime: number };
	await expect(page.getByLabel("Livestream powered by Clipify.us", { exact: true })).toBeVisible({ timeout: Math.max(0, deadline - Date.now()) + 5000 });
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-presentation-generation", world.generation);
	const originalVideo = page.locator(`video[data-expiry-continuity="${world.generation}"]`);
	await expect(originalVideo).toHaveCount(1);
	await expect.poll(() => originalVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(beforeTime);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const execution = (await pool.query("SELECT state,execution_generation FROM runner_broadcast_admissions WHERE session_id=$1", [world.sessionId])).rows;
		expect(execution).toEqual([{ state: "active", execution_generation: world.generation }]);
		const settings = (await pool.query("SELECT watermark_corner,pro_show_attribution,revision FROM runner_branding_profiles WHERE runner_id=$1", [world.runnerId])).rows;
		expect(settings).toEqual([{ watermark_corner: "top_left", pro_show_attribution: false, revision: 1 }]);
	} finally {
		await pool.end();
	}
});

When("its owner renews Pro before that deadline", async ({ mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const { deadline } = mcpWorld.input!.runnerPresentationExpiry as { deadline: number };
	expect(Date.now()).toBeLessThan(deadline);
	const renewedDeadline = deadline + 60000;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		const renewed = await pool.query("UPDATE entitlement_grants SET ends_at=$2 WHERE user_id=$1 AND entitlement='pro_access' AND source='reverse_trial' RETURNING ends_at", [world.owner.fixture.creatorId, new Date(renewedDeadline)]);
		expect(renewed.rowCount).toBe(1);
	} finally {
		await pool.end();
	}
	mcpWorld.input = { ...mcpWorld.input, runnerRenewedAppearanceDeadline: renewedDeadline };
});

Then("its original clip stays clean beyond the former deadline", async ({ page, mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const { deadline, beforeTime } = mcpWorld.input!.runnerPresentationExpiry as { deadline: number; beforeTime: number };
	await expect.poll(() => Date.now(), { timeout: Math.max(0, deadline - Date.now()) + 5000 }).toBeGreaterThan(deadline + 500);
	expect(Date.now()).toBeLessThan(mcpWorld.input!.runnerRenewedAppearanceDeadline as number);
	await expect(page.locator("[data-runner-attribution]")).toHaveCount(0);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-presentation-generation", world.generation);
	await expect(page.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-layout-status", "clean");
	const video = page.locator(`video[data-expiry-continuity="${world.generation}"]`);
	await expect(video).toHaveCount(1);
	await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(beforeTime);
});

Then("their standby background color matches draft preview and saved generated standby", async ({ page, mcpWorld }) => {
	const color = page.getByLabel("Standby background color", { exact: true });
	await expect(color).toBeVisible();
	await color.fill("#16324f");
	await color.press("Tab");
	const standby = page.frameLocator('iframe[title="Runner appearance preview"]').locator("[data-runner-standby]");
	await expect(standby).toHaveCSS("background-color", "rgb(22, 50, 79)");
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(color).toHaveValue(/^#16324f$/i);
	await expect(standby).toHaveCSS("background-color", "rgb(22, 50, 79)");
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expect(page.locator("[data-runner-standby]")).toHaveCSS("background-color", "rgb(22, 50, 79)");
});

Then("their uploaded background image matches preview and saved generated standby", async ({ page, mcpWorld }) => {
	const sharp = (await import("sharp")).default;
	const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 40, g: 120, b: 200 } } })
		.png()
		.toBuffer();
	const [upload] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose image", exact: true }).nth(1).click()]);
	await upload.setFiles({ name: "standby.png", mimeType: "image/png", buffer: bytes });
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]').getByRole("img", { name: "Standby background", exact: true });
	await expect(preview).toBeVisible();
	await expect(preview).toHaveJSProperty("naturalWidth", 16);
	await expect(preview).toHaveJSProperty("naturalHeight", 16);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(preview).toBeVisible();
	await expect(preview).toHaveJSProperty("naturalWidth", 16);
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	const image = page.getByRole("img", { name: "Standby background", exact: true });
	await expect(image).toBeVisible();
	await expect(image).toHaveJSProperty("naturalWidth", 16);
	await expect(image).toHaveJSProperty("naturalHeight", 16);
});

Then("their uploaded logo matches preview and saved generated standby", async ({ page, mcpWorld }) => {
	const sharp = (await import("sharp")).default;
	const bytes = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 180, g: 40, b: 120, alpha: 0.8 } } })
		.png()
		.toBuffer();
	const [upload] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose image", exact: true }).first().click()]);
	await upload.setFiles({ name: "logo.png", mimeType: "image/png", buffer: bytes });
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]').getByRole("img", { name: "Standby logo", exact: true });
	await expect(preview).toBeVisible();
	await expect(preview).toHaveJSProperty("naturalWidth", 16);
	await expect(preview).toHaveJSProperty("naturalHeight", 16);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(preview).toBeVisible();
	await expect(preview).toHaveJSProperty("naturalWidth", 16);
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	const logo = page.getByRole("img", { name: "Standby logo", exact: true });
	await expect(logo).toBeVisible();
	await expect(logo).toHaveJSProperty("naturalWidth", 16);
	await expect(logo).toHaveJSProperty("naturalHeight", 16);
	const policy = await page.request.get(`http://127.0.0.1:3107/runner/presentation/${world.sessionId}/policy`);
	expect(policy.status()).toBe(200);
	expect(policy.headers()["cache-control"]).toBe("private, no-store");
	const renewed = policy.headers()["set-cookie"] ?? "";
	expect(renewed.includes("clipify_runner_presentation=")).toBe(true);
	expect(renewed.includes(`Path=/runner/presentation/${world.sessionId}`)).toBe(true);
	expect(/HttpOnly/i.test(renewed)).toBe(true);
	expect(/Max-Age=600/i.test(renewed)).toBe(true);
	expect(/SameSite=strict/i.test(renewed)).toBe(true);
});

Then("their standby message matches draft preview and the already active presentation", async ({ page, mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	const output = await page.context().newPage();
	try {
		await output.clock.install({ time: Date.now() });
		await output.goto(`http://127.0.0.1:3107${url}`);
		await expect(output.locator("[data-runner-standby]")).toBeVisible();
		const marker = await output.locator("[data-runner-content-phase]").elementHandle();
		expect(marker).not.toBeNull();
		const message = "Back soon <3 — thanks for watching!";
		const editor = page.getByLabel("Standby message", { exact: true });
		await expect(editor).toBeVisible();
		await editor.fill(message);
		const preview = page.frameLocator('iframe[title="Runner appearance preview"]').getByText(message, { exact: true });
		await expect(preview).toBeVisible();
		await page.getByRole("button", { name: "Save appearance", exact: true }).click();
		await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
		await page.reload();
		await openRunnerAppearance(page);
		await expect(editor).toHaveValue(message);
		await expect(preview).toBeVisible();
		await output.clock.fastForward(30001);
		await expect(output.getByText(message, { exact: true })).toBeVisible();
		await expect(output.locator("[data-runner-presentation-generation]")).toHaveAttribute("data-runner-presentation-generation", world.generation);
		expect(await marker!.evaluate((element) => element.isConnected)).toBe(true);
	} finally {
		await output.close();
	}
});

Given("its schedule includes a future Berlin broadcast beyond the current cache horizon", async ({ mcpWorld }) => {
	const world = presentationState(mcpWorld.input);
	const year = new Date().getUTCFullYear() + 1;
	const date = `${year}-01-15`;
	const expected = `${date}T13:00:00.000Z`;
	mcpWorld.input = { ...mcpWorld.input, runnerStandbyNext: { expected, timezone: "Europe/Berlin" } };
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 2 });
	try {
		const { encryptString } = await import("@/app/lib/encryption");
		const target = randomUUID();
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key) VALUES($1,$2,'Scheduled loopback','custom','rtmp://127.0.0.1:1949/live',$3)", [target, world.owner.fixture.creatorId, encryptString("disposable-schedule-key")]);
		await pool.query("UPDATE stream_sessions SET control_mode='scheduled' WHERE id=$1", [world.sessionId]);
		const startDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10),
			endDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
			currentId = randomUUID();
		const entries = [
			{ id: currentId, title: "Active window", timezone: "UTC", start: startDate, end: endDate, startTime: "00:00", endTime: "23:59" },
			{ id: randomUUID(), title: "Future Berlin broadcast", timezone: "Europe/Berlin", start: date, end: date, startTime: "14:00", endTime: "16:00" },
		];
		for (const event of entries) {
			await pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) VALUES($1,$2,$3,$4,$5,$6,$7,'once',$8,$8,$9,$10,$11)", [event.id, world.owner.fixture.creatorId, world.runnerId, world.sessionId, world.owner.fixture.overlayId, event.title, event.timezone, event.start, event.end, event.startTime, event.endTime]);
			await pool.query("INSERT INTO runner_schedule_event_destinations(owner_id,event_id,destination_id,position) VALUES($1,$2,$3,0)", [world.owner.fixture.creatorId, event.id, target]);
		}
		await pool.query("UPDATE runner_broadcast_admissions SET occurrence_id=$2,scheduled_end=$3 WHERE session_id=$1", [world.sessionId, JSON.stringify([currentId, startDate]), `${endDate}T23:59:00Z`]);
	} finally {
		await pool.end();
	}
});
Then("Runner playback schedules are not advertised as the next Twitch broadcast", async ({ page, mcpWorld }) => {
	const choice = page.getByRole("switch", { name: "Show next broadcast time", exact: true });
	await expect(choice).toBeVisible();
	await choice.focus();
	await choice.press("Space");
	await expect(choice).toBeChecked();
	const preview = page.frameLocator('iframe[title="Runner appearance preview"]').locator("[data-runner-next-broadcast]");
	await expect(preview).toHaveCount(0);
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
	await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	await page.reload();
	await openRunnerAppearance(page);
	await expect(choice).toBeChecked();
	await expect(preview).toHaveCount(0);
	const world = presentationState(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	const time = page.locator("[data-runner-next-broadcast]");
	await expect(time).toHaveCount(0);
});
