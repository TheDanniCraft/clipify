import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { defaultProgress, guideContentKey } from "../../src/app/lib/userTour";
import { openMobileNavigation } from "../support/mobile-navigation";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Existing welcome and optional Pro guide recover at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(120000);
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE users SET plan='free' WHERE id=$1", [creatorId]);
			await tourWorld.fixture.pool.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [creatorId]);
			await tourWorld.fixture.pool.query("INSERT INTO entitlement_grants(id,user_id,entitlement,source,starts_at,ends_at) VALUES(gen_random_uuid(),$1,'pro_access','reverse_trial',now(),now()+interval '7 days')", [creatorId]);
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=$3 WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey, JSON.stringify(defaultProgress())]);
			await page.goto(`${tourWorld.origin}/dashboard`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			const welcome = page.getByRole("dialog", { name: "Happy to have you on board!", exact: true });
			await expect(welcome).toBeVisible();
			let rejectDismissal = true;
			await page.route("**/dashboard", async (route) => {
				if (rejectDismissal && route.request().method() === "POST" && route.request().postData()?.includes("new-account-pro-trial")) {
					rejectDismissal = false;
					return route.abort("failed");
				}
				return route.continue();
			});
			await welcome.getByRole("button", { name: "Start guided tour", exact: true }).click();
			await expect(welcome.getByRole("alert")).toHaveText("Could not save your choice. Please try again.");
			await expect(page.locator(".driver-popover")).toHaveCount(0);
			await welcome.screenshot({ path: info.outputPath("welcome-retry.png"), animations: "disabled" });
			await welcome.getByRole("button", { name: "Start guided tour", exact: true }).click();
			await expect(welcome).not.toBeVisible();
			await expect(page.locator(".driver-popover-title")).toHaveText("Open Overlays");
			await page.getByRole("button", { name: "Pause guide", exact: true }).click();
			await expect(page.locator("[data-guide-sync]")).toHaveAttribute("data-guide-sync", "idle");
			await expect.poll(async () => JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey])).rows[0].state).welcomeSeen).toBe(true);
			await tourWorld.fixture.pool.query("DELETE FROM entitlement_grants WHERE user_id=$1", [creatorId]);
			await page.reload();
			await expect(welcome).not.toBeVisible();
			await page.route("**/dashboard", async (route) => {
				if (route.request().method() !== "POST") return route.continue();
				const response = await route.fetch();
				const original = await response.text();
				const body = original.replace('"monthly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"monthly":{"amount":2,"currency":"EUR","formatted":"€2.00"}').replace('"yearly":{"amount":null,"currency":"EUR","formatted":"Unavailable"}', '"yearly":{"amount":20,"currency":"EUR","formatted":"€20.00"}');
				await route.fulfill({ response, body });
			});
			const panel = page.getByRole("region", { name: "Your Clipify guide", exact: true });
			const launcher = page.locator('[data-dashboard-utilities-ready="true"] [data-tour="guide-launcher"]').first();
			// The panel mounts after hydration. Inspect the hydrated sidebar's state
			// before toggling, otherwise a late-mounting open panel gets closed.
			await expect(launcher).toHaveAttribute("aria-expanded", /^(true|false)$/);
			if ((await launcher.getAttribute("aria-expanded")) === "false") {
				if (width === 390) await openMobileNavigation(page);
				await page.locator('[data-tour="guide-launcher"]:visible').click();
			}
			await expect(panel).toBeVisible();
			await panel.getByRole("button", { name: /^Make your overlay yours/ }).click();
			await panel.getByRole("button", { name: "Choose colors and style", exact: true }).click();
			const pro = panel.getByRole("button", { name: "Explore Theme Studio with Pro", exact: true });
			await expect(pro).toBeVisible();
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await expect(page.locator(".driver-popover")).toHaveCount(0);
			await panel.screenshot({ path: info.outputPath("guide-pro-context.png"), animations: "disabled" });
			await pro.focus();
			await page.keyboard.press("Enter");
			const upgrade = page.getByRole("dialog", { name: "Design your overlay with Pro", exact: true });
			await expect(upgrade).toBeVisible();
			await expect(upgrade.getByRole("button", { name: /Upgrade to Pro for/ })).toBeEnabled();
			await upgrade.screenshot({ path: info.outputPath("theme-upgrade.png"), animations: "disabled" });
			await page.keyboard.press("Escape");
			await expect(upgrade).not.toBeVisible();
			await expect(pro).toBeFocused();
			await expect(page).toHaveURL(`${tourWorld.origin}/dashboard`);
			const saved = JSON.parse((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey])).rows[0].state);
			expect(saved.completed).not.toContain("appearance.style");
			expect((await tourWorld.fixture.pool.query("SELECT count(*)::int AS count FROM overlays WHERE owner_id=$1", [creatorId])).rows[0].count).toBe(1);
		});
