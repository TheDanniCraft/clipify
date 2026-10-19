import { test, expect, type Locator } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
async function fillDate(scope: Locator, label: string, value: string) {
	const field = scope.getByText(label, { exact: true }).locator('xpath=ancestor::*[@data-slot="date-picker"][1]');
	for (const [part, text] of [
		["year", value.slice(0, 4)],
		["month", String(Number(value.slice(5, 7)))],
		["day", String(Number(value.slice(8, 10)))],
	]) {
		const names: Record<string, string> = { year: "year|Jahr", month: "month|Monat", day: "day|Tag" };
		const segment = field.getByRole("spinbutton", { name: new RegExp(`^(${names[part]}),`, "i") });
		await segment.focus();
		await segment.pressSequentially(text);
	}
}
for (const locale of ["en-US", "de-DE"])
	test(`calendar all-day setup and displayed dates follow ${locale}`, async ({ browser, request }, testInfo) => {
		test.setTimeout(120000);
		const context = await browser.newContext({ locale, timezoneId: "Europe/Berlin", viewport: { width: 1280, height: 900 } });
		const page = await context.newPage();
		page.setDefaultTimeout(20000);
		const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
		let owner: AuthFixture | undefined;
		const hydrationErrors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error" && /hydrat/i.test(message.text())) hydrationErrors.push(message.text());
		});
		try {
			owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
			const runnerId = randomUUID(),
				sessionId = randomUUID(),
				targetId = randomUUID();
			await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Calendar review',$3,'online',now(),2,$4::jsonb)", [runnerId, owner.fixture.creatorId, randomUUID(), JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
			await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Review output','custom','rtmp://127.0.0.1:1949/live')", [targetId, owner.fixture.creatorId]);
			await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode) VALUES($1,$2,$3,$4,'24/7','scheduled')", [sessionId, owner.fixture.creatorId, runnerId, owner.fixture.overlayId]);
			await pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, targetId, owner.fixture.creatorId]);
			await page.goto("/legal/cookies");
			await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
			const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
			await preferences.focus();
			await preferences.press("Enter");
			await Promise.all([page.waitForEvent("load"), page.getByRole("dialog", { name: "Privacy preferences", exact: true }).getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await page.goto("/legal/privacy");
			const published = page.locator("time[datetime]").first();
			const value = await published.getAttribute("datetime");
			expect(value).toBeTruthy();
			await expect(published).toHaveText(new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(value!)));
			await page.goto(`/dashboard/runners/${runnerId}`);
			await page.getByRole("button", { name: "Schedule", exact: true }).click();
			const schedule = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
			const calendar = schedule.getByRole("region", { name: "Broadcast calendar", exact: true });
			await expect(calendar.getByRole("button", { name: "Pause automation", exact: true }).locator("svg")).toBeVisible();
			await calendar.getByRole("button", { name: "Pause automation", exact: true }).click();
			await calendar.getByRole("button", { name: "Resume automation", exact: true }).click();

			const displayed = calendar.getByText("Displayed date", { exact: true }).locator('xpath=ancestor::*[@data-slot="date-picker"][1]');
			await expect(displayed.getByRole("spinbutton")).toHaveCount(3);
			const order = await displayed.getByRole("spinbutton").evaluateAll((nodes) =>
				nodes.map((node) => {
					const maximum = Number(node.getAttribute("aria-valuemax"));
					return maximum > 31 ? "year" : maximum === 12 ? "month" : "day";
				}),
			);
			expect(order).toEqual(locale === "en-US" ? ["month", "day", "year"] : ["day", "month", "year"]);
			const dates = (await pool.query("SELECT to_char((now() AT TIME ZONE 'Europe/Berlin')+interval '7 days','YYYY-MM-DD') AS start,to_char((now() AT TIME ZONE 'Europe/Berlin')+interval '8 days','YYYY-MM-DD') AS finish,to_char((now() AT TIME ZONE 'Europe/Berlin')+interval '9 days','YYYY-MM-DD') AS exclusive")).rows[0];
			await fillDate(calendar, "Displayed date", dates.start);
			await calendar.getByRole("button", { name: "Add schedule", exact: true }).click();
			const editor = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
			await editor.getByRole("textbox", { name: /^Event title\*?$/ }).fill("All-day vacation");
			await editor.getByText("All day", { exact: true }).click();
			await expect(editor.getByRole("checkbox", { name: "All day", exact: true })).toBeChecked();
			await expect(editor.getByText("Start time", { exact: true })).toHaveCount(0);
			await fillDate(editor, "Start date", dates.start);
			await fillDate(editor, "End date", dates.finish);
			await editor.getByRole("button", { name: "Save schedule", exact: true }).click();
			await expect(editor).not.toBeVisible();
			const stored = (await pool.query("SELECT local_start_date,local_end_date,local_start_time,local_end_time FROM runner_schedule_events WHERE owner_id=$1", [owner.fixture.creatorId])).rows;
			expect(stored).toEqual([{ local_start_date: dates.start, local_end_date: dates.exclusive, local_start_time: "00:00", local_end_time: "00:00" }]);
			const bar = calendar.locator('[data-slot="agenda-all-day-event"]').filter({ hasText: "All-day vacation" });
			await expect(bar).toBeVisible();
			await expect(calendar.locator('[data-slot="agenda-event"]').filter({ hasText: "All-day vacation" })).toHaveCount(0);
			await bar.focus();
			await bar.press("Enter");
			await expect(editor).toBeVisible();
			await expect(editor.getByRole("checkbox", { name: "All day", exact: true })).toBeChecked();
			await expect(editor.getByRole("spinbutton", { name: /^(day|Tag), End date/i })).toHaveAttribute("aria-valuenow", String(Number(dates.finish.slice(8, 10))));
			await editor.getByRole("button", { name: "Cancel", exact: true }).click();
			await calendar.getByRole("radio", { name: "Month", exact: true }).click();
			const spanning = calendar.locator('[data-slot="agenda-month-spanning-event"]').filter({ hasText: "All-day vacation" }).first();
			await expect(spanning).toBeVisible();
			await schedule.getByRole("button", { name: "Add schedule", exact: true }).scrollIntoViewIfNeeded();
			await schedule.screenshot({ path: testInfo.outputPath(`calendar-${locale}-month.png`), animations: "disabled" });
			await spanning.click();
			await expect(editor.getByRole("checkbox", { name: "All day", exact: true })).toBeChecked();
			await editor.getByRole("button", { name: "Cancel", exact: true }).click();
			await calendar.getByRole("radio", { name: "Week", exact: true }).click();

			for (const theme of ["dark", "light"]) {
				if (theme === "light") {
					await page.keyboard.press("Escape");
					await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
					await page.getByRole("button", { name: "Schedule", exact: true }).click();
					await fillDate(calendar, "Displayed date", dates.start);
				}
				await schedule.getByRole("button", { name: "Add schedule", exact: true }).scrollIntoViewIfNeeded();
				await schedule.screenshot({ path: testInfo.outputPath(`calendar-${locale}-${theme}-desktop.png`), animations: "disabled" });
				await page.setViewportSize({ width: 390, height: 844 });
				await calendar.getByRole("radio", { name: "Day", exact: true }).click();
				await expect(bar).toBeVisible();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				await schedule.getByRole("button", { name: "Add schedule", exact: true }).scrollIntoViewIfNeeded();
				await schedule.screenshot({ path: testInfo.outputPath(`calendar-${locale}-${theme}-mobile.png`), animations: "disabled" });
				await page.setViewportSize({ width: 1280, height: 900 });
			}
			expect(hydrationErrors).toEqual([]);
		} finally {
			await pool.end();
			if (owner) {
				const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
				expect(response.status()).toBe(204);
			}
			await context.close();
		}
	});
