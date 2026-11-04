import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { randomUUID } from "node:crypto";
test.use({ navigationTimeout: 15000, actionTimeout: 10000 });

for (const width of [390, 1440])
	test(`Tools sidebar preserves player options and browser history at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 900 });
		const seeded = await seedCreatorLibrary({ page, request, tourWorld });
		const gallery = randomUUID();
		await tourWorld.fixture.pool.query("INSERT INTO galleries(id,owner_id,name,playlist_id) VALUES($1,$2,'Sidebar gallery',$3)", [gallery, seeded.creatorId, tourWorld.owner!.playlistId]);
		await page.goto(`${tourWorld.origin}/dashboard/tools?tool=player`, { waitUntil: "domcontentloaded" });
		const consent = page.getByRole("button", { name: "Reject optional", exact: true });
		await consent.click();
		await expect(consent).not.toBeVisible();
		await page.reload({ waitUntil: "domcontentloaded" });
		await expect(page.getByRole("heading", { name: "Configure Clip Player", exact: true })).toBeVisible();
		const muted = page.getByRole("switch", { name: "Muted", exact: true });
		await page.getByText("Muted", { exact: true }).click();
		await expect(muted).toBeChecked();
		await muted.focus();
		await page.keyboard.press("Space");
		await expect(muted).not.toBeChecked();
		await page.keyboard.press("Space");
		await expect(muted).toBeChecked();
		const timeOrigin = await page.evaluate(() => performance.timeOrigin);
		if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
		const sidebar = page.locator(width === 390 ? '[data-slot="sidebar-mobile"]' : '[data-slot="sidebar"]');
		await sidebar.getByRole("row", { name: "Clip Gallery", exact: true }).click();
		await expect(page).toHaveURL(/tool=gallery/);
		await expect(page.getByRole("heading", { name: "Configure Clip Gallery", exact: true })).toBeVisible();
		await expect(page.getByRole("tablist", { name: "Integration tool", exact: true })).toHaveCount(0);
		await page.screenshot({ path: info.outputPath(`gallery-tool-${width}.png`), fullPage: true });
		await page.goBack();
		await expect(page).toHaveURL(/tool=player/);
		await expect(muted).toBeChecked();
		expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
	});

for (const width of [820, 1440])
	test(`Tools workspace keeps useful configuration and preview space at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await seedCreatorLibrary({ page, request, tourWorld });
		await page.goto(`${tourWorld.origin}/dashboard/tools`);
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await page.reload();
		const workspace = page.getByRole("region", { name: "Editor workspace", exact: true });
		const configuration = workspace.getByRole("heading", { name: "Configure Clip Player", exact: true });
		const preview = workspace.getByRole("heading", { name: "Preview", exact: true });
		const cardBounds = (node: Element) => {
			const { x, y, width, height } = node.closest('[data-slot="card"]')!.getBoundingClientRect();
			return { x, y, width, height };
		};
		const [form, canvas] = await Promise.all([configuration.evaluate(cardBounds), preview.evaluate(cardBounds)]);
		if (width === 820) {
			expect(Math.abs(canvas!.x - form!.x)).toBeLessThan(2);
			expect(canvas!.y).toBeGreaterThan(form!.y + form!.height);
		} else {
			expect(canvas!.x).toBeGreaterThan(form!.x + form!.width);
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			await expect(preview).toBeInViewport();
			await expect.poll(() => preview.evaluate((node) => getComputedStyle(node.closest('[data-slot="card"]')!).position)).toBe("sticky");
		}
		const tree = page.getByRole("treegrid", { name: "Creator navigation", exact: true });
		const parentIcon = await tree.getByRole("row", { name: "Create and share", exact: true }).locator("svg").first().boundingBox();
		const guide = await tree.getByRole("row", { name: "Overlays", exact: true }).evaluate((node) => node.getBoundingClientRect().x + parseFloat(getComputedStyle(node, "::before").left));
		expect(Math.abs(guide - (parentIcon!.x + parentIcon!.width / 2))).toBeLessThan(4);
		await page.screenshot({ path: info.outputPath(`tools-workspace-${width}.png`), fullPage: true, animations: "disabled" });
	});
