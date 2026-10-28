import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { createHmac } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { requiredAuthSetting } from "../../src/auth/environment";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
import { browserDatabaseUrl, browserProviderEnvironment } from "../support/mcp/browser-database.cjs";

test("stale sensitive actions offer verification through production server actions", async ({ page, context, request }, info) => {
	test.setTimeout(120000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	try {
		owner = await createAuthenticatedFixture(request, context);
		await pool.query(`UPDATE auth.session SET created_at=now()-interval '10 minutes' WHERE user_id=$1`, [owner.fixture.authUserId]);
		await page.goto("/dashboard/settings");
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.getByRole("button", { name: "Export Account Data", exact: true }).click();
		await page.getByRole("dialog", { name: "Request your Clipify data" }).getByRole("button", { name: "Email download link" }).click();
		const verification = page.getByRole("dialog", { name: "Sign in again to continue" });
		await expect(verification).toBeVisible();
		for (const theme of ["dark", "light"]) {
			await page.evaluate((value) => {
				document.documentElement.classList.remove("dark", "light");
				document.documentElement.classList.add(value);
				document.documentElement.style.colorScheme = value;
			}, theme);
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 960 });
				await expect(verification.getByRole("button", { name: "Continue with Twitch" })).toBeVisible();
				await page.screenshot({ path: info.outputPath(`verification-${theme}-${width}.png`) });
			}
		}
		await verification.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(verification).toBeHidden();
		await page.getByRole("button", { name: "Schedule Account Deletion", exact: true }).click();
		const deletion = page.getByRole("dialog", { name: "Schedule account deletion", exact: true });
		await deletion.getByPlaceholder(owner.fixture.username).fill(owner.fixture.username);
		await deletion.getByRole("button", { name: "Schedule deletion", exact: true }).click();
		await expect(verification).toBeVisible();
		await verification.getByRole("button", { name: "Cancel", exact: true }).click();
		await page.getByRole("button", { name: "Manage passkeys", exact: true }).click();
		await page.getByRole("dialog", { name: "Manage passkeys", exact: true }).getByRole("button", { name: "Add passkey" }).click();
		await expect(verification).toBeVisible();
		await verification.getByRole("button", { name: "Cancel", exact: true }).click();
		const payload = Buffer.from(JSON.stringify({ version: 1, authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationId: owner.fixture.creatorOrganizationId, expiresAt: Date.now() + 60000 })).toString("base64url");
		const secret = requiredAuthSetting("BETTER_AUTH_SECRET", "JWT_SECRET", { ...process.env, ...browserProviderEnvironment(process.env) });
		const token = `${payload}.${createHmac("sha256", secret).update(`clipify-account-export:${payload}`).digest("base64url")}`;
		const staleDownload = await context.request.get(`/api/account/export?token=${encodeURIComponent(token)}`, { maxRedirects: 0 });
		expect(staleDownload.status()).toBe(307);
		expect(staleDownload.headers().location).toContain("/dashboard/settings#downloadExport=");
		await pool.query(`UPDATE auth.session SET created_at=now() WHERE user_id=$1`, [owner.fixture.authUserId]);
		const download = await context.request.get(`/api/account/export?token=${encodeURIComponent(token)}`);
		expect(download.status(), await download.text()).toBe(200);
		expect(download.headers()["content-type"]).toBe("application/zip");
		const files = unzipSync(await download.body());
		const manifest = JSON.parse(strFromU8(files["manifest.json"]));
		expect(manifest).not.toHaveProperty("tables");
		expect(manifest).not.toHaveProperty("externalSources");
		expect(manifest.contents).toContainEqual(expect.objectContaining({ file: "account/account.json", pointer: "/profile", name: "Profile", records: 1 }));
		expect(JSON.parse(strFromU8(files["account/account.json"])).profile.id).toBe(owner.fixture.creatorId);
		const resumedDownload = page.waitForEvent("download");
		await page.goto(`/dashboard/settings?reauthenticated=download#downloadExport=${encodeURIComponent(token)}`);
		const resumedFile = await resumedDownload;
		expect(resumedFile.suggestedFilename()).toBe(`clipify-account-${owner.fixture.creatorId}.zip`);
		expect(await resumedFile.failure()).toBeNull();
		await expect(page.getByRole("button", { name: "Save Settings", exact: true })).toBeVisible();
		expect(pageErrors).toEqual([]);
	} finally {
		if (!page.isClosed()) await page.goto("about:blank");
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});

test("a suspended account can verify its identity before recovery", async ({ page, context, request }) => {
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	try {
		owner = await createAuthenticatedFixture(request, context, { deletionState: "suspended" });
		await pool.query(`UPDATE auth.session SET created_at=now()-interval '10 minutes' WHERE user_id=$1`, [owner.fixture.authUserId]);
		await page.goto("/dashboard/settings/account/recovery");
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.getByRole("button", { name: "Recover my account", exact: true }).click();
		const verification = page.getByRole("dialog", { name: "Sign in again to continue", exact: true });
		await expect(verification).toBeVisible();
		await verification.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(verification).toBeHidden();
		await expect(page.getByRole("button", { name: "Recover my account", exact: true })).toBeEnabled();
		const status = await pool.query(`SELECT status FROM account_deletion_requests WHERE id=$1`, [owner.fixture.deletionRequestId]);
		expect(status.rows[0].status).toBe("suspended");
	} finally {
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
