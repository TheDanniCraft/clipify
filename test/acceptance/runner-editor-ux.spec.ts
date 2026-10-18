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
			await editor.getByRole("button", { name: /Provider$/ }).click();
			await page.getByRole("option", { name: "Custom RTMP", exact: true }).click();
			await editor.getByRole("textbox", { name: "RTMP URL", exact: true }).fill("rtmp://127.0.0.1:19350/live");
			await editor.getByRole("button", { name: "Save destination", exact: true }).click();
			await expect(editor).not.toBeVisible();
			await page.keyboard.press("Escape");
			await expect(manager).not.toBeVisible();
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
			const control = page.getByRole("button", { name: / Control$/ });
			await control.click();
			const scheduled = page.getByRole("option", { name: /Scheduled/ });
			await expect(scheduled).not.toContainText("Pro · Clip playback");
			if (plan === "free") {
				await expect(scheduled.getByRole("img", { name: "Requires Pro" })).toBeVisible();
				await scheduled.click();
				const upgrade = page.getByRole("dialog", { name: "Upgrade to Pro", exact: true });
				await expect(upgrade).toBeVisible();
				await page.keyboard.press("Escape");
				await expect(upgrade).not.toBeVisible();
				await expect(control).toContainText("Manual");
			} else {
				await scheduled.click();
				await mainSave.click();
				const schedule = page.getByRole("dialog", { name: "Broadcast schedule", exact: true });
				await expect(schedule).toBeVisible();
				await expect(schedule.getByRole("button", { name: "Today", exact: true })).toBeVisible();
				await expect(schedule.getByRole("combobox", { name: "Calendar timezone", exact: true })).toHaveValue("Europe/Berlin");
				await schedule.getByRole("button", { name: "Add schedule", exact: true }).click();
				const event = page.getByRole("dialog", { name: "Schedule broadcast", exact: true });
				await expect(event).toBeVisible();
				await event.getByRole("textbox", { name: "Event title", exact: true }).fill("Vacation broadcast");
				const endDay = event.getByRole("spinbutton", { name: /day, End date/i });
				await endDay.focus();
				await endDay.press("ArrowUp");
				await event.getByRole("button", { name: "Save schedule", exact: true }).click();
				await expect(event).not.toBeVisible();
				await expect(schedule.getByText("Vacation broadcast", { exact: true }).first()).toBeVisible();
				const stored = (await pool.query("SELECT local_start_date,local_end_date FROM runner_schedule_events WHERE owner_id=$1", [owner.fixture.creatorId])).rows;
				expect(stored).toHaveLength(1);
				expect(String(stored[0].local_end_date) > String(stored[0].local_start_date)).toBe(true);
				await page.keyboard.press("Escape");
				await expect(schedule).not.toBeVisible();
			}
			await page.getByRole("button", { name: "Appearance", exact: true }).click();
			const appearance = page.getByRole("dialog", { name: "Appearance", exact: true });
			await expect(appearance).toBeVisible();
			await expect(appearance.locator("input[type=color]")).toHaveCount(0);
			const preview = appearance.locator('iframe[title="Runner appearance preview"]');
			await expect(preview).toBeVisible();
			await expect(preview.contentFrame().locator("[data-runner-layout-status]")).toHaveAttribute("data-runner-layout-status", /placed|clean/);
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
			if (plan === "pro") {
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
