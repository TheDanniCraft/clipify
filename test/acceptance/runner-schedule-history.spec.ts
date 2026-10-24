import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

test("past broadcasts remain read-only and future recurring changes have explicit scope", async ({ page, request, context }, testInfo) => {
	test.setTimeout(120000);
	page.setDefaultTimeout(20000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const runnerId = randomUUID(),
			sessionId = randomUUID(),
			targetId = randomUUID(),
			pastId = randomUUID(),
			seriesId = randomUUID();
		const creatorId = owner.fixture.creatorId;
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at) VALUES($1,$2,'Schedule history',$3,'online',now())", [runnerId, creatorId, randomUUID()]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Local destination','custom','rtmp://127.0.0.1:1949/live')", [targetId, creatorId]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [sessionId, creatorId, runnerId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, targetId, creatorId]);
		await pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) VALUES($1,$2,$3,$4,$5,'Past broadcast','UTC','once','past',to_char(now()-interval '2 days','YYYY-MM-DD'),to_char(now()-interval '2 days','YYYY-MM-DD'),'12:00','13:00')", [pastId, creatorId, runnerId, sessionId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_start_time,local_end_time,weekdays) VALUES($1,$2,$3,$4,$5,'Weekly broadcast','UTC','weekly',to_char(now()-interval '7 days','YYYY-MM-DD'),to_char(now()-interval '7 days','YYYY-MM-DD'),to_char(now()-interval '30 minutes','HH24:MI'),to_char(now()+interval '30 minutes','HH24:MI'),$6::jsonb)", [
			seriesId,
			creatorId,
			runnerId,
			sessionId,
			owner.fixture.overlayId,
			JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
		]);
		await pool.query("UPDATE runner_schedule_events SET end_day_offset=CASE WHEN local_end_time<local_start_time THEN 1 ELSE 0 END WHERE id=$1", [seriesId]);
		await pool.query("INSERT INTO runner_schedule_event_destinations(event_id,destination_id,owner_id,position) VALUES($1,$3,$4,0),($2,$3,$4,0)", [pastId, seriesId, targetId, creatorId]);
		await page.goto("/legal/cookies");
		await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
		const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
		await preferences.focus();
		await preferences.press("Enter");
		await Promise.all([page.waitForEvent("load"), page.getByRole("dialog", { name: "Privacy preferences", exact: true }).getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.goto(`/dashboard/runners/${runnerId}`);
		await page.getByRole("button", { name: "Schedule", exact: true }).click();
		const schedule = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
		const openCalendarEvent = async (title: string) => {
			const calendar = schedule.getByRole("region", { name: "Broadcast calendar", exact: true });
			await calendar.getByRole("radio", { name: "Month", exact: true }).click();
			const editable = calendar.getByRole("button", { name: `Edit ${title}`, exact: true });
			const event = (await editable.count()) ? editable.first() : calendar.getByRole("button", { name: `View ${title}`, exact: true }).first();
			await event.click();
		};
		await expect(schedule.getByRole("list", { name: "Saved schedules", exact: true })).toHaveCount(0);

		await openCalendarEvent("Past broadcast");
		const details = page.getByRole("dialog", { name: "Broadcast details", exact: true });
		await expect(details).toBeVisible();
		await expect(details.getByRole("button", { name: "Delete schedule", exact: true })).toHaveCount(0);
		await expect(details.getByRole("spinbutton")).toHaveCount(0);
		await details.getByRole("textbox", { name: "Event title", exact: true }).fill("Archived broadcast");
		await details.getByRole("button", { name: "Save title", exact: true }).click();
		await expect(details).not.toBeVisible();
		expect((await pool.query("SELECT title,configuration_revision FROM runner_schedule_events WHERE id=$1", [pastId])).rows[0]).toEqual({ title: "Archived broadcast", configuration_revision: 1 });
		await openCalendarEvent("Archived broadcast");
		await details.screenshot({ path: testInfo.outputPath("past-broadcast-details-dark.png") });
		await details.getByRole("button", { name: "Close", exact: true }).last().click();
		await openCalendarEvent("Archived broadcast");
		await page.setViewportSize({ width: 390, height: 844 });
		await details.screenshot({ path: testInfo.outputPath("past-details-dark-mobile.png") });
		await details.getByRole("button", { name: "Close", exact: true }).last().click();
		await expect(details).not.toBeVisible();
		await page.keyboard.press("Escape");
		await expect(schedule).not.toBeVisible();
		await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.getByRole("button", { name: "Schedule", exact: true }).click();
		await openCalendarEvent("Archived broadcast");
		await details.screenshot({ path: testInfo.outputPath("past-details-light-desktop.png") });
		await page.setViewportSize({ width: 390, height: 844 });
		await details.screenshot({ path: testInfo.outputPath("past-details-light-mobile.png") });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await details.getByRole("button", { name: "Close", exact: true }).last().click();
		await page.setViewportSize({ width: 1280, height: 900 });
		const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
		await openCalendarEvent("Weekly broadcast");
		await editor.getByRole("textbox", { name: /^Event title\*?$/ }).fill("One changed occurrence");
		await editor.getByRole("button", { name: "Save schedule", exact: true }).click();
		const scope = page.getByRole("dialog", { name: "Edit recurring broadcast", exact: true });
		await expect(scope).toBeVisible();
		await scope.screenshot({ path: testInfo.outputPath("recurring-edit-scope-dark.png") });
		await scope.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(editor.getByRole("textbox", { name: /^Event title\*?$/ })).toHaveValue("One changed occurrence");
		expect((await pool.query("SELECT configuration_revision FROM runner_schedule_events WHERE id=$1", [seriesId])).rows[0].configuration_revision).toBe(1);
		await editor.getByRole("button", { name: "Save schedule", exact: true }).click();
		await scope.getByRole("button", { name: "This occurrence", exact: true }).click();
		await expect(editor).not.toBeVisible();
		const single = (await pool.query("SELECT recurrence FROM runner_schedule_events WHERE owner_id=$1 AND title='One changed occurrence'", [creatorId])).rows;
		expect(single).toEqual([{ recurrence: "once" }]);
		expect((await pool.query("SELECT excluded_dates,configuration_revision FROM runner_schedule_events WHERE id=$1", [seriesId])).rows[0]).toMatchObject({ excluded_dates: [expect.any(String)], configuration_revision: 2 });
		await openCalendarEvent("Weekly broadcast");
		await editor.getByRole("textbox", { name: /^Event title\*?$/ }).fill("Following broadcasts");
		await editor.getByRole("button", { name: "Save schedule", exact: true }).click();
		await scope.getByRole("button", { name: "This and following", exact: true }).click();
		await expect(editor).not.toBeVisible();
		await openCalendarEvent("Following broadcasts");
		await editor.getByRole("button", { name: "Delete schedule", exact: true }).click();
		const deletion = page.getByRole("dialog", { name: "Delete recurring broadcast", exact: true });
		await expect(deletion).toBeVisible();
		await deletion.getByRole("button", { name: "This occurrence", exact: true }).click();
		await expect(editor).not.toBeVisible();
		await openCalendarEvent("Following broadcasts");
		await editor.getByRole("button", { name: "Delete schedule", exact: true }).click();
		await deletion.getByRole("button", { name: "This and following", exact: true }).click();
		await expect(editor).not.toBeVisible();
		expect((await pool.query("SELECT repeat_until_date FROM runner_schedule_events WHERE id=$1", [seriesId])).rows[0].repeat_until_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect((await pool.query("SELECT count(*)::int AS count FROM runner_schedule_events WHERE id=$1", [pastId])).rows[0].count).toBe(1);
	} finally {
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
