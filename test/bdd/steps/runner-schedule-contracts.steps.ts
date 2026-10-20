import { openRunnerSchedule, fillScheduleField, expectScheduleField } from "../../support/runner/editor";
import { createBdd } from "playwright-bdd";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/mcp-support";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";

const { Given, When, Then, AfterScenario } = createBdd(test);
const origin = "http://127.0.0.1:3107";
const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
type Owner = { fixture: { creatorId: string; authUserId: string; creatorOrganizationId: string; agencyOrganizationId: string; overlayId: string }; cookie: Parameters<import("@playwright/test").BrowserContext["addCookies"]>[0][number] };
type State = { owner: Owner; runnerId: string; sessionId: string; targetId: string; submittedTitle?: string; before?: unknown; eventId?: string; occurrenceId?: string; triggerName?: string; originalEnd?: string; stoppedAdmission?: string; initialExecutionState?: string };
async function query(text: string, values: unknown[] = []) {
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		return (await pool.query(text, values)).rows;
	} finally {
		await pool.end();
	}
}
async function saved(state: State) {
	return query("SELECT * FROM runner_schedule_events WHERE owner_id=$1 ORDER BY created_at,id", [state.owner.fixture.creatorId]);
}
async function expectLockedSchedule(page: Page) {
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "View Active schedule", exact: true }).click();
	const details = page.getByRole("dialog", { name: "Broadcast details", exact: true });
	await expect(details.getByText("Broadcast settings are read-only. You can still rename this event.", { exact: true })).toBeVisible();
	await expect(details.getByRole("combobox")).toHaveCount(0);
	await expect(details.getByRole("button", { name: "Delete schedule", exact: true })).toHaveCount(0);
	await expect(details.getByRole("button", { name: "Save title", exact: true })).toBeDisabled();
	await details.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click();
}
async function fillEvent(page: Page, fields: { title?: string; startDate?: string; endDate?: string; startTime?: string; endTime?: string; zone?: string } = {}) {
	await page.getByRole("button", { name: "Add schedule", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	await editor.getByLabel("Event title", { exact: true }).fill(fields.title ?? "Vacation broadcast");
	await fillScheduleField(editor, "Timezone", fields.zone ?? "UTC");
	await fillScheduleField(editor, "Start date", fields.startDate ?? "2027-01-04");
	await fillScheduleField(editor, "End date", fields.endDate ?? "2027-01-04");
	await fillScheduleField(editor, "Start time", fields.startTime ?? "12:00");
	await fillScheduleField(editor, "End time", fields.endTime ?? "13:00");
	return editor;
}
async function submit(page: Page) {
	if (await page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByRole("button", { name: "Save schedule", exact: true }).isDisabled()) return;
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	await page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByRole("button", { name: "Save schedule", exact: true }).click();
	await response;
}
Given("a Pro creator is authoring a Runner schedule in the browser", async ({ page, request, mcpWorld }) => {
	const response = await request.post(origin + "/api/test/auth-fixture", { headers: fixtureHeaders, data: { withProviderCredentials: true } });
	expect(response.status()).toBe(200);
	const owner = (await response.json()) as Owner;
	expect(owner.fixture.creatorId).toMatch(/^e2e-creator-/);
	const state: State = { owner, runnerId: randomUUID(), sessionId: randomUUID(), targetId: randomUUID() };
	mcpWorld.input = { scheduleContract: state };
	await query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Schedule contract Runner',$3,'online',now(),2,$4::jsonb)", [state.runnerId, owner.fixture.creatorId, randomUUID(), JSON.stringify(["admissions", "drain", "runner_presentation", "free_lease"])]);
	await query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Vacation target','custom','rtmp://127.0.0.1:1949/live')", [state.targetId, owner.fixture.creatorId]);
	await query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [state.sessionId, owner.fixture.creatorId, state.runnerId, owner.fixture.overlayId]);
	await query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [state.sessionId, state.targetId, owner.fixture.creatorId]);
	await page.context().addCookies([owner.cookie]);
	await page.goto(origin + "/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(privacy).toBeVisible();
	await Promise.all([page.waitForEvent("load"), privacy.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.goto(`${origin}/dashboard/runners/${state.runnerId}`);
	await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
	// Explicit missing product assertion; fixture authentication and current Runner UI must work first.
	await openRunnerSchedule(page);
});
When("they submit a schedule title with {int} characters", async ({ page, mcpWorld }, length: number) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Retained schedule", startDate: "2027-02-01", endDate: "2027-02-01" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = await saved(state);
	state.submittedTitle = "T".repeat(length);
	await fillEvent(page, { title: state.submittedTitle });
	await submit(page);
});
When("they submit a UTC schedule lasting {int} minutes", async ({ page, mcpWorld }, minutes: number) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Retained schedule", startDate: "2027-02-01", endDate: "2027-02-01" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = await saved(state);
	state.submittedTitle = "Duration boundary";
	const end = new Date(Date.UTC(2027, 0, 4, 12, minutes));
	await fillEvent(page, { title: state.submittedTitle, endDate: end.toISOString().slice(0, 10), endTime: end.toISOString().slice(11, 16) });
	await submit(page);
});
Then("the schedule boundary is {string} without changing a previously saved event", async ({ page, mcpWorld }, outcome: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	if (outcome === "rejected") {
		await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).locator('[role="alert"], [data-slot="field-error"]')).toBeVisible();
		expect(await saved(state)).toEqual(state.before);
	} else {
		await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
		const rows = await saved(state);
		expect(rows).toHaveLength((state.before as unknown[]).length + 1);
		expect(rows.at(-1).title).toBe(state.submittedTitle);
		await page.reload();
		await openRunnerSchedule(page);
		await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText(state.submittedTitle!);
	}
});
When("they save a Monday to next Wednesday vacation event", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { startDate: "2027-01-04", endDate: "2027-01-13", zone: "Europe/Berlin" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.eventId = (await saved(state))[0]?.id;
});
Then("the explicit dates survive reload and the active rolling cache retains the full end", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await page.reload();
	await openRunnerSchedule(page);
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expectScheduleField(editor, "Start date", "2027-01-04");
	await expectScheduleField(editor, "End date", "2027-01-13");
	const rows = await saved(state);
	expect(rows[0]).toMatchObject({ id: state.eventId, local_start_date: "2027-01-04", local_end_date: "2027-01-13" });
	// Service-level rolling cache assertions have the distinct inner DEC005 owner.
});
When("they save an all-day Berlin event on {string}", async ({ page }, date: string) => {
	const end = new Date(date + "T00:00:00Z");
	end.setUTCDate(end.getUTCDate() + 1);
	await fillEvent(page, { startDate: date, endDate: end.toISOString().slice(0, 10), startTime: "00:00", endTime: "00:00", zone: "Europe/Berlin" });
	await submit(page);
});
Then("its saved elapsed duration is {int} hours", async ({ page, mcpWorld }, hours: number) => {
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const rows = await saved(mcpWorld.input?.scheduleContract as State);
	expect(rows).toHaveLength(1);
	expect(rows[0].timezone).toBe("Europe/Berlin");
	expect(rows[0].local_start_time).toMatch(/^00:00/);
	expect(rows[0].local_end_time).toMatch(/^00:00/);
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText(`${hours} hours`);
	await page.reload();
	await openRunnerSchedule(page);
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText("Vacation broadcast");
});
When("they save a one-time event and move its future start and end", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page);
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const row = (await saved(state))[0];
	state.eventId = row.id;
	state.before = row;
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await fillScheduleField(editor, "Start date", "2027-01-05");
	await fillScheduleField(editor, "End date", "2027-01-05");
	await submit(page);
});
Then("the saved event and occurrence identities remain stable across the edit", async ({ page, mcpWorld }) => {
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State,
		rows = await saved(state),
		before = state.before as Record<string, unknown>;
	expect(rows).toHaveLength(1);
	expect(rows[0].id).toBe(state.eventId);
	expect(rows[0].configuration_revision).toBe(Number(before.configuration_revision) + 1);
	expect(rows[0].local_start_date).toBe("2027-01-05");
	// The shared service's DEC004 observer verifies occurrence/suppression identity; browser owns persisted editor identity.
});
AfterScenario({ tags: "@runner-schedule-browser" }, async ({ request, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State | undefined;
	if (!state) return;
	if (state.triggerName) await query(`DROP FUNCTION IF EXISTS "${state.triggerName}"() CASCADE`);
	const response = await request.delete(origin + "/api/test/auth-fixture", { maxRetries: 2, headers: fixtureHeaders, data: { authUserId: state.owner.fixture.authUserId, creatorId: state.owner.fixture.creatorId, organizationIds: [state.owner.fixture.creatorOrganizationId, state.owner.fixture.agencyOrganizationId] } });
	expect(response.status()).toBe(204);
});

When("they save a {string} event with its timezone source and destinations", async ({ page, mcpWorld }, recurrence: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	const editor = await fillEvent(page, { zone: "Europe/Berlin" });
	if (recurrence === "weekly") {
		await editor.getByRole("button", { name: /Recurrence$/ }).click();
		await page.getByRole("option", { name: "Weekly", exact: true }).click();
		await editor.getByRole("checkbox", { name: "Monday", exact: true }).check();
	}
	await submit(page);
	await expect(editor).toHaveCount(0);
	const row = (await saved(state))[0];
	state.eventId = row.id;
	state.before = row;
});
Then("the saved schedule choices survive a browser reload", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State,
		before = state.before as Record<string, unknown>;
	await page.reload();
	await openRunnerSchedule(page);
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expectScheduleField(editor, "Timezone", "Europe/Berlin");
	await expect(editor.getByRole("button", { name: /Schedule destinations$/ })).toContainText("Vacation target");
	expect((await saved(state))[0]).toEqual(before);
	expect(before.session_id).toBe(state.sessionId);
	expect(before.overlay_id).toBe(state.owner.fixture.overlayId);
	await expect(editor.getByRole("button", { name: /Schedule source$/ })).toContainText("E2E continuity overlay");
});
When("they submit a schedule with {string}", async ({ page, mcpWorld }, invalid: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Retained schedule", startDate: "2027-02-01", endDate: "2027-02-01" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = await saved(state);
	const editor = await fillEvent(page, { endTime: invalid === "end before start" ? "11:59" : invalid === "equal bounds" ? "12:00" : "13:00", zone: invalid === "invalid timezone" ? "Invalid/Nowhere" : "UTC" });
	if (invalid === "missing source") {
		await editor.getByRole("button", { name: /Schedule source$/ }).click();
		await page.getByRole("option", { name: "Choose a source", exact: true }).click();
	}
	if (invalid === "missing targets") {
		await editor.getByRole("button", { name: /Schedule destinations$/ }).click();
		await page.getByRole("option", { name: /Vacation target/ }).click();
		await page.keyboard.press("Escape");
		await expect(editor.getByRole("button", { name: /Schedule destinations$/ })).not.toContainText("Vacation target");
	}
	await submit(page);
});
When("they save a timed Berlin event across midnight", async ({ page }) => {
	await fillEvent(page, { zone: "Europe/Berlin", startDate: "2027-01-04", endDate: "2027-01-05", startTime: "23:30", endTime: "00:30" });
	await submit(page);
});
Then("the saved midnight boundaries survive reload", async ({ page, mcpWorld }) => {
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	await page.reload();
	await openRunnerSchedule(page);
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expectScheduleField(editor, "Start time", "23:30");
	await expectScheduleField(editor, "End time", "00:30");
	const row = (await saved(mcpWorld.input?.scheduleContract as State))[0];
	expect(row.local_start_date).toBe("2027-01-04");
	expect(row.local_end_date).toBe("2027-01-05");
});
When("they change a saved future weekly event timezone", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	const editor = await fillEvent(page, { zone: "Europe/Berlin" });
	await editor.getByRole("button", { name: /Recurrence$/ }).click();
	await page.getByRole("option", { name: "Weekly", exact: true }).click();
	await editor.getByRole("checkbox", { name: "Monday", exact: true }).check();
	await submit(page);
	await expect(editor).toHaveCount(0);
	state.before = (await saved(state))[0];
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).click();
	await fillScheduleField(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }), "Timezone", "America/New_York");
	await page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByRole("button", { name: "Save schedule", exact: true }).click();
	await page.getByRole("dialog", { name: "Edit recurring broadcast", exact: true }).getByRole("button", { name: "This and following", exact: true }).click();
});
Then("its future timezone changes while its previous series is preserved", async ({ page, mcpWorld }) => {
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State;
	const before = state.before as Record<string, unknown>;
	const rows = await saved(state);
	expect(rows).toHaveLength(2);
	const original = rows.find((row) => row.id === before.id)!;
	const following = rows.find((row) => row.id !== before.id)!;
	expect(original).toMatchObject({ timezone: "Europe/Berlin", configuration_revision: Number(before.configuration_revision) + 1, repeat_until_date: "2027-01-04" });
	expect(following).toMatchObject({ timezone: "America/New_York", title: before.title, local_start_date: "2027-01-04", configuration_revision: 1 });
	await page.reload();
	await openRunnerSchedule(page);
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Vacation broadcast", exact: true }).last().click();
	await expectScheduleField(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }), "Timezone", "America/New_York");
});

When("storage rejects an edit to a saved schedule", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Retained schedule" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = await saved(state);
	state.triggerName = "schedule_failure_" + randomUUID().replaceAll("-", "");
	// The guarded disposable database and generated owner isolate this failure from other browser fixtures.
	const owner = state.owner.fixture.creatorId.replaceAll("'", "''");
	await query(`CREATE FUNCTION "${state.triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.owner_id='${owner}' THEN RAISE EXCEPTION 'controlled schedule persistence failure'; END IF; RETURN NEW; END $$`);
	await query(`CREATE TRIGGER "${state.triggerName}" BEFORE UPDATE ON runner_schedule_events FOR EACH ROW EXECUTE FUNCTION "${state.triggerName}"()`);
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Retained schedule", exact: true }).click();
	await page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByLabel("Event title", { exact: true }).fill("Rejected edit");
	await submit(page);
});
Then("the browser reports the save failure and retains the prior saved schedule", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByRole("alert")).toContainText(/could not|try again/i);
	expect(await saved(state)).toEqual(state.before);
	await page.reload();
	await openRunnerSchedule(page);
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText("Retained schedule");
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).not.toContainText("Rejected edit");
});

When("they open a multi-week vacation schedule on a mobile calendar", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Mobile vacation", startDate: "2027-01-03", endDate: "2027-01-13", startTime: "18:00", endTime: "20:00", zone: "Europe/Berlin" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = (await saved(state))[0];
	await page.setViewportSize({ width: 360, height: 800 });
	await page.reload();
	await openRunnerSchedule(page);
	await expect(page.getByRole("region", { name: "Broadcast calendar", exact: true })).toBeVisible();
	await fillScheduleField(page, "Displayed date", "2027-01-06");
});
Then("its day segments retain one event with editable true start and end dates", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
	await expect(calendar.getByRole("button", { name: /Mobile vacation/ }).first()).toBeVisible();
	await calendar.getByRole("button", { name: "Next", exact: true }).click();
	await expectScheduleField(page, "Displayed date", "2027-01-07");
	await calendar.screenshot({ path: "test-results/runner-ux-mobile-agenda.png" });
	await page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Mobile vacation", exact: true }).click();
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expectScheduleField(editor, "Start date", "2027-01-03");
	await expectScheduleField(editor, "End date", "2027-01-13");
	await expectScheduleField(editor, "Start time", "18:00");
	await expectScheduleField(editor, "End time", "20:00");
	expect(await saved(state)).toEqual([state.before]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

When("they view a vacation spanning the first day of a desktop week", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await fillEvent(page, { title: "Week boundary vacation", startDate: "2027-01-02", endDate: "2027-01-13", startTime: "18:00", endTime: "20:00", zone: "UTC" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	await fillScheduleField(page, "Displayed date", "2027-01-04");
});
Then("the first displayed day retains its vacation segment", async ({ page }) => {
	const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
	const columns = calendar.locator('[data-slot="agenda-day-column"]');
	await expect(columns).toHaveCount(7);
	await expect(columns.first().getByRole("button", { name: /Week boundary vacation/ })).toBeVisible();
	await calendar.screenshot({ path: "specs/004-runner-free-pro/tdd/evidence/D2-desktop-agenda.png" });
});

When("they drag an empty calendar range from eighteen to twenty", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await fillScheduleField(page, "Displayed date", "2027-01-04");
	const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
	await calendar.scrollIntoViewIfNeeded();
	const column = calendar.locator('[data-slot="agenda-day-column"][data-date="2027-01-04"]');
	await column.evaluate((element) => {
		const grid = element.closest('[data-slot="agenda-time-grid"]')!;
		grid.scrollTop = (element.clientHeight * 18) / 24 - 40;
	});
	const box = await column.boundingBox();
	expect(box).not.toBeNull();
	const x = box!.x + box!.width / 2,
		startY = box!.y + (box!.height * 18) / 24 + 1,
		endY = box!.y + (box!.height * 20) / 24 + 1;
	for (const y of [startY, endY]) expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-slot="agenda-day-column"]')?.getAttribute("data-date"), { x, y })).toBe("2027-01-04");
	await page.mouse.move(x, startY);
	await page.mouse.down();
	await page.mouse.move(x, endY, { steps: 8 });
	await page.mouse.up();
});
Then("the explicit editor persists the selected pointer calendar range", async ({ page, mcpWorld }) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	await expectScheduleField(editor, "Start date", "2027-01-04");
	await expectScheduleField(editor, "End date", "2027-01-04");
	await expectScheduleField(editor, "Start time", "18:00");
	await expectScheduleField(editor, "End time", "20:00");
	await editor.getByLabel("Event title", { exact: true }).fill("Pointer broadcast");
	await submit(page);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State,
		rows = await saved(state);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ title: "Pointer broadcast", local_start_time: expect.stringMatching(/^18:00(?::00)?$/), local_end_time: expect.stringMatching(/^20:00(?::00)?$/), overlay_id: state.owner.fixture.overlayId });
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText("Pointer broadcast");
});

Given("their scheduled occurrence is inside its original active window", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State,
		id = randomUUID();
	const start = new Date(Date.now() - 3600000).toISOString(),
		end = new Date(Date.now() + 3600000).toISOString();
	await query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) VALUES($1,$2,$3,$4,$5,'Active schedule','UTC','once',$6,$7,$8,$9,$10)", [id, state.owner.fixture.creatorId, state.runnerId, state.sessionId, state.owner.fixture.overlayId, start.slice(0, 10), start.slice(0, 10), end.slice(0, 10), start.slice(11, 16), end.slice(11, 16)]);
	await query("INSERT INTO runner_schedule_event_destinations(event_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [id, state.targetId, state.owner.fixture.creatorId]);
	state.eventId = id;
	state.before = await saved(state);
	await page.reload();
	await openRunnerSchedule(page);
});
Then("its schedule editor is locked while broadcast controls remain available", async ({ page, mcpWorld }) => {
	await expectLockedSchedule(page);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State;
	expect(await saved(state)).toEqual(state.before);
});

Given("that window ended while its captured output is still draining", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	const start = new Date(Date.now() - 7200000).toISOString(),
		end = new Date(Date.now() - 60000).toISOString();
	await query("UPDATE runner_schedule_events SET local_start_date=$1,local_end_date=$2,local_start_time=$3,local_end_time=$4 WHERE id=$5", [start.slice(0, 10), end.slice(0, 10), start.slice(11, 16), end.slice(11, 16), state.eventId]);
	const event = (await saved(state))[0];
	await query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,occurrence_id,state,configuration_revision,benefits_at_start,scheduled_end) VALUES($1,$2,$3,$4,$5,$6,'draining',1,$7::jsonb,$8)", [randomUUID(), state.owner.fixture.creatorId, state.runnerId, state.sessionId, randomUUID(), JSON.stringify([state.eventId, event.recurrence_anchor]), JSON.stringify({ runnerPro: true }), end]);
	state.before = await saved(state);
	await page.reload();
	await openRunnerSchedule(page);
});
Then("its schedule stays locked until the draining outputs close", async ({ page, mcpWorld }) => {
	await expectLockedSchedule(page);
	const state = mcpWorld.input?.scheduleContract as State;
	expect(await saved(state)).toEqual(state.before);
});

When("they open a saved future schedule using {string}", async ({ page }, interaction: string) => {
	await fillEvent(page, { title: "Deletable schedule" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	if (interaction === "keyboard") {
		const edit = page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Deletable schedule", exact: true });
		await edit.focus();
		await edit.press("Enter");
	} else {
		await fillScheduleField(page, "Displayed date", "2027-01-04");
		await page
			.getByRole("region", { name: "Broadcast calendar", exact: true })
			.getByRole("button", { name: /Deletable schedule/ })
			.click();
	}
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toBeVisible();
});
Then("they can confirm its deletion using {string} without deleting its source or targets", async ({ page, mcpWorld }, interaction: string) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true }),
		remove = editor.getByRole("button", { name: "Delete schedule", exact: true });
	await expect(remove).toBeVisible();
	if (interaction === "keyboard") {
		await remove.focus();
		await remove.press("Enter");
	} else await remove.click();
	const confirmation = page.getByRole("dialog", { name: "Delete schedule?", exact: true });
	await expect(confirmation).toBeVisible();
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	const confirm = confirmation.getByRole("button", { name: "Delete schedule", exact: true });
	if (interaction === "keyboard") {
		await confirm.focus();
		await confirm.press("Enter");
	} else await confirm.click();
	await response;
	await expect(confirmation).toHaveCount(0);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State;
	expect(await saved(state)).toEqual([]);
	expect(await query("SELECT id FROM overlays WHERE id=$1 AND owner_id=$2", [state.owner.fixture.overlayId, state.owner.fixture.creatorId])).toHaveLength(1);
	expect(await query("SELECT id FROM runner_destinations WHERE id=$1 AND owner_id=$2", [state.targetId, state.owner.fixture.creatorId])).toHaveLength(1);
	await expect(page.getByText("No scheduled broadcasts yet.", { exact: true })).toBeVisible();
});

When("they move a saved future interval one hour using {string}", async ({ page, mcpWorld }, interaction: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Movable schedule" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = (await saved(state))[0];
	if (interaction === "keyboard") {
		const edit = page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Movable schedule", exact: true });
		await edit.focus();
		await edit.press("Enter");
		const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
		await fillScheduleField(editor, "Start time", "13:00");
		await fillScheduleField(editor, "End time", "14:00");
	} else {
		await fillScheduleField(page, "Displayed date", "2027-01-04");
		const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
		await calendar.scrollIntoViewIfNeeded();
		const column = calendar.locator('[data-slot="agenda-day-column"][data-date="2027-01-04"]');
		await column.evaluate((element) => {
			const grid = element.closest('[data-slot="agenda-time-grid"]')!;
			grid.scrollTop = (element.clientHeight * 12) / 24 - 40;
		});
		const event = column.locator('[data-slot="agenda-event"]');
		await expect(event).toHaveCount(1);
		const box = await event.boundingBox(),
			dayBox = await column.boundingBox();
		expect(box).not.toBeNull();
		expect(dayBox).not.toBeNull();
		const x = box!.x + box!.width / 2,
			y = box!.y + box!.height / 2,
			delta = dayBox!.height / 24;
		expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-slot="agenda-event"]')), { x, y })).toBe(true);
		expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-slot="agenda-day-column"]')?.getAttribute("data-date"), { x, y: y + delta })).toBe("2027-01-04");
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x, y + delta, { steps: 8 });
		await page.mouse.up();
	}
});
Then("they can save its full moved interval using {string} with the same event identity", async ({ page, mcpWorld }, interaction: string) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	await expectScheduleField(editor, "Start time", "13:00");
	await expectScheduleField(editor, "End time", "14:00");
	if (interaction === "keyboard") {
		const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
		const save = editor.getByRole("button", { name: "Save schedule", exact: true });
		await save.focus();
		await save.press("Enter");
		await response;
	} else await submit(page);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State,
		before = state.before as Record<string, unknown>,
		rows = await saved(state);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ id: before.id, recurrence_anchor: before.recurrence_anchor, configuration_revision: Number(before.configuration_revision) + 1, overlay_id: before.overlay_id, local_start_time: expect.stringMatching(/^13:00(?::00)?$/), local_end_time: expect.stringMatching(/^14:00(?::00)?$/) });
});

When("they extend a future schedule by one hour using {string}", async ({ page, mcpWorld }, interaction: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Resizable schedule" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = (await saved(state))[0];
	if (interaction === "keyboard") {
		const edit = page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Resizable schedule", exact: true });
		await edit.focus();
		await edit.press("Enter");
		await fillScheduleField(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }), "End time", "14:00");
	} else {
		await fillScheduleField(page, "Displayed date", "2027-01-04");
		const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
		await calendar.scrollIntoViewIfNeeded();
		const column = calendar.locator('[data-slot="agenda-day-column"][data-date="2027-01-04"]');
		await column.evaluate((element) => {
			const grid = element.closest('[data-slot="agenda-time-grid"]')!;
			grid.scrollTop = (element.clientHeight * 12) / 24 - 40;
		});
		const handle = column.locator(".agenda__resize-handle");
		await expect(handle).toBeVisible();
		const box = await handle.boundingBox(),
			day = await column.boundingBox();
		expect(box).not.toBeNull();
		expect(day).not.toBeNull();
		const x = box!.x + box!.width / 2,
			y = box!.y + box!.height / 2;
		expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".agenda__resize-handle")), { x, y })).toBe(true);
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x, y + day!.height / 24, { steps: 8 });
		await page.mouse.up();
	}
});
Then("they can save its extended end using {string} while retaining its start and identity", async ({ page, mcpWorld }, interaction: string) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	await expectScheduleField(editor, "Start time", "12:00");
	await expectScheduleField(editor, "End time", "14:00");
	if (interaction === "keyboard") {
		const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
		const save = editor.getByRole("button", { name: "Save schedule", exact: true });
		await save.focus();
		await save.press("Enter");
		await response;
	} else await submit(page);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State,
		before = state.before as Record<string, unknown>,
		rows = await saved(state);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ id: before.id, recurrence_anchor: before.recurrence_anchor, configuration_revision: Number(before.configuration_revision) + 1, local_start_time: before.local_start_time, local_end_time: expect.stringMatching(/^14:00(?::00)?$/) });
});

Then("the continuation has no resize end and its full end date can be edited by keyboard", async ({ page, mcpWorld }) => {
	const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
	await expect(calendar.locator('[data-slot="agenda-day-column"]').first().locator(".agenda__resize-handle")).toBeHidden();
	const state = mcpWorld.input?.scheduleContract as State,
		before = (await saved(state))[0];
	const edit = page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Week boundary vacation", exact: true });
	await edit.focus();
	await edit.press("Enter");
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expectScheduleField(editor, "Start date", "2027-01-02");
	await expectScheduleField(editor, "End date", "2027-01-13");
	await fillScheduleField(editor, "End date", "2027-01-14");
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	const save = editor.getByRole("button", { name: "Save schedule", exact: true });
	await save.focus();
	await save.press("Enter");
	await response;
	await expect(editor).toHaveCount(0);
	const rows = await saved(state);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ id: before.id, recurrence_anchor: before.recurrence_anchor, local_start_date: "2027-01-02", local_end_date: "2027-01-14" });
});

When("they create a future schedule through keyboard form controls", async ({ page }) => {
	const add = page.getByRole("button", { name: "Add schedule", exact: true });
	await expect(add).toBeEnabled();
	await add.focus();
	await add.press("Enter");
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	for (const [label, value] of Object.entries({ "Event title": "Keyboard authored", Timezone: "UTC", "Start date": "2027-01-05", "End date": "2027-01-05", "Start time": "18:30", "End time": "19:15" })) await fillScheduleField(editor, label, value);
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	const save = editor.getByRole("button", { name: "Save schedule", exact: true });
	await save.focus();
	await save.press("Enter");
	await response;
	await expect(editor).toHaveCount(0);
});
Then("the keyboard-authored schedule retains its selected dates source and targets", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State,
		rows = await saved(state);
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({ title: "Keyboard authored", local_start_date: "2027-01-05", local_end_date: "2027-01-05", local_start_time: expect.stringMatching(/^18:30(?::00)?$/), local_end_time: expect.stringMatching(/^19:15(?::00)?$/), overlay_id: state.owner.fixture.overlayId, session_id: state.sessionId });
	expect(await query("SELECT destination_id FROM runner_schedule_event_destinations WHERE event_id=$1", [rows[0].id])).toEqual([{ destination_id: state.targetId }]);
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText("Keyboard authored");
});
When("they rename a saved future schedule using {string}", async ({ page, mcpWorld }, interaction: string) => {
	await fillEvent(page, { title: "Editable schedule" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State;
	state.before = (await saved(state))[0];
	if (interaction === "keyboard") {
		const edit = page.getByRole("list", { name: "Saved schedules", exact: true }).getByRole("button", { name: "Edit Editable schedule", exact: true });
		await edit.focus();
		await edit.press("Enter");
	} else {
		await fillScheduleField(page, "Displayed date", "2027-01-04");
		await page
			.getByRole("region", { name: "Broadcast calendar", exact: true })
			.getByRole("button", { name: /Editable schedule/ })
			.click();
	}
	await page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByLabel("Event title", { exact: true }).fill("Renamed schedule");
});
Then("the renamed schedule is saved using {string} with its original bounds and source", async ({ page, mcpWorld }, interaction: string) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	if (interaction === "keyboard") {
		const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
		const save = editor.getByRole("button", { name: "Save schedule", exact: true });
		await save.focus();
		await save.press("Enter");
		await response;
	} else await submit(page);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State,
		before = state.before as Record<string, unknown>,
		rows = await saved(state);
	expect(rows).toHaveLength(1);
	for (const key of ["id", "recurrence_anchor", "local_start_date", "local_end_date", "local_start_time", "local_end_time", "timezone", "overlay_id", "session_id"]) expect(rows[0][key]).toEqual(before[key]);
	expect(rows[0].title).toBe("Renamed schedule");
	expect(rows[0].configuration_revision).toBe(Number(before.configuration_revision) + 1);
});
When("they drag an event with {string}", async ({ page, mcpWorld }, ambiguity: string) => {
	const editor = await fillEvent(page, { title: "Ambiguous schedule", zone: ambiguity === "different timezone" ? "Europe/Berlin" : "UTC" });
	if (ambiguity === "weekly recurrence") {
		await editor.getByRole("button", { name: /Recurrence$/ }).click();
		await page.getByRole("option", { name: "Weekly", exact: true }).click();
		await editor.getByRole("checkbox", { name: "Monday", exact: true }).check();
	}
	await submit(page);
	await expect(editor).toHaveCount(0);
	const state = mcpWorld.input?.scheduleContract as State;
	state.before = await saved(state);
	if (ambiguity === "different timezone") await fillScheduleField(page, "Calendar timezone", "UTC");
	await fillScheduleField(page, "Displayed date", "2027-01-04");
	const calendar = page.getByRole("region", { name: "Broadcast calendar", exact: true });
	await calendar.scrollIntoViewIfNeeded();
	const column = calendar.locator('[data-slot="agenda-day-column"][data-date="2027-01-04"]');
	const hour = ambiguity === "different timezone" ? 11 : 12;
	await column.evaluate((element, hour) => {
		element.closest('[data-slot="agenda-time-grid"]')!.scrollTop = (element.clientHeight * hour) / 24 - 40;
	}, hour);
	const box = await column.locator('[data-slot="agenda-event"]').boundingBox(),
		day = await column.boundingBox();
	expect(box).not.toBeNull();
	expect(day).not.toBeNull();
	const x = box!.x + box!.width / 2,
		y = box!.y + box!.height / 2;
	expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-slot="agenda-event"]')), { x, y })).toBe(true);
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y + day!.height / 24, { steps: 8 });
	await page.mouse.up();
});
Then("the full-event editor explains why the gesture needs explicit dates and times", async ({ page, mcpWorld }) => {
	const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
	await expect(editor).toBeVisible();
	await expect(editor.getByText("Edit the full dates and times below.", { exact: true })).toBeVisible();
	await expectScheduleField(editor, "Start time", "12:00");
	await expectScheduleField(editor, "End time", "13:00");
	const state = mcpWorld.input?.scheduleContract as State;
	expect(await saved(state)).toEqual(state.before);
});

Given("its previous captured execution is fully closed after a manual stop", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State,
		event = (await saved(state))[0];
	state.originalEnd = new Date(event.local_end_date + "T" + event.local_end_time + ":00Z").toISOString();
	state.stoppedAdmission = randomUUID();
	await query("UPDATE stream_sessions SET rtmp_url='rtmp://127.0.0.1:1949/live',desired_state='stopped',actual_state='stopped',configuration_revision=10 WHERE id=$1", [state.sessionId]);
	await query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,occurrence_id,state,configuration_revision,benefits_at_start,scheduled_end,terminal_reason,stopped_at) VALUES($1,$2,$3,$4,$5,$6,'stopped',9,$7::jsonb,$8,'manual_stop',now())", [
		state.stoppedAdmission,
		state.owner.fixture.creatorId,
		state.runnerId,
		state.sessionId,
		randomUUID(),
		JSON.stringify([state.eventId, event.recurrence_anchor]),
		JSON.stringify({ runnerPro: true, ingestModeAtStart: "24/7" }),
		state.originalEnd,
	]);
	await page.reload();
	await openRunnerSchedule(page);
});
When("they explicitly resume the stopped occurrence", async ({ page }) => {
	const resume = page.getByRole("button", { name: "Resume Active schedule", exact: true });
	await expect(resume).toBeEnabled();
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	await resume.click();
	await response;
});
Then("a new generation retains Scheduled mode and the original end without claiming output is already live", async ({ page, mcpWorld }) => {
	await expect(page.getByText("Resume requested. This occurrence keeps its original end time.", { exact: true })).toBeVisible();
	const state = mcpWorld.input?.scheduleContract as State,
		event = (await saved(state))[0],
		session = (await query("SELECT desired_state,actual_state,control_mode,configuration_revision FROM stream_sessions WHERE id=$1", [state.sessionId]))[0];
	expect(session).toMatchObject({ desired_state: "running", actual_state: "stopped", control_mode: "scheduled", configuration_revision: 11 });
	const admissions = await query("SELECT id,state,occurrence_id,scheduled_end FROM runner_broadcast_admissions WHERE session_id=$1 AND id<>$2", [state.sessionId, state.stoppedAdmission]);
	expect(admissions).toHaveLength(1);
	expect(admissions[0]).toMatchObject({ state: "reserved", occurrence_id: JSON.stringify([state.eventId, event.recurrence_anchor]) });
	expect(new Date(admissions[0].scheduled_end).toISOString()).toBe(state.originalEnd);
});

Given("its captured scheduled execution is {string}", async ({ page, mcpWorld }, executionState: string) => {
	const state = mcpWorld.input?.scheduleContract as State;
	expect(["active", "reserved"]).toContain(executionState);
	state.initialExecutionState = executionState;
	await query("UPDATE stream_sessions SET desired_state='running',actual_state=$2 WHERE id=$1", [state.sessionId, executionState === "active" ? "running" : "stopped"]);
	await query("UPDATE runner_broadcast_admissions SET state=$2::runner_admission_state,stopped_at=null,terminal_reason=null,dispatched_at=CASE WHEN $2::text='active' THEN now() ELSE null END WHERE id=$1", [state.stoppedAdmission, executionState]);
	await page.reload();
	await openRunnerSchedule(page);
});
When("they request a graceful scheduled Stop", async ({ page }) => {
	await page.keyboard.press("Escape");
	const stop = page.getByRole("button", { name: "Stop", exact: true });
	await expect(stop).toBeEnabled();
	await stop.click();
	await expect(page.getByText("Stop requested", { exact: true })).toBeVisible();
});
Then("this occurrence is durably suppressed and its original window remains locked", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	const session = (await query("SELECT desired_state,actual_state,control_mode,configuration_revision FROM stream_sessions WHERE id=$1", [state.sessionId]))[0];
	expect(session).toMatchObject({ desired_state: "stopped", actual_state: state.initialExecutionState === "active" ? "running" : "stopped", control_mode: "scheduled", configuration_revision: 11 });
	const admission = (await query("SELECT state,occurrence_id,scheduled_end,benefits_at_start FROM runner_broadcast_admissions WHERE id=$1", [state.stoppedAdmission]))[0];
	expect(admission).toMatchObject({ state: state.initialExecutionState === "active" ? "draining" : "failed_before_output", benefits_at_start: { scheduleSuppressed: true } });
	expect(new Date(admission.scheduled_end).toISOString()).toBe(state.originalEnd);
	const event = (await saved(state))[0];
	expect(admission.occurrence_id).toBe(JSON.stringify([state.eventId, event.recurrence_anchor]));
	await openRunnerSchedule(page);
	await expectLockedSchedule(page);
});

When("they submit an event overlapping an existing saved event", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await fillEvent(page, { title: "Original authoritative event" });
	await submit(page);
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true })).toHaveCount(0);
	state.before = await saved(state);
	await fillEvent(page, { title: "Rejected overlapping event", startTime: "12:30", endTime: "13:30" });
	await submit(page);
});
Then("the overlap explanation appears and the original schedule remains authoritative after reload", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await expect(page.getByRole("dialog", { name: "Schedule broadcast", exact: true }).getByRole("alert")).toContainText(/overlaps another event/i);
	expect(await saved(state)).toEqual(state.before);
	await page.reload();
	await openRunnerSchedule(page);
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).toContainText("Original authoritative event");
	await expect(page.getByRole("list", { name: "Saved schedules", exact: true })).not.toContainText("Rejected overlapping event");
	expect(await saved(state)).toEqual(state.before);
});

Given("that scheduled broadcast currently has a captured running execution", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State,
		event = (await saved(state))[0];
	state.originalEnd = new Date(event.local_end_date + "T" + event.local_end_time + ":00Z").toISOString();
	state.stoppedAdmission = randomUUID();
	await query("UPDATE stream_sessions SET rtmp_url='rtmp://127.0.0.1:1949/live',desired_state='running',actual_state='running',configuration_revision=10 WHERE id=$1", [state.sessionId]);
	await query("INSERT INTO runner_broadcast_admissions(id,owner_id,runner_id,session_id,execution_generation,occurrence_id,state,configuration_revision,benefits_at_start,scheduled_end,dispatched_at) VALUES($1,$2,$3,$4,$5,$6,'active',9,$7::jsonb,$8,now())", [
		state.stoppedAdmission,
		state.owner.fixture.creatorId,
		state.runnerId,
		state.sessionId,
		randomUUID(),
		JSON.stringify([state.eventId, event.recurrence_anchor]),
		JSON.stringify({ runnerPro: true, ingestModeAtStart: "24/7" }),
		state.originalEnd,
	]);
	await page.reload();
	await openRunnerSchedule(page);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Broadcast schedule", exact: true })).not.toBeVisible();
	await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeEnabled();
	expect((await query("SELECT actual_state FROM stream_sessions WHERE id=$1", [state.sessionId]))[0].actual_state).toBe("running");
});
When("they pause schedule automation", async ({ page }) => {
	await openRunnerSchedule(page);
	const button = page.getByRole("button", { name: "Pause automation", exact: true });
	await expect(button).toBeEnabled();
	const response = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dashboard/runners/"));
	await button.click();
	await response;
});
Then("automation is paused without changing Scheduled mode or the current broadcast end", async ({ page, mcpWorld }) => {
	const state = mcpWorld.input?.scheduleContract as State;
	await expect(page.getByText("Automation paused. This broadcast keeps its scheduled end; you can still stop it.", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Resume automation", exact: true })).toBeEnabled();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeEnabled();
	const session = (await query("SELECT control_mode,configuration_revision,automation_revision,automation_paused_at,desired_state,actual_state FROM stream_sessions WHERE id=$1", [state.sessionId]))[0];
	expect(session).toMatchObject({ control_mode: "scheduled", configuration_revision: 10, automation_revision: 1, desired_state: "running", actual_state: "running" });
	expect(session.automation_paused_at).not.toBeNull();
	const capture = (await query("SELECT state,scheduled_end FROM runner_broadcast_admissions WHERE id=$1", [state.stoppedAdmission]))[0];
	expect(capture.state).toBe("active");
	expect(new Date(capture.scheduled_end).toISOString()).toBe(state.originalEnd);
	await page.reload();
	await openRunnerSchedule(page);
	await expect(page.getByRole("button", { name: "Resume automation", exact: true })).toBeEnabled();
	await expect(page.getByText("Automation paused. This broadcast keeps its scheduled end; you can still stop it.", { exact: true })).toBeVisible();
});
