import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";

const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };
test.setTimeout(300000);
test.use({ actionTimeout: 30000 });

test("resource editors share card navigation, gutters and responsive headers", async ({ page, request, context }, testInfo) => {
	let owner: AuthFixture | undefined;
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const runnerId = randomUUID();
		const playlistId = randomUUID();
		const galleryId = randomUUID();
		const runnerName = "A very long community broadcasting computer for weekend streams";
		await pool.query("UPDATE users SET plan='pro' WHERE id=$1", [owner.fixture.creatorId]);
		await pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,$2,'Layout playlist')", [playlistId, owner.fixture.creatorId]);
		await pool.query("INSERT INTO galleries(id,owner_id,name,playlist_id) VALUES($1,$2,'Layout gallery',$3)", [galleryId, owner.fixture.creatorId, playlistId]);
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,protocol_version,capabilities) VALUES($1,$2,$3,$4,'offline',2,'[]'::jsonb)", [runnerId, owner.fixture.creatorId, runnerName, randomUUID()]);
		await page.goto("/legal/cookies");
		await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
		const consent = page.getByRole("complementary", { name: "Your privacy choices", exact: true });
		await consent.getByRole("button", { name: "Reject optional", exact: true }).click();
		await expect(consent).not.toBeVisible();
		await page.reload();
		const editors = [
			{ key: "runner", path: `/dashboard/runners/${runnerId}`, back: "Back to runners", destination: /\/dashboard\?tab=runners$/, heading: runnerName },
			{ key: "overlay", path: `/dashboard/overlay/${owner.fixture.overlayId}`, back: "Back to dashboard", destination: /\/dashboard$/, heading: "Overlay Settings" },
			{ key: "gallery", path: `/dashboard/galleries/${galleryId}`, back: "Back to dashboard", destination: /\/dashboard$/, heading: "Gallery Settings" },
			{ key: "playlist", path: `/dashboard/playlist/${playlistId}`, back: "Back to dashboard", destination: /\/dashboard$/, heading: null },
			{ key: "tools", path: "/dashboard/tools", back: "Back to dashboard", destination: /\/dashboard$/, heading: "Configure Clip Player" },
		];
		for (const viewport of [
			{ width: 1280, height: 1000 },
			{ width: 390, height: 844 },
		]) {
			await page.setViewportSize(viewport);
			let referenceBounds: { x: number; width: number } | undefined;
			for (const editor of editors) {
				await test.step(`${editor.key} editor at ${viewport.width}px`, async () => {
					await page.goto(editor.path);
					const workspace = page.getByRole("region", { name: "Editor workspace", exact: true });
					await expect(workspace).toBeVisible({ timeout: 60000 });
					const back = workspace.getByRole("button", { name: editor.back, exact: true });
					await expect(back).toBeVisible();
					const header = back.locator('xpath=ancestor::*[@data-slot="card-header"][1]');
					await expect(header).toBeVisible();
					if (editor.heading) await expect(header.getByRole("heading", { name: editor.heading, exact: true })).toBeVisible();
					if (editor.key === "playlist") await expect(header.getByRole("textbox", { name: "Playlist name", exact: true })).toHaveValue("Layout playlist");
					const bounds = await workspace.boundingBox();
					expect(bounds).not.toBeNull();
					if (!referenceBounds) referenceBounds = bounds!;
					expect(Math.abs(bounds!.x - referenceBounds.x)).toBeLessThan(2);
					expect(Math.abs(bounds!.width - referenceBounds.width)).toBeLessThan(2);
					for (const theme of ["dark", "light"]) {
						const html = page.locator("html");
						if (!(await html.getAttribute("class"))?.split(/\s+/).includes(theme)) await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
						await expect(html).toHaveClass(new RegExp(`\\b${theme}\\b`));
						const overflow = await page.evaluate(() => ({
							width: document.documentElement.scrollWidth,
							viewport: innerWidth,
							nodes: [...document.querySelectorAll("body *")]
								.map((node) => ({ tag: node.tagName, slot: node.getAttribute("data-slot"), className: node.getAttribute("class"), right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width }))
								.filter((node) => node.right > innerWidth + 1 && node.width > 0)
								.slice(0, 16),
						}));
						expect(overflow.width, JSON.stringify({ editor: editor.key, theme, ...overflow })).toBeLessThanOrEqual(overflow.viewport);
						expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
						await header.screenshot({ path: testInfo.outputPath(`${editor.key}-${theme}-${viewport.width}-header.png`), animations: "disabled" });
						if (editor.key === "runner") await workspace.screenshot({ path: testInfo.outputPath(`runner-${theme}-${viewport.width}-workspace.png`), animations: "disabled" });
					}
					if (editor.key === "overlay" && viewport.width === 1280) {
						const name = workspace.getByRole("textbox", { name: /^Overlay Name\*?$/ });
						const savedName = await name.inputValue();
						await name.fill(`${savedName} edited`);
						await back.press("Enter");
						const warning = page.getByRole("dialog", { name: "Unsaved Changes", exact: true });
						await expect(warning).toBeVisible();
						await warning.getByRole("button", { name: "Cancel", exact: true }).click();
						await expect(warning).not.toBeVisible();
						await expect(page).toHaveURL(new RegExp(`${editor.path}$`));
						await name.fill(savedName);
					}
					await back.focus();
					await back.press("Enter");
					await expect(page).toHaveURL(editor.destination);
				});
			}
		}
	} finally {
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: fixtureHeaders, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
