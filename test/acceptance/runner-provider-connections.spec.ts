import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
import { encryptString } from "../../src/app/lib/encryption";

test.use({ timezoneId: "Europe/Berlin" });
test("PC-1/3/6 connected channel, one permission prompt, optional event details and recovery use the real Runner editor", async ({ page, context, request }, info) => {
	test.setTimeout(180000);
	page.setDefaultTimeout(15000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const creator = owner.fixture.creatorId,
			runner = randomUUID(),
			session = randomUUID(),
			target = randomUUID(),
			connection = randomUUID(),
			youtube = randomUUID(),
			youtubeConnection = randomUUID(),
			unconnected = randomUUID();
		await pool.query("UPDATE users SET plan='pro',username='dannicraft',avatar='' WHERE id=$1", [creator]);
		await pool.query('UPDATE auth."user" SET name=$2,image=NULL WHERE id=$1', [owner.fixture.authUserId, "DanniCraft"]);
		await pool.query("UPDATE auth.organization SET name=$2 WHERE id=$1", [owner.fixture.creatorOrganizationId, "DanniCraft"]);
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Home streaming PC',$3,'online',now(),2,$4::jsonb)", [runner, creator, randomUUID(), JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
		await pool.query("INSERT INTO runner_provider_connections(id,owner_id,provider,channel_id,channel_name,encrypted_tokens) VALUES($1,$2,'twitch','42','dannicraft',$3)", [connection, creator, encryptString(JSON.stringify({ accessToken: "fixture-only-token", refreshToken: "fixture-only-refresh", expiresAt: Date.now() + 3600000 }))]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key,connection_id) VALUES($1,$2,'Main Twitch','twitch','rtmp://live.twitch.tv/app',$3,$4)", [target, creator, encryptString("fixture-only-key"), connection]);
		await pool.query("INSERT INTO runner_provider_connections(id,owner_id,provider,channel_id,channel_name,encrypted_tokens) VALUES($1,$2,'youtube','fixture-channel','Clipify Live',$3)", [youtubeConnection, creator, encryptString(JSON.stringify({ accessToken: "fixture-youtube-token", refreshToken: "fixture-refresh", expiresAt: Date.now() + 3600000 }))]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key,connection_id,provider_stream_id) VALUES($1,$2,'YouTube highlights','youtube','rtmp://a.rtmp.youtube.com/live2',$3,$4,'fixture-stream')", [youtube, creator, encryptString("fixture-youtube-key"), youtubeConnection]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url,encrypted_stream_key) VALUES($1,$2,'Manual channel','twitch','rtmp://live.twitch.tv/app',$3)", [unconnected, creator, encryptString("fixture-manual-unconnected-key")]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [session, creator, runner, owner.fixture.overlayId]);
		await pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [session, target, creator]);
		await pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,1)", [session, youtube, creator]);
		await page.goto("/legal/cookies");
		await page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true }).click();
		await Promise.all([page.waitForEvent("load"), page.getByRole("dialog", { name: "Privacy preferences", exact: true }).getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.goto(`/dashboard/runners/${runner}`);
		await expect(page.getByRole("heading", { name: "Home streaming PC", exact: true })).toBeVisible();
		const manager = page.getByRole("dialog", { name: "Manage destinations", exact: true });
		await page.getByRole("button", { name: "Manage destinations", exact: true }).click();
		await manager.getByRole("button", { name: "Edit Main Twitch", exact: true }).click();
		const destination = page.getByRole("dialog", { name: "Edit destination", exact: true });
		await expect(destination.getByText("dannicraft", { exact: true })).toBeVisible();
		await destination.getByRole("textbox", { name: "Destination name", exact: true }).fill("My preserved destination");
		await context.route("https://id.twitch.tv/oauth2/authorize?**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Controlled provider consent</title><p>Provider consent boundary</p>" }));
		const popupPromise = page.waitForEvent("popup");
		await destination.getByRole("button", { name: "Change", exact: true }).click();
		const popup = await popupPromise;
		await popup.waitForURL("https://id.twitch.tv/oauth2/authorize?**");
		expect(new URL(popup.url()).searchParams.get("scope")?.split(" ")).toEqual(["channel:read:stream_key", "channel:manage:broadcast"]);
		await popup.close();
		await expect(destination.getByRole("alert")).toContainText("Connection cancelled");
		await expect(destination.getByRole("textbox", { name: "Destination name", exact: true })).toHaveValue("My preserved destination");
		for (const theme of ["dark", "light"]) {
			await page.evaluate((theme) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(theme);
				document.documentElement.style.colorScheme = theme;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await expect(destination.getByRole("button", { name: "Save destination", exact: true })).toBeVisible();
				await destination.screenshot({ path: info.outputPath(`connected-${theme}-${width}.png`) });
			}
		}
		await page.setViewportSize({ width: 1280, height: 960 });
		await destination.getByRole("button", { name: "Test connection", exact: true }).click();
		const testDialog = page.getByRole("dialog", { name: "Test Twitch connection", exact: true });
		await expect(testDialog.getByRole("button", { name: "Start test", exact: true })).toBeVisible();
		await testDialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await destination.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(destination).not.toBeVisible();
		await manager.getByRole("button", { name: "Add destination", exact: true }).click();
		const manual = page.getByRole("dialog", { name: "Add destination", exact: true });
		await manual.getByRole("textbox", { name: "Destination name", exact: true }).fill("Manual Twitch");
		await manual.getByRole("tab", { name: "Connect account", exact: true }).focus();
		await page.keyboard.press("ArrowRight");
		await expect(manual.getByRole("tab", { name: "Stream key", exact: true })).toHaveAttribute("aria-selected", "true");
		await expect(manual.getByLabel("RTMP URL", { exact: true })).toHaveCount(0);
		await manual.getByLabel("Destination stream key", { exact: true }).fill("fixture-manual-only-key");
		await manual.getByRole("button", { name: "Save destination", exact: true }).click();
		await expect(manual).not.toBeVisible();
		const savedManual = (await pool.query("SELECT id,encrypted_stream_key,connection_id FROM runner_destinations WHERE owner_id=$1 AND name='Manual Twitch'", [creator])).rows[0];
		expect(savedManual.connection_id).toBeNull();
		expect(savedManual.encrypted_stream_key).not.toBe("fixture-manual-only-key");
		await manager.getByRole("button", { name: "Delete Manual Twitch", exact: true }).click();
		await page.getByRole("dialog", { name: "Delete destination?", exact: true }).getByRole("button", { name: "Delete destination", exact: true }).click();
		await expect(manager.getByRole("row").filter({ hasText: "Manual Twitch" })).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(manager).not.toBeVisible();
		await page.getByRole("button", { name: "Schedule", exact: true }).click();
		const calendar = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
		await calendar.getByRole("button", { name: "Add schedule", exact: true }).click();
		const event = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
		await event.getByRole("button", { name: "Save schedule", exact: true }).click();
		await expect(event.getByText("Enter an event title.", { exact: true })).toBeVisible();
		await event.getByRole("textbox", { name: /^Event title/ }).fill("Vacation highlights");
		await event.getByRole("tab", { name: /Broadcast details/ }).click();
		const toggle = event.getByRole("switch", { name: "Set stream details", exact: true });
		await expect(toggle).not.toBeChecked();
		await toggle.focus();
		await page.keyboard.press("Space");
		await expect(toggle).toBeChecked();
		await page.keyboard.press("Space");
		await event.getByText("Set stream details", { exact: true }).click();
		await expect(toggle).toBeChecked();
		await expect(event.getByRole("textbox", { name: "Stream title", exact: true })).toHaveAttribute("placeholder", "Vacation highlights");
		await event.getByRole("textbox", { name: "Stream title", exact: true }).fill("Community highlights");
		for (const theme of ["light", "dark"]) {
			await page.evaluate((theme) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(theme);
				document.documentElement.style.colorScheme = theme;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await expect(event.getByRole("button", { name: "Save schedule", exact: true })).toBeVisible();
				await event.screenshot({ path: info.outputPath(`details-${theme}-${width}.png`) });
			}
		}
		await event.getByRole("button", { name: /Destination$/ }).click();
		await page.getByRole("option", { name: "YouTube highlights", exact: true }).click();
		await expect(event.getByRole("textbox", { name: "Stream title", exact: true })).toHaveAttribute("placeholder", "Vacation highlights");
		await event.getByRole("textbox", { name: "Description", exact: true }).fill("Community clips while I am away.");
		await event.locator("input[type=file]").setInputFiles("public/web-app-manifest-192x192.png");
		await expect(event.getByText("web-app-manifest-192x192.png", { exact: true })).toBeVisible();
		for (const theme of ["dark", "light"]) {
			await page.evaluate((theme) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(theme);
				document.documentElement.style.colorScheme = theme;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await event.screenshot({ path: info.outputPath(`youtube-${theme}-${width}.png`) });
			}
		}
		await event.getByRole("button", { name: "Save schedule", exact: true }).click();
		await expect(event).not.toBeVisible();
		const stored = (await pool.query("SELECT set_stream_details,stream_details FROM runner_schedule_events WHERE owner_id=$1", [creator])).rows;
		expect(stored).toHaveLength(1);
		expect(stored[0].set_stream_details).toBe(true);
		expect(stored[0].stream_details).toHaveLength(2);
		expect(stored[0].stream_details).toEqual(
			expect.arrayContaining([
				{ destinationId: target, title: "Community highlights" },
				{ destinationId: youtube, description: "Community clips while I am away.", thumbnailAssetId: expect.any(String) },
			]),
		);
		await calendar.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation highlights", exact: true }).click();
		await event.getByRole("tab", { name: /Broadcast details/ }).click();
		await expect(event.getByRole("switch", { name: "Set stream details", exact: true })).toBeChecked();
		await expect(event.getByRole("textbox", { name: "Stream title", exact: true })).toHaveValue("Community highlights");
		await event.getByRole("tab", { name: "Schedule", exact: true }).click();
		await event.getByRole("textbox", { name: /^Event title/ }).fill("Draft kept");
		await event.getByRole("button", { name: "Manage destinations", exact: true }).click();
		const inlineManager = page.getByRole("dialog", { name: "Manage destinations", exact: true });
		await expect(inlineManager.getByRole("row").filter({ hasText: "Manual channel" })).toBeVisible();
		await inlineManager.getByRole("button", { name: "Back to event", exact: true }).click();
		await expect(event.getByRole("textbox", { name: /^Event title/ })).toHaveValue("Draft kept");
		await event.getByRole("button", { name: /Schedule destinations$/ }).click();
		for (const option of ["Main Twitch", "YouTube highlights", "Manual channel"]) {
			await page.getByRole("option", { name: new RegExp("^" + option) }).click();
		}
		await page.getByRole("option", { name: /^Manual channel/ }).press("Escape");
		await event.getByRole("tab", { name: /Broadcast details/ }).click();
		await expect(event.getByRole("switch", { name: "Set stream details", exact: true })).not.toBeChecked();
		await event.getByRole("button", { name: "Manage destinations", exact: true }).click();
		await inlineManager.getByRole("button", { name: "Back to event", exact: true }).click();
		await event.getByRole("tab", { name: "Schedule", exact: true }).click();
		await expect(event.getByRole("textbox", { name: /^Event title/ })).toHaveValue("Draft kept");
		expect((await pool.query("SELECT title FROM runner_schedule_events WHERE owner_id=$1", [creator])).rows[0].title).toBe("Vacation highlights");
	} finally {
		await pool.end();
		if (owner) {
			const result = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(result.status()).toBe(204);
		}
	}
});
