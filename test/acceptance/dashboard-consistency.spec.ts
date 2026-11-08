import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
import { defaultProgress, guideContentKey } from "../../src/app/lib/userTour";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";

test.use({ actionTimeout: 30000 });

const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
async function checkAccessibility(page: Page) {
	await page.addScriptTag({ content: axeSource });
	const violations = await page.evaluate(async () => {
		const engine = (window as typeof window & { axe: typeof import("axe-core") }).axe;
		return (await engine.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
	});
	expect(violations).toEqual([]);
}

for (const width of [390, 1440])
	for (const theme of ["light", "dark"]) {
		test(`dashboard route and surface audit at ${width}px in ${theme}`, async ({ page, request, context }, info) => {
			test.setTimeout(600000);
			// Each isolated actor keeps its own rate-limit identity while exercising real auth endpoints.
			await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}` });
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
			let owner: AuthFixture | undefined;
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
			try {
				owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
				await pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [owner.fixture.creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: true })]);
				const playlist = randomUUID(),
					gallery = randomUUID(),
					runner = randomUUID();
				await pool.query("INSERT INTO playlists(id,owner_id,name) VALUES($1,$2,'Audit playlist')", [playlist, owner.fixture.creatorId]);
				await pool.query("INSERT INTO galleries(id,owner_id,name,playlist_id) VALUES($1,$2,'Audit gallery',$3)", [gallery, owner.fixture.creatorId, playlist]);
				await pool.query("INSERT INTO runners(id,owner_id,name,token,status,protocol_version,capabilities) VALUES($1,$2,'Audit runner',$3,'offline',2,'[]'::jsonb)", [runner, owner.fixture.creatorId, randomUUID()]);
				await page.goto("/dashboard");
				const reject = page.getByRole("button", { name: "Reject optional", exact: true });
				await Promise.all([page.waitForEvent("load"), reject.click()]);
				const routes = [
					"/dashboard",
					"/dashboard/streams",
					"/dashboard/clips",
					"/dashboard/overlays",
					"/dashboard/playlists",
					"/dashboard/galleries",
					"/dashboard/runners",
					"/dashboard/tools",
					"/dashboard/member-card",
					"/dashboard/settings",
					"/dashboard/settings?tab=creator",
					"/dashboard/settings?tab=connections",
					"/dashboard/settings?tab=billing",
					"/dashboard/settings?tab=team",
					`/dashboard/settings/team?organization=${owner.fixture.creatorOrganizationId}`,
					"/dashboard/settings/agencies",
					`/dashboard/overlay/${owner.fixture.overlayId}`,
					`/dashboard/overlay/${owner.fixture.overlayId}/theme`,
					`/dashboard/playlist/${playlist}`,
					`/dashboard/galleries/${gallery}`,
					`/dashboard/runners/${runner}`,
				];
				for (const [index, route] of routes.entries())
					await test.step(route, async () => {
						await page.goto(route);
						await expect(page.locator("h1").first()).toBeVisible({ timeout: 30000 });
						await expect(page.locator("main")).toHaveCount(1);
						await expect(page.getByRole("button", { name: "Toggle navigation", exact: true })).toBeEnabled();
						expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
						const resourceNames: Record<string, string> = { "/dashboard/overlays": "E2E continuity overlay", "/dashboard/playlists": "Audit playlist", "/dashboard/galleries": "Audit gallery", "/dashboard/runners": "Audit runner" };
						if (resourceNames[route]) {
							await expect(page.getByRole("row").filter({ hasText: resourceNames[route] })).toBeVisible();
							const edit = page.getByRole("button", { name: `Edit ${resourceNames[route]}`, exact: true });
							await expect(edit).toBeInViewport();
							if (["/dashboard/galleries", "/dashboard/runners"].includes(route)) {
								await edit.focus();
								await edit.press("Enter");
								await expect(page.getByRole("region", { name: "Editor workspace", exact: true })).toBeVisible();
								await page.getByRole("button", { name: route.endsWith("galleries") ? "Back to galleries" : "Back to runners", exact: true }).click();
								await expect(page.getByRole("row").filter({ hasText: resourceNames[route] })).toBeVisible();
							}
						}
						if (route === "/dashboard/settings") {
							const identity = page.getByRole("button", { name: "About your user ID", exact: true }).locator("..");
							const bounds = await identity.boundingBox();
							expect(bounds).not.toBeNull();
							expect(bounds!.x).toBeGreaterThanOrEqual(0);
							expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
							if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
							await page.locator(width === 390 ? '[data-slot="sidebar-mobile"] [data-tour="settings-core-tab"]' : '[data-slot="sidebar"] [data-tour="settings-core-tab"]').press("Enter");
							await expect(page).toHaveURL(/\/dashboard\/settings$/);
							await expect(page.locator('[data-tour="settings-core-tab"][aria-current="page"]')).toHaveCount(1);
						}

						const menuBounds = await page.getByRole("button", { name: "Toggle navigation", exact: true }).boundingBox();
						const themeBounds = await page.getByRole("button", { name: "Toggle Theme", exact: true }).boundingBox();
						expect(menuBounds!.x).toBeLessThan(themeBounds!.x);
						await checkAccessibility(page);
						await page.screenshot({ path: info.outputPath(`${index}-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
					});
				if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
				await expect(page.getByRole("link", { name: "Help center", exact: true })).toBeVisible();
				await expect(page.getByRole("button", { name: "Open profile menu", exact: true })).toHaveCount(0);
				const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
				if (width === 390 && (await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
				const navigation = page.locator(width === 390 ? '[data-slot="sidebar-mobile"]' : '[data-slot="sidebar"]');
				await navigation.locator('[data-tour="settings-group"]').click();
				await navigation.locator('[data-tour="settings-core-tab"]').click();
				await expect(page).toHaveURL(/\/dashboard\/settings$/);
				await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
				if (width === 390) await expect(page.getByRole("button", { name: "Toggle navigation", exact: true })).toHaveAttribute("aria-expanded", "false");
				const contrast = await page.evaluate(() => {
					const luminance = (color: string) => {
						const canvas = document.createElement("canvas");
						canvas.width = canvas.height = 1;
						const ctx = canvas.getContext("2d")!;
						ctx.fillStyle = color;
						ctx.fillRect(0, 0, 1, 1);
						const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => {
							const c = v / 255;
							return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
						});
						return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
					};
					return ["secondary", "tertiary"].map((level) => {
						const node = document.createElement("div");
						node.style.backgroundColor = `var(--surface-${level})`;
						node.style.color = `var(--surface-${level}-foreground)`;
						document.body.append(node);
						const style = getComputedStyle(node),
							fg = luminance(style.color),
							bg = luminance(style.backgroundColor);
						node.remove();
						return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
					});
				});
				for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
				expect(errors).toEqual([]);
			} finally {
				await page.close();
				await pool.end();
				if (owner) {
					const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
					expect(response.status()).toBe(204);
				}
			}
		});
	}

for (const width of [390, 1440])
	for (const theme of ["light", "dark"]) {
		test(`agency navigation and layout at ${width}px in ${theme}`, async ({ page, request, context }, info) => {
			test.setTimeout(180000);
			// Each isolated actor keeps its own rate-limit identity while exercising real auth endpoints.
			await context.setExtraHTTPHeaders({ "x-forwarded-for": `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}` });
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			const owner = await createAuthenticatedFixture(request, context, { activeContext: "agency", withProviderCredentials: true, agencyLinkStatus: "accepted", billingState: "active" });
			try {
				await page.goto("/dashboard/agency");
				await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
				for (const [index, route] of ["/dashboard/agency", "/dashboard/agency/allocations"].entries()) {
					await page.goto(route);
					await expect(page.locator("h1").first()).toBeVisible();
					await expect(page.locator("main")).toHaveCount(1);
					expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
					if (route === "/dashboard/agency") {
						const permission = page.getByRole("group", { name: "Overlay", exact: true }).getByRole("checkbox", { name: "Read", exact: true });
						await expect(permission).not.toBeChecked();
						await permission.press("Space");
						await expect(permission).toBeChecked();
						await permission.press("Space");
						await expect(permission).not.toBeChecked();
					}
					await checkAccessibility(page);
					await page.screenshot({ path: info.outputPath(`${index}-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
				}
				if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				await page.locator('[data-slot="autocomplete-trigger"]').click();
				await page.getByRole("option", { name: "E2E Creator Account creator account", exact: true }).click();
				await expect(page).toHaveURL(/\/dashboard$/);
				await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
				if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				await expect(page.locator('[data-dashboard-account-controls] [data-slot="autocomplete-value"]')).toHaveText("E2E Creator Account");
				expect(errors).toEqual([]);
			} finally {
				await page.close();
				const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
				expect(response.status()).toBe(204);
			}
		});
	}
