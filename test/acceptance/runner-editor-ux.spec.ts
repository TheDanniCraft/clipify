import { test, expect as baseExpect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
test.describe.configure({ mode: "serial" });
test.use({ timezoneId: "Europe/Berlin" });
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(180000);
async function expectScheduleActionAlignment(page: Page) {
	const control = page.getByRole("button", { name: / Control$/ });
	const action = page.getByRole("button", { name: "Schedule", exact: true });
	await expect
		.poll(async () => {
			const selectorBounds = await control.boundingBox();
			const actionBounds = await action.boundingBox();
			if (!selectorBounds || !actionBounds || actionBounds.x < selectorBounds.x + selectorBounds.width) return Infinity;
			return Math.abs(selectorBounds.y + selectorBounds.height - actionBounds.y - actionBounds.height);
		})
		.toBeLessThan(2);
}

async function prepare(page: Page) {
	await page.goto("/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const button = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await button.focus();
	await button.press("Enter");
	const dialog = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
	await expect(dialog).toBeVisible();
	await Promise.all([page.waitForEvent("load"), dialog.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(dialog).not.toBeVisible();
}
for (const plan of ["free", "pro"] as const)
	test(`${plan} Runner setup and appearance follow the Clipify editor flow`, async ({ page, request, context }, testInfo) => {
		page.setDefaultTimeout(30000);
		let owner: AuthFixture | undefined;
		const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
		try {
			owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
			const runnerId = randomUUID();
			await pool.query("UPDATE users SET plan=$1 WHERE id=$2", [plan, owner.fixture.creatorId]);
			await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'UX acceptance Runner',$3,'online',now(),2,$4::jsonb)", [runnerId, owner.fixture.creatorId, randomUUID(), JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
			await prepare(page);
			await page.goto(`/dashboard/runners/${runnerId}`);
			await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible({ timeout: 60000 });
			await expect(page.getByRole("heading", { name: "Runner Settings", exact: true })).toBeVisible();
			const runnerCard = page.getByRole("button", { name: "Back to runners", exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
			await expect(runnerCard.locator('[data-slot="card-header"]').getByRole("heading", { name: "UX acceptance Runner", exact: true })).toBeVisible();
			await expect(runnerCard.locator('[data-slot="card-header"]').getByRole("button", { name: "Unlink runner", exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Unlink runner", exact: true })).toHaveText("");
			const appearanceAction = page.getByRole("button", { name: "Appearance", exact: true });
			await expect
				.poll(async () => {
					const available = await appearanceAction.locator("..").evaluate((node) => {
						const style = getComputedStyle(node);
						return node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
					});
					const bounds = await appearanceAction.boundingBox();
					return bounds ? Math.abs(bounds.width - available) : Infinity;
				})
				.toBeLessThan(2);
			await expect(page.getByRole("heading", { name: "Broadcast schedule", exact: true })).toHaveCount(0);
			const selector = page.getByRole("group", { name: "Broadcast destinations", exact: true });
			const add = selector.getByRole("button", { name: "Add destination", exact: true });
			await expect(add).toBeVisible();
			const mainSave = page.getByRole("button", { name: "Save Configuration", exact: true });
			await expect(mainSave).toBeEnabled();
			await add.click();
			const manager = page.getByRole("dialog", { name: "Manage destinations", exact: true });
			await manager.getByRole("button", { name: "Add destination", exact: true }).click();
			const editor = page.getByRole("dialog", { name: "Add destination", exact: true });
			await editor.getByRole("textbox", { name: "Destination name", exact: true }).fill("My local output");
			await expect(editor.getByLabel("Destination stream key", { exact: true })).toHaveValue("");
			await expect(editor.getByRole("button", { name: "Save destination", exact: true })).toBeDisabled();
			await expect(editor.getByRole("textbox", { name: "RTMP URL", exact: true })).toHaveCount(0);
			await editor.getByRole("button", { name: /Provider$/ }).click();
			await page.getByRole("option", { name: "YouTube", exact: true }).click();
			await expect(editor.getByRole("textbox", { name: "RTMP URL", exact: true })).toHaveCount(0);
			await editor.screenshot({ path: testInfo.outputPath(`${plan}-youtube-destination.png`), animations: "disabled" });
			await editor.getByRole("button", { name: /Provider$/ }).click();
			await page.getByRole("option", { name: "Custom RTMP", exact: true }).click();
			await editor.getByRole("textbox", { name: "RTMP URL", exact: true }).fill("rtmp://127.0.0.1:19350/live");
			await editor.getByLabel("Destination stream key", { exact: true }).fill("fixture-original-stream-key");
			await editor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(editor).not.toBeVisible();
			await expect(manager.getByRole("button", { name: "Add destination", exact: true })).toBeFocused();
			await manager.getByRole("button", { name: "Add destination", exact: true }).click();
			await editor.getByRole("textbox", { name: "Destination name", exact: true }).fill("Backup output for the community broadcast");
			await editor.getByRole("button", { name: /Provider$/ }).click();
			await page.getByRole("option", { name: "Custom RTMP", exact: true }).click();
			await editor.getByRole("textbox", { name: "RTMP URL", exact: true }).fill("rtmp://backup-livestream.internal.example:1935/live");
			await editor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(editor).not.toBeVisible();
			const savedTable = manager.locator('table[aria-label="Saved destinations"]');
			await expect(savedTable).toBeVisible();
			await expect(savedTable.getByRole("row")).toHaveCount(3);
			const destinationRow = savedTable.getByRole("row").filter({ hasText: "My local output" });
			const editDestination = destinationRow.getByRole("button", { name: "Edit My local output", exact: true });
			const deleteDestination = destinationRow.getByRole("button", { name: "Delete My local output", exact: true });
			for (const viewport of [
				{ width: 1280, height: 900 },
				{ width: 390, height: 844 },
			]) {
				await page.setViewportSize(viewport);
				await expect(editDestination).toBeVisible();
				await expect(deleteDestination).toBeVisible();
				await expect
					.poll(async () => {
						const editBounds = await editDestination.boundingBox();
						const deleteBounds = await deleteDestination.boundingBox();
						return editBounds && deleteBounds ? deleteBounds.x - editBounds.x - editBounds.width : 0;
					})
					.toBeGreaterThanOrEqual(8);
				expect(await savedTable.evaluate((node) => node.scrollWidth <= node.parentElement!.clientWidth)).toBe(true);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				await page.screenshot({ path: testInfo.outputPath(`${plan}-destinations-${viewport.width}.png`), fullPage: true, animations: "disabled" });
			}
			await page.setViewportSize({ width: 1280, height: 900 });
			await editDestination.focus();
			await page.keyboard.press("Enter");
			const destinationEditor = page.getByRole("dialog", { name: "Edit destination", exact: true });
			await expect(destinationEditor.getByRole("textbox", { name: "Destination name", exact: true })).toHaveValue("My local output");
			await destinationEditor.getByRole("button", { name: "Cancel", exact: true }).click();
			await expect(destinationEditor).not.toBeVisible();
			await expect(destinationRow).toBeFocused();
			await page.keyboard.press("ArrowLeft");
			await expect(destinationRow.getByRole("gridcell").last()).toBeFocused();
			await page.keyboard.press("Tab");
			await expect(editDestination).toBeFocused();
			await page.keyboard.press("Enter");
			const streamKey = destinationEditor.getByLabel("Destination stream key", { exact: true });
			await expect(destinationEditor.getByText("Stream key action", { exact: true })).toHaveCount(0);
			await expect(streamKey).toHaveAttribute("type", "password");
			await expect(streamKey).toHaveAttribute("placeholder", "••••••••");
			await expect(streamKey).toHaveValue("");
			const credential = async () => (await pool.query("SELECT encrypted_stream_key, credential_revision FROM runner_destinations WHERE runner_id=$1 AND name=$2", [runnerId, "My local output"])).rows[0];
			const originalCredential = await credential();
			await destinationEditor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(destinationEditor).not.toBeVisible();
			expect(await credential()).toEqual(originalCredential);
			await editDestination.click();
			await streamKey.fill("fixture-replacement-stream-key");
			await destinationEditor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(destinationEditor).not.toBeVisible();
			const replacedCredential = await credential();
			expect(replacedCredential.credential_revision).toBe(originalCredential.credential_revision + 1);
			expect(replacedCredential.encrypted_stream_key).not.toBe(originalCredential.encrypted_stream_key);
			await editDestination.click();
			await expect(streamKey).toHaveValue("");
			await expect(streamKey).toHaveAttribute("placeholder", "••••••••");
			await destinationEditor.screenshot({ path: testInfo.outputPath(`${plan}-stream-key.png`), animations: "disabled" });
			await streamKey.fill("fixture-cancelled-replacement");
			await destinationEditor.getByRole("button", { name: "Cancel", exact: true }).click();
			expect(await credential()).toEqual(replacedCredential);
			await expect(destinationEditor).not.toBeVisible();
			await deleteDestination.click();
			const deletion = page.getByRole("dialog", { name: "Delete destination?", exact: true });
			await expect(deletion).toBeVisible();
			await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
			await expect(destinationRow).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(manager).not.toBeVisible();
			await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			await selector.getByRole("button", { name: "Manage destinations", exact: true }).click();
			await expect(savedTable).toBeVisible();
			await page.screenshot({ path: testInfo.outputPath(`${plan}-destinations-light.png`), fullPage: true, animations: "disabled" });
			await page.keyboard.press("Escape");
			await expect(manager).not.toBeVisible();
			await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			await expect(selector.getByRole("button", { name: /Broadcast destinations$/ })).toContainText("My local output");
			let failSave = true;
			await page.route(`**/dashboard/runners/${runnerId}`, async (route) => {
				if (failSave && route.request().method() === "POST" && route.request().postData()?.includes("destinationIds")) {
					failSave = false;
					await route.abort("failed");
				} else await route.continue();
			});
			await mainSave.click();
			await expect(page.getByRole("alert").filter({ hasText: "Your changes are kept" })).toBeVisible();
			await expect(mainSave).toBeEnabled();
			await expect(selector.getByRole("button", { name: /Broadcast destinations$/ })).toContainText("My local output");
			await mainSave.click();
			await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
			await selector.getByRole("button", { name: "Manage destinations", exact: true }).click();
			await manager.getByRole("button", { name: "Delete My local output", exact: true }).click();
			const confirmedDeletion = page.getByRole("dialog", { name: "Delete destination?", exact: true });
			await page.screenshot({ path: testInfo.outputPath(`${plan}-destination-delete-confirm.png`), fullPage: true, animations: "disabled" });
			await confirmedDeletion.getByRole("button", { name: "Delete destination", exact: true }).click();
			await expect(confirmedDeletion).not.toBeVisible();
			await expect(manager.getByRole("button", { name: "Delete My local output", exact: true })).toHaveCount(0);
			await expect(manager.getByRole("button", { name: "Add destination", exact: true })).toBeFocused();
			await page.keyboard.press("Escape");
			await expect(manager).not.toBeVisible();
			await expect(selector.getByRole("button", { name: /^Choose destinations(?: Broadcast destinations)?$/ })).toContainText("Choose destinations");
			await expect(page.getByRole("button", { name: "Start", exact: true })).toBeDisabled();
			await page.screenshot({ path: testInfo.outputPath(`${plan}-destination-deleted.png`), fullPage: true, animations: "disabled" });
			const detached = await pool.query("SELECT rtmp_url, encrypted_stream_key IS NOT NULL AS has_key FROM stream_sessions WHERE runner_id=$1 AND owner_id=$2", [runnerId, owner.fixture.creatorId]);
			expect(detached.rows).toEqual([{ rtmp_url: "", has_key: false }]);
			await page.reload();
			await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
			await expect(selector.getByRole("button", { name: /^Choose destinations(?: Broadcast destinations)?$/ })).toContainText("Choose destinations");
			await selector.getByRole("button", { name: /^Choose destinations(?: Broadcast destinations)?$/ }).click();
			await page.getByRole("option", { name: /Backup output for the community broadcast/ }).click();
			if (await page.getByRole("listbox").isVisible()) await page.keyboard.press("Escape");
			await mainSave.click();
			await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
			const control = page.getByRole("button", { name: / Control$/ });
			await control.click();
			const scheduled = page.getByRole("option", { name: /Scheduled/ });
			await expect(scheduled).not.toContainText("Pro · Clip playback");
			if (plan === "free") {
				await expect(scheduled.getByRole("img", { name: "Requires Pro" })).toBeVisible();
				await expect(scheduled.locator("svg.tabler-icon-crown")).toBeVisible();
				let priceFixtureApplied = false;
				const checkoutAttempts: string[] = [];
				const upgradeRoute = `**/dashboard/runners/${runnerId}`;
				await page.route(upgradeRoute, async (route) => {
					if (route.request().method() !== "POST") return route.continue();
					const body = route.request().postData() ?? "";
					if (body.includes('"product":"pro"')) {
						checkoutAttempts.push(body);
						return route.abort("failed");
					}
					const response = await route.fetch();
					const original = await response.text();
					// Synthetic price transport only; actual auth, ownership, server actions and widgets stay real.
					const fixture = original.replace('"monthly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"monthly":{"amount":2,"currency":"EUR","formatted":"€2.00"}').replace('"yearly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"yearly":{"amount":20,"currency":"EUR","formatted":"€20.00"}');
					if (fixture !== original) priceFixtureApplied = true;
					return route.fulfill({ response, body: fixture });
				});
				await scheduled.click();
				const upgrade = page.getByRole("dialog", { name: "Schedule your broadcasts with Pro", exact: true });
				await expect(upgrade).toBeVisible();
				await expect(upgrade.getByText("Plan when your clips go live and let your Runner follow the schedule.", { exact: true })).toBeVisible();
				await expect(upgrade.getByText("Also included with Pro", { exact: true })).toBeVisible();
				await expect(upgrade.getByRole("link", { name: "Compare Free and Pro", exact: true })).toHaveAttribute("href", "/pricing");
				await expect(upgrade.getByRole("button", { name: "Upgrade to Pro for €20.00/year", exact: true })).toBeEnabled();
				expect(priceFixtureApplied).toBe(true);
				await expect(upgrade.getByRole("listitem")).toHaveCount(6);
				await expect(upgrade.getByText(/^Advanced Runner broadcasting:/)).toHaveCount(0);
				const monthlyTab = upgrade.getByRole("tab", { name: "Monthly", exact: true });
				await monthlyTab.focus();
				await monthlyTab.press("Enter");
				await expect(monthlyTab).toHaveAttribute("aria-selected", "true");
				const monthlyCheckout = upgrade.getByRole("button", { name: "Upgrade to Pro for €2.00/month", exact: true });
				await expect(monthlyCheckout).toBeEnabled();
				await monthlyCheckout.click();
				await expect(upgrade.getByRole("alert")).toHaveText("Could not open checkout. Please try again.");
				expect(checkoutAttempts).toHaveLength(1);
				expect(checkoutAttempts[0]).toContain('"billingCycle":"monthly"');
				await expect(monthlyCheckout).toBeEnabled();
				await upgrade.getByRole("tab", { name: "Yearly", exact: true }).click();
				for (const theme of ["dark", "light"]) {
					if (theme === "light") {
						await page.keyboard.press("Escape");
						await expect(upgrade).not.toBeVisible();
						if (await page.getByRole("listbox").isVisible()) await page.keyboard.press("Escape");
						await page.setViewportSize({ width: 1280, height: 900 });
						await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
						await control.click();
						await scheduled.click();
					}
					for (const viewport of [
						{ width: 1280, height: 900 },
						{ width: 390, height: 844 },
					]) {
						await page.setViewportSize(viewport);
						await expect(upgrade.getByRole("button", { name: "Upgrade to Pro for €20.00/year", exact: true })).toBeVisible();
						expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
						await upgrade.screenshot({ path: testInfo.outputPath(`upgrade-${theme}-${viewport.width}.png`), animations: "disabled" });
					}
				}
				await page.keyboard.press("Escape");
				await page.setViewportSize({ width: 1280, height: 900 });
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
				await expect(upgrade).not.toBeVisible();
				await page.unroute(upgradeRoute);
				await expect(control).toContainText("Manual");
			} else {
				await scheduled.click();
				await expect(page.getByRole("button", { name: "Schedule", exact: true })).toBeDisabled();
				await mainSave.click();
				await expect(page.getByRole("button", { name: "Schedule", exact: true })).toBeEnabled();
				await expect(page.getByRole("dialog", { name: "Broadcast schedule", exact: true })).toHaveCount(0);
				await expectScheduleActionAlignment(page);
				await page.screenshot({ path: testInfo.outputPath("pro-schedule-action-dark.png"), fullPage: true, animations: "disabled" });
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
				await page.screenshot({ path: testInfo.outputPath("pro-schedule-action-light.png"), fullPage: true, animations: "disabled" });
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
				await page.getByRole("button", { name: "Schedule", exact: true }).click();
				const schedule = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
				await expect(schedule).toBeVisible();
				await expect(schedule.getByRole("button", { name: "Today", exact: true })).toBeVisible();
				await expect(schedule.getByRole("combobox", { name: "Calendar timezone", exact: true })).toHaveValue("Europe/Berlin");
				await schedule.getByRole("button", { name: "Add schedule", exact: true }).click();
				const event = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
				await expect(event).toBeVisible();
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				const titleField = event.getByRole("textbox", { name: /^Event title\*?$/ });
				await expect(titleField).toHaveAttribute("aria-invalid", "true");
				await expect(titleField).toBeFocused();
				await expect(titleField).toHaveAccessibleDescription("Enter an event title.");
				await event.screenshot({ path: testInfo.outputPath("schedule-title-error-dark.png"), animations: "disabled" });
				await titleField.fill("   ");
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				await expect(titleField).toHaveAccessibleDescription("Enter an event title.");
				await titleField.fill("x".repeat(81));
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				await expect(titleField).toHaveAccessibleDescription("Use 80 characters or fewer.");

				await titleField.fill("Vacation broadcast");
				await expect(titleField).not.toHaveAttribute("aria-invalid", "true");
				const scheduleDestinations = event.getByRole("group", { name: "Schedule destinations", exact: true });
				const destinationSelect = scheduleDestinations.getByRole("button", { name: /Schedule destinations$/ });
				await destinationSelect.click();
				await expect(page.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
				const backupOption = page.getByRole("option", { name: /Backup output for the community broadcast/ });
				await expect(backupOption).toHaveAttribute("aria-selected", "true");
				await backupOption.click();
				await expect(backupOption).toHaveAttribute("aria-selected", "false");
				await backupOption.click();
				await page.keyboard.press("Escape");
				await expect(event).toBeVisible();
				await expect(destinationSelect).toContainText("Backup output for the community broadcast");
				await event.screenshot({ path: testInfo.outputPath("schedule-destinations-desktop.png"), animations: "disabled" });
				await page.setViewportSize({ width: 390, height: 844 });
				await destinationSelect.click();
				await expect(backupOption).toBeVisible();
				await page.screenshot({ path: testInfo.outputPath("schedule-destinations-mobile.png"), animations: "disabled" });
				await page.keyboard.press("Escape");
				await page.setViewportSize({ width: 1280, height: 900 });

				const endDay = event.getByRole("spinbutton", { name: /day, End date/i });
				await endDay.focus();
				await endDay.press("ArrowUp");
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				await expect(event).not.toBeVisible();
				await expect(schedule.getByText("Vacation broadcast", { exact: true }).first()).toBeVisible();
				const stored = (await pool.query("SELECT local_start_date,local_end_date FROM runner_schedule_events WHERE owner_id=$1", [owner.fixture.creatorId])).rows;
				expect(stored).toHaveLength(1);
				expect(String(stored[0].local_end_date) > String(stored[0].local_start_date)).toBe(true);
				const savedTargets = await pool.query("SELECT d.name FROM runner_schedule_event_destinations s JOIN runner_destinations d ON d.id=s.destination_id WHERE s.owner_id=$1", [owner.fixture.creatorId]);
				expect(savedTargets.rows).toEqual([{ name: "Backup output for the community broadcast" }]);

				await page.keyboard.press("Escape");
				await expect(schedule).not.toBeVisible();
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
				await page.getByRole("button", { name: "Schedule", exact: true }).click();
				await schedule.getByRole("button", { name: "Add schedule", exact: true }).click();
				await expect(event).toBeVisible();
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				await expect(event.getByRole("textbox", { name: /^Event title\*?$/ })).toHaveAccessibleDescription("Enter an event title.");
				await event.screenshot({ path: testInfo.outputPath("schedule-destinations-light-desktop.png"), animations: "disabled" });
				await page.setViewportSize({ width: 390, height: 844 });
				await event.getByRole("group", { name: "Schedule destinations", exact: true }).scrollIntoViewIfNeeded();
				await event.screenshot({ path: testInfo.outputPath("schedule-destinations-light-mobile.png"), animations: "disabled" });
				await page.keyboard.press("Escape");
				await expect(event).not.toBeVisible();
				await page.keyboard.press("Escape");
				await expect(schedule).not.toBeVisible();
				await page.setViewportSize({ width: 1280, height: 900 });
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();

				const lockedId = randomUUID();
				await pool.query(
					"INSERT INTO runner_schedule_events (id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) SELECT $2::uuid,owner_id,runner_id,session_id,overlay_id,'Locked broadcast',timezone,'once',$2::text,to_char((now() AT TIME ZONE timezone)-interval '30 minutes','YYYY-MM-DD'),to_char((now() AT TIME ZONE timezone)+interval '30 minutes','YYYY-MM-DD'),to_char((now() AT TIME ZONE timezone)-interval '30 minutes','HH24:MI'),to_char((now() AT TIME ZONE timezone)+interval '30 minutes','HH24:MI') FROM runner_schedule_events WHERE owner_id=$1 LIMIT 1",
					[owner.fixture.creatorId, lockedId],
				);
				await pool.query("UPDATE runner_schedule_events SET local_start_date=to_char((now() AT TIME ZONE timezone)+interval '2 hours','YYYY-MM-DD'),local_start_time=to_char((now() AT TIME ZONE timezone)+interval '2 hours','HH24:MI'),local_end_date=to_char((now() AT TIME ZONE timezone)+interval '26 hours','YYYY-MM-DD'),local_end_time=to_char((now() AT TIME ZONE timezone)+interval '26 hours','HH24:MI') WHERE owner_id=$1 AND id<>$2", [owner.fixture.creatorId, lockedId]);
				for (const theme of ["dark", "light"]) {
					if (theme === "light") await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
					await page.getByRole("button", { name: "Schedule", exact: true }).click();
					await expect(schedule).toBeVisible();
					const calendar = schedule.getByRole("region", { name: "Broadcast calendar" });
					for (const view of ["Week", "Month", "Day"]) {
						await calendar.getByRole("radio", { name: view, exact: true }).click();
						const locked = calendar.locator('[data-slot="agenda-event"], [data-slot="agenda-month-event"], [data-slot="agenda-month-spanning-event"]').filter({ hasText: "Locked broadcast" }).first();
						const editable = calendar.locator('[data-slot="agenda-event"], [data-slot="agenda-month-event"], [data-slot="agenda-month-spanning-event"]').filter({ hasText: "Vacation broadcast" }).first();
						await expect(locked.getByRole("img", { name: "Locked event", exact: true })).toBeVisible();
						await expect(locked).toHaveCSS("border-top-style", "solid");
						await expect(editable).toHaveCSS("border-top-style", "dashed");
						expect(await locked.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(await editable.evaluate((node) => getComputedStyle(node).backgroundColor));
						await locked.scrollIntoViewIfNeeded();
						await locked.click();
						const details = page.getByRole("dialog", { name: "Broadcast details", exact: true });
						await expect(details).toBeVisible();
						await expect(details.getByText("Broadcast settings are read-only. You can still rename this event.", { exact: true })).toBeVisible();
						await expect(details.getByRole("button", { name: "Delete schedule", exact: true })).toHaveCount(0);
						await expect(details.getByRole("button", { name: "Save schedule", exact: true })).toHaveCount(0);
						await expect(details.getByRole("button", { name: "Save title", exact: true })).toBeDisabled();
						await details.getByRole("button", { name: "Close", exact: true }).last().click();
						await expect(event).not.toBeVisible();
						await calendar.screenshot({ path: testInfo.outputPath(`event-states-${theme}-${view}.png`), animations: "disabled" });
						if (view === "Day") {
							await page.setViewportSize({ width: 390, height: 844 });
							await locked.scrollIntoViewIfNeeded();
							const bounds = await locked.boundingBox();
							const icon = await locked.getByRole("img", { name: "Locked event", exact: true }).boundingBox();
							expect(bounds && icon).toBeTruthy();
							expect(Math.abs(bounds!.x + bounds!.width - icon!.x - icon!.width)).toBeLessThan(7);
							expect(Math.abs(bounds!.y + bounds!.height - icon!.y - icon!.height)).toBeLessThan(7);
							await calendar.screenshot({ path: testInfo.outputPath(`event-states-${theme}-mobile.png`), animations: "disabled" });
							await page.setViewportSize({ width: 1280, height: 900 });
						}
					}
					await page.keyboard.press("Escape");
					await expect(schedule).not.toBeVisible();
				}
				await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			}
			await page.getByRole("button", { name: "Appearance", exact: true }).click();
			const appearance = page.getByRole("dialog", { name: "Appearance", exact: true });
			await expect(appearance).toBeVisible();
			await expect
				.poll(async () => {
					const bounds = await appearance.boundingBox();
					return bounds ? Math.abs(bounds.y + bounds.height / 2 - page.viewportSize()!.height / 2) : Infinity;
				})
				.toBeLessThan(3);
			await expect(appearance.locator("input[type=color]")).toHaveCount(0);
			const preview = appearance.locator('iframe[title="Runner appearance preview"]');
			await expect(preview).toBeVisible();
			await expect(preview.contentFrame().locator("[data-runner-layout-status]")).toHaveAttribute("data-runner-layout-status", /placed|clean/);
			const standbyTab = appearance.getByRole("tab", { name: "Standby", exact: true });
			const clipsTab = appearance.getByRole("tab", { name: "Clips", exact: true });
			let tabNavigations = 0;
			page.on("request", (request) => {
				if (request.resourceType() === "document" && new URL(request.url()).pathname === `/runner/preview/${runnerId}`) tabNavigations++;
			});
			await standbyTab.focus();
			await standbyTab.press("ArrowRight");
			await expect(clipsTab).toHaveAttribute("aria-selected", "true");
			await expect(preview.contentFrame().locator("[data-runner-preview-revision]")).toHaveAttribute("data-runner-preview-revision", /"previewMode":"playback"/);
			await clipsTab.press("ArrowLeft");
			await expect(standbyTab).toHaveAttribute("aria-selected", "true");
			await expect(preview.contentFrame().locator("[data-runner-preview-revision]")).toHaveAttribute("data-runner-preview-revision", /"previewMode":"standby"/);
			expect(tabNavigations).toBe(0);
			const positions = appearance.getByRole("radiogroup", { name: "Attribution position", exact: true });
			await expect(positions.getByRole("radio")).toHaveCount(4);
			await positions.getByText("Top left", { exact: true }).click();
			await expect(positions.getByRole("radio", { name: "Top left", exact: true })).toBeChecked();
			await expect(preview.contentFrame().locator("[data-runner-preview-revision]")).toHaveAttribute("data-runner-preview-revision", /"watermarkCorner":"top_left"/);
			await positions.getByRole("radio", { name: "Top left", exact: true }).press("ArrowRight");
			await expect(positions.getByRole("radio", { name: "Top right", exact: true })).toBeChecked();
			await expect(preview.contentFrame().locator("[data-runner-preview-revision]")).toHaveAttribute("data-runner-preview-revision", /"watermarkCorner":"top_right"/);
			await positions.getByText("Bottom right", { exact: true }).click();
			if (plan === "free") await expect(appearance.getByRole("switch", { name: "Show Clipify attribution", exact: true })).toHaveCount(0);
			else {
				await expect(appearance.getByRole("switch", { name: "Show Clipify attribution", exact: true })).toBeVisible();
				await expect(appearance.getByText("PNG, JPEG or WebP, up to 2 MiB").first()).toBeVisible();
				const message = appearance.getByRole("textbox", { name: "Standby message", exact: true });
				const before = await preview.getAttribute("src");
				let navigations = 0;
				page.on("request", (request) => {
					if (request.resourceType() === "document" && new URL(request.url()).pathname === `/runner/preview/${runnerId}`) navigations++;
				});
				await preview.contentFrame().locator("[data-runner-preview-revision]").waitFor();
				navigations = 0;
				await message.pressSequentially("Back soon", { delay: 50 });
				await expect(preview.contentFrame().getByText("Back soon", { exact: true })).toBeVisible();
				expect(await preview.getAttribute("src")).toBe(before);
				expect(navigations).toBe(0);

				const choose = appearance.getByRole("button", { name: "Choose image", exact: true }).first();
				const [chooser] = await Promise.all([page.waitForEvent("filechooser"), choose.click()]);
				await chooser.setFiles("public/web-app-manifest-192x192.png");
				await expect(appearance.getByRole("button", { name: "Remove logo", exact: true })).toBeVisible();
				await expect(preview.contentFrame().locator('img[src*="/assets/"]').first()).toBeVisible();
				await appearance.getByRole("button", { name: "Pick Standby background color", exact: true }).click();
				await expect(page.getByRole("dialog", { name: "Pick Standby background color", exact: true }).getByRole("slider", { name: "Hue", exact: true })).toBeVisible();
				await page.keyboard.press("Escape");
				const color = appearance.getByRole("textbox", { name: "Standby background color", exact: true });
				await color.fill("#16324f");
				await color.press("Tab");
				await expect(preview.contentFrame().locator("[data-runner-standby]")).toHaveCSS("background-color", "rgb(22, 50, 79)");
				await appearance.getByRole("button", { name: "Save appearance", exact: true }).click();
				await expect(appearance.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
			}
			await expect(page.locator('[data-slot="toast"]:not([data-hidden="true"])').filter({ hasText: "Stream session configuration saved." })).toHaveCount(0);
			await page.screenshot({ path: testInfo.outputPath(`${plan}-appearance-desktop.png`), fullPage: true, animations: "disabled" });
			await appearance.getByRole("button", { name: "Close", exact: true }).focus();
			await page.keyboard.press("Enter");
			await expect(appearance).not.toBeVisible();
			await expect(page.getByRole("button", { name: "Appearance", exact: true })).toBeFocused();
			await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			await page.screenshot({ path: testInfo.outputPath(`${plan}-setup-light-desktop.png`), fullPage: true, animations: "disabled" });
			await page.setViewportSize({ width: 390, height: 844 });
			await expect(mainSave).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ path: testInfo.outputPath(`${plan}-setup-mobile.png`), fullPage: true, animations: "disabled" });
			await appearanceAction.click();
			await expect(appearance).toBeVisible();
			await expect(appearance.getByRole("radiogroup", { name: "Attribution position", exact: true })).toBeVisible();
			await page.screenshot({ path: testInfo.outputPath(`${plan}-appearance-mobile-controls.png`), fullPage: true, animations: "disabled" });
			await preview.scrollIntoViewIfNeeded();
			await expect.poll(async () => Math.round((await preview.locator("..").boundingBox())?.width ?? 0)).toBe(390);
			expect(await appearance.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
			await page.screenshot({ path: testInfo.outputPath(`${plan}-appearance-mobile-preview.png`), fullPage: true, animations: "disabled" });
			await appearance.getByRole("button", { name: "Close", exact: true }).click();
			await expect(appearance).not.toBeVisible();
			if (plan === "pro") {
				await expectScheduleActionAlignment(page);
				await page.screenshot({ path: testInfo.outputPath("pro-schedule-action-mobile.png"), fullPage: true, animations: "disabled" });
				await page.getByRole("button", { name: "Schedule", exact: true }).click();
				const mobileSchedule = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
				await expect(mobileSchedule.locator("[data-slot=agenda]")).toHaveAttribute("data-view", "day");
				expect(await mobileSchedule.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
				await page.screenshot({ path: testInfo.outputPath("pro-schedule-mobile.png"), fullPage: true, animations: "disabled" });
				await page.keyboard.press("Escape");
			}
		} finally {
			await pool.end();
			if (owner) {
				const response = await request.delete("/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
				expect(response.status()).toBe(204);
			}
		}
	});

test("Runner setup without an overlay offers a source action and recoverable validation", async ({ page, request, context }) => {
	let owner: AuthFixture | undefined;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const runnerId = randomUUID();
		await pool.query("DELETE FROM overlays WHERE owner_id=$1", [owner.fixture.creatorId]);
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at,protocol_version,capabilities) VALUES($1,$2,'Source setup Runner',$3,'online',now(),2,'[]'::jsonb)", [runnerId, owner.fixture.creatorId, randomUUID()]);
		await prepare(page);
		await page.goto(`/dashboard/runners/${runnerId}`);
		const save = page.getByRole("button", { name: "Save Configuration", exact: true });
		await expect(save).toBeEnabled();
		await expect(page.getByRole("link", { name: "your dashboard", exact: true })).toHaveAttribute("href", "/dashboard");
		await save.click();
		await expect(page.getByRole("alert").filter({ hasText: "Choose an overlay before saving." })).toBeVisible();
		await expect(save).toBeEnabled();
	} finally {
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
