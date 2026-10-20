import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

test("a missing save action preserves Runner edits across refresh and waits for an explicit save", async ({ page, request, context }, testInfo) => {
	test.setTimeout(120000);
	page.setDefaultTimeout(15000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const runnerId = randomUUID(),
			sessionId = randomUUID(),
			destinationId = randomUUID(),
			ownerId = owner.fixture.creatorId;
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at) VALUES($1,$2,'Recovery Runner',$3,'online',now())", [runnerId, ownerId, randomUUID()]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Recovery output','custom','rtmp://127.0.0.1:1949/live')", [destinationId, ownerId]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode,rtmp_url) VALUES($1,$2,$3,$4,'24/7','manual','rtmp://127.0.0.1:1949/live')", [sessionId, ownerId, runnerId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO stream_session_destinations(owner_id,session_id,destination_id,position) VALUES($1,$2,$3,0)", [ownerId, sessionId, destinationId]);
		await page.goto("/legal/cookies");
		await page.waitForLoadState("networkidle");
		await expect(page.locator("html")).toHaveClass(/c15t-(?:light|dark)/);
		await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
		const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
		await preferences.focus();
		await preferences.press("Enter");
		const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
		await expect(privacy).toBeVisible();
		const persisted = page.waitForResponse((response) => response.url().includes("/api/c15t/subjects") && response.request().method() === "POST" && response.ok());
		await privacy.getByRole("button", { name: "Reject optional", exact: true }).click();
		await persisted;
		await expect(privacy).not.toBeVisible();
		const path = `/dashboard/runners/${runnerId}`;
		await page.goto(path);
		await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
		await page.getByRole("button", { name: /Broadcast behavior$/ }).click();
		await page.getByRole("option", { name: "Live fallback", exact: true }).click();
		let missing = 0;

		await page.route(`**${path}`, (route) => {
			const req = route.request();
			if (req.method() === "POST" && req.headers()["next-action"] && req.postData()?.includes('"destinationIds"') && missing === 0) {
				missing++;
				return route.continue({ headers: { ...req.headers(), "next-action": req.headers()["next-action"].slice(0, 2) + "0".repeat(40) } });
			}
			return route.continue();
		});
		await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
		const update = page.getByRole("dialog", { name: "Clipify has been updated", exact: true });
		await expect(update).toBeVisible();
		await page.keyboard.press("Tab");
		await expect.poll(() => update.evaluate((element) => element.contains(document.activeElement))).toBe(true);
		expect(missing).toBe(1);
		expect((await pool.query("SELECT mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].mode).toBe("24/7");
		await update.screenshot({ path: testInfo.outputPath("update-dark-desktop.png") });
		await update.getByRole("button", { name: "Keep editing", exact: true }).click();
		await expect(page.getByRole("button", { name: /Broadcast behavior$/ })).toContainText("Live fallback");
		await expect(page.getByRole("button", { name: "Update available", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Update available", exact: true }).focus();
		await page.getByRole("button", { name: "Update available", exact: true }).press("Enter");
		await page.setViewportSize({ width: 390, height: 844 });
		await update.screenshot({ path: testInfo.outputPath("update-dark-mobile.png") });
		const loaded = page.waitForEvent("load", { timeout: 20000 });
		await update.getByRole("button", { name: "Refresh Clipify", exact: true }).click();
		await loaded;
		await expect(page.getByRole("button", { name: /Broadcast behavior$/ })).toContainText("Live fallback");
		await expect(page.getByRole("button", { name: "Save Configuration", exact: true })).toBeEnabled();
		expect((await pool.query("SELECT mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].mode).toBe("24/7");
		await page.getByRole("button", { name: "Save Configuration", exact: true }).click();
		await expect(page.getByText("Stream session configuration saved.", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Save Configuration", exact: true })).toBeDisabled();
		expect((await pool.query("SELECT mode FROM stream_sessions WHERE id=$1", [sessionId])).rows[0].mode).toBe("failsafe");
	} finally {
		if (owner) await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
		await pool.end();
	}
});

test("an overlay draft survives deployment recovery without overwriting a concurrent save", async ({ page, request, context }, testInfo) => {
	test.setTimeout(120000);
	page.setDefaultTimeout(15000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		await page.goto("/legal/cookies");
		await page.waitForLoadState("networkidle");
		await expect(page.locator("html")).toHaveClass(/c15t-(?:light|dark)/);
		await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
		const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
		await preferences.focus();
		await preferences.press("Enter");
		const privacy = page.getByRole("dialog", { name: "Privacy preferences", exact: true });
		await expect(privacy).toBeVisible();
		const persisted = page.waitForResponse((response) => response.url().includes("/api/c15t/subjects") && response.request().method() === "POST" && response.ok());
		await privacy.getByRole("button", { name: "Reject optional", exact: true }).click();
		await persisted;
		await expect(privacy).not.toBeVisible();
		const path = `/dashboard/overlay/${owner.fixture.overlayId}`;
		await page.goto(path);
		const name = page.getByRole("textbox", { name: /Overlay Name/ });
		await expect(name).toBeVisible();
		const original = (await pool.query("SELECT configuration_revision FROM overlays WHERE id=$1", [owner.fixture.overlayId])).rows[0].configuration_revision;
		await name.fill("Unsaved recovery overlay");
		let missing = false;
		await page.route(`**${path}`, (route) => {
			const req = route.request();
			if (!missing && req.method() === "POST" && req.headers()["next-action"] && req.postData()?.startsWith(`["${owner!.fixture.overlayId}",`)) {
				missing = true;
				return route.continue({ headers: { ...req.headers(), "next-action": req.headers()["next-action"].slice(0, 2) + "0".repeat(40) } });
			}
			return route.continue();
		});
		await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
		const update = page.getByRole("dialog", { name: "Clipify has been updated", exact: true });
		await expect(update).toBeVisible();
		await expect(name).toHaveValue("Unsaved recovery overlay");
		await pool.query("UPDATE overlays SET name='Concurrent saved overlay', configuration_revision=configuration_revision+1 WHERE id=$1", [owner.fixture.overlayId]);
		await update.getByRole("button", { name: "Keep editing", exact: true }).click();
		await expect(name).toHaveValue("Unsaved recovery overlay");
		await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
		await expect(name).toHaveValue("Unsaved recovery overlay");
		await page.getByRole("button", { name: "Update available", exact: true }).focus();
		await page.getByRole("button", { name: "Update available", exact: true }).press("Enter");
		await update.screenshot({ path: testInfo.outputPath("update-light-desktop.png") });
		await page.setViewportSize({ width: 390, height: 844 });
		await update.screenshot({ path: testInfo.outputPath("update-light-mobile.png") });
		page.on("dialog", (dialog) => dialog.accept());
		const loaded = page.waitForEvent("load", { timeout: 20000 });
		await update.getByRole("button", { name: "Refresh Clipify", exact: true }).click();
		await loaded;
		await expect(name).toHaveValue("Unsaved recovery overlay");
		let submittedRevision: number | undefined;
		await page.route(`**${path}`, async (route) => {
			const req = route.request();
			if (req.method() === "POST" && req.postData()?.startsWith(`["${owner!.fixture.overlayId}",`)) {
				const args = JSON.parse(req.postData()!);
				submittedRevision = args[2];
			}
			await route.fallback();
		});
		await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
		await expect.poll(() => submittedRevision).toBe(original);
		await expect(page.getByText("Could not save overlay", { exact: true })).toBeVisible();
		expect((await pool.query("SELECT name,configuration_revision FROM overlays WHERE id=$1", [owner.fixture.overlayId])).rows[0]).toEqual({ name: "Concurrent saved overlay", configuration_revision: original + 1 });
	} finally {
		try {
			if (owner) await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
		} finally {
			await pool.end();
		}
	}
});
