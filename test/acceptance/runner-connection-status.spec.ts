import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

test("Runner connection updates Start without reloading or discarding unsaved configuration", async ({ page, request, context }, info) => {
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
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,last_heartbeat_at) VALUES($1,$2,'Recovery Runner',$3,'offline',now())", [runnerId, ownerId, randomUUID()]);
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

		const start = page.getByRole("button", { name: "Start", exact: true });
		await expect(start).toBeDisabled();
		await expect(page.getByText("Offline", { exact: true })).toBeVisible();
		let navigations = 0;
		page.on("framenavigated", (frame) => {
			if (frame === page.mainFrame()) navigations++;
		});
		await pool.query("UPDATE runners SET status='online', last_heartbeat_at=now() WHERE id=$1", [runnerId]);
		await expect(page.getByText("Online", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(start).toBeEnabled();
		await page.getByRole("button", { name: /Broadcast behavior$/ }).click();
		await page.getByRole("option", { name: "Live fallback", exact: true }).click();
		await pool.query("UPDATE runners SET status='offline' WHERE id=$1", [runnerId]);
		await expect(page.getByText("Offline", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(start).toBeDisabled();
		await pool.query("UPDATE runners SET status='online', last_heartbeat_at=now() WHERE id=$1", [runnerId]);
		await expect(page.getByText("Online", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("button", { name: /Broadcast behavior$/ })).toContainText("Live fallback");
		await expect(page.getByRole("button", { name: "Save Configuration", exact: true })).toBeEnabled();
		await expect(start).toBeDisabled();
		await pool.query("UPDATE stream_sessions SET desired_state='stopped', actual_state='running' WHERE id=$1", [sessionId]);
		await pool.query("UPDATE runners SET status='offline' WHERE id=$1", [runnerId]);
		await expect(page.getByText("Offline", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("status").filter({ hasText: "Runner offline. Waiting for stop confirmation." })).toBeVisible();
		await expect(page.getByText("Finishing current clip…", { exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Stop now", exact: true })).toHaveCount(0);
		for (const theme of ["dark", "light"]) {
			await page.evaluate((theme) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(theme);
				document.documentElement.style.colorScheme = theme;
			}, theme);
			await page.setViewportSize({ width: theme === "dark" ? 1280 : 390, height: 960 });
			await page.screenshot({ path: info.outputPath(`offline-stop-${theme}.png`), fullPage: true });
		}

		await pool.query("UPDATE runners SET status='online', last_heartbeat_at=now() WHERE id=$1", [runnerId]);
		await expect(page.getByText("Online", { exact: true })).toBeVisible({ timeout: 15000 });
		await expect(page.getByRole("status").filter({ hasText: "Finishing current clip…" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Stop now", exact: true })).toBeEnabled();
		await pool.query("UPDATE stream_sessions SET actual_state='stopped' WHERE id=$1", [sessionId]);
		await expect(page.getByText("Finishing current clip…", { exact: true })).toHaveCount(0);
		expect(navigations).toBe(0);
	} finally {
		if (owner) await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
		await pool.end();
	}
});
