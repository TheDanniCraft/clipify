import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
test.use({ actionTimeout: 10000, navigationTimeout: 15000 });
for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Account brand imports OBS styling, previews custom fonts and shares it with clips at ${width} ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(150000);
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE users SET plan='pro' WHERE id=$1", [creatorId]);
			await tourWorld.fixture.pool.query("UPDATE overlays SET name='My OBS brand',theme_font_family=$2,theme_text_color='#ffeedd',theme_background_color='rgba(30,30,30,1)' WHERE id=$1", [tourWorld.owner!.overlayId, "Laila, sans-serif||url||https://fonts.googleapis.com/css2?family=Laila:wght@400;700&display=swap"]);
			await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("button", { name: "Apply brand", exact: true })).toBeEnabled();
			console.log("Brand settings loaded");
			await page.getByRole("button", { name: /Start from an existing overlay/ }).click();
			await page.getByRole("option", { name: "My OBS brand", exact: true }).click();
			await expect(page.getByRole("textbox", { name: "Google font family", exact: true })).toHaveValue("Laila");
			console.log("Overlay imported");
			const preview = page.getByRole("img", { name: "Clip information styled with your brand" });
			await preview.scrollIntoViewIfNeeded();
			await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 720), { timeout: 15000 }).toBe(true);
			console.log("Native font preview loaded");
			await page.getByText("Clipify watermark", { exact: true }).click();
			await expect(page.getByRole("switch", { name: "Clipify watermark", exact: true })).not.toBeChecked();
			await page.getByRole("button", { name: "Apply brand", exact: true }).click();
			await page.getByRole("button", { name: "Apply to overlays and clips", exact: true }).click();
			await expect(page.getByRole("button", { name: "Save brand", exact: true })).toBeDisabled();
			const { rows } = await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='creator-brand:v1'", [creatorId]);
			expect(JSON.parse(rows[0].state)).toMatchObject({ revision: 1, brand: { fontFamily: "Laila", fontSource: "google", watermark: false, themeTextColor: "#ffeedd" } });
			await expect(page.getByRole("textbox", { name: "Google font family", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("brand-settings.png"), fullPage: true });
			const mobile = createClipComposition("mobile");
			mobile.layers.push({ id: "title", kind: "title", label: "Clip info", fontSize: 32, frame: { x: 0, y: 0.85, w: 1, h: 0.12 } });
			await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, "clip-layout-template:v2:branded", JSON.stringify({ name: "Branded", composition: mobile })]);
			await tourWorld.fixture.pool.query("UPDATE playlist_clips SET clip_data=jsonb_set(clip_data::jsonb,'{testPreviewOfficial}','true')::text WHERE clip_id=$1", [id]);
			const imageResponse = page.waitForResponse((response) => response.url().includes("/api/clips/widget-preview?data=") && decodeURIComponent(response.url()).includes("Laila") && response.status() === 200);
			await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=branded&reference=${id}`);
			await expect(page.getByRole("link", { name: "Brand styling", exact: true })).toBeVisible();
			await imageResponse;
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
			await page.screenshot({ path: info.outputPath("branded-composition.png"), fullPage: true });
			await page.goto(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}/theme`);
			await expect(page.getByRole("link", { name: "Brand styling", exact: true })).toBeVisible();
			await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toHaveCount(0);
		});

test("Free brand settings keep the watermark and open the existing upgrade without saving", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(120000);
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE users SET plan='free',created_at='2020-01-01' WHERE id=$1", [creatorId]);
	await tourWorld.fixture.pool.query("DELETE FROM entitlement_grants WHERE user_id=$1", [creatorId]);
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	const watermark = page.getByRole("switch", { name: "Clipify watermark", exact: true });
	await expect(watermark).toBeChecked();
	await watermark.focus();
	await watermark.press("Space");
	const upgrade = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Make every clip your own with Pro", exact: true }) });
	await expect(upgrade).toBeVisible();
	await expect(upgrade.getByRole("button", { name: "Prices unavailable", exact: true })).toBeDisabled();
	await expect
		.poll(async () => {
			const box = await upgrade.boundingBox();
			return Boolean(box && box.y >= 0 && box.y + box.height <= 900);
		})
		.toBe(true);

	await page.screenshot({ path: info.outputPath("branding-upgrade-mobile.png"), fullPage: false, animations: "disabled" });
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='creator-brand:v1'", [creatorId])).rows).toHaveLength(0);
	await page.keyboard.press("Escape");
	await expect(watermark).toBeChecked();
});

test("Concurrent brand saves keep the newer style and preserve the other tab's draft", async ({ page, request, tourWorld }) => {
	test.setTimeout(120000);
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE users SET plan='pro' WHERE id=$1", [creatorId]);
	const { creatorBrandSchema } = await import("../../src/app/lib/overlayMetadata");
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'creator-brand:v1',$2)", [creatorId, JSON.stringify({ brand: creatorBrandSchema.parse({}), revision: 1 })]);
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	const other = await page.context().newPage();
	await other.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	for (const [tab, color] of [
		[page, "#112233"],
		[other, "#445566"],
	] as const) {
		const field = tab.getByRole("textbox", { name: "Text Color", exact: true });
		await field.fill(color);
		await field.press("Tab");
	}
	await page.getByRole("button", { name: "Save brand", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save brand", exact: true })).toBeDisabled();
	await other.getByRole("button", { name: "Save brand", exact: true }).click();
	await expect(other.getByText("Brand changed in another tab", { exact: true })).toBeVisible();
	await expect(other.getByRole("textbox", { name: "Text Color", exact: true })).toHaveValue(/445566/i);
	const { rows } = await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='creator-brand:v1'", [creatorId]);
	expect(JSON.parse(rows[0].state).revision).toBe(2);
	expect(JSON.parse(rows[0].state).brand.themeTextColor.toLowerCase()).toBe("#112233");
	await other.close();
});

test("A read-only collaborator can inspect brand styling without editable controls", async ({ page, request, tourWorld }) => {
	test.setTimeout(120000);
	const { creatorId, authUserId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE users SET plan='pro' WHERE id=$1", [creatorId]);
	await tourWorld.fixture.pool.query("UPDATE auth.member SET role='content-manager' WHERE organization_id=$1 AND user_id=$2", [tourWorld.owner!.creatorOrganizationId, authUserId]);
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByText("You can view this brand. An account owner can change it.", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Apply brand", exact: true })).toBeDisabled();
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toBeDisabled();
	expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='creator-brand:v1'", [creatorId])).rows).toHaveLength(0);
});

test("Built-in brand fonts render through native queued previews for multiple widgets", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(120000);
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	const { creatorBrandSchema } = await import("../../src/app/lib/overlayMetadata");
	await tourWorld.fixture.pool.query("UPDATE users SET plan='pro' WHERE id=$1", [creatorId]);
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'creator-brand:v1',$2)", [creatorId, JSON.stringify({ brand: creatorBrandSchema.parse({ fontFamily: "DejaVu Serif", watermark: false }), revision: 1 })]);
	const layout = createClipComposition("mobile");
	for (let i = 0; i < 3; i++) layout.layers.push({ id: `info-${i}`, kind: "title", label: `Info ${i + 1}`, fontSize: 32 + i * 4, frame: { x: 0, y: 0.05 + i * 0.2, w: 0.8, h: 0.12 } });
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'clip-layout-template:v2:serif',$2)", [creatorId, JSON.stringify({ name: "Serif layout", composition: layout })]);
	await tourWorld.fixture.pool.query("UPDATE playlist_clips SET clip_data=jsonb_set(clip_data::jsonb,'{testPreviewOfficial}','true')::text WHERE clip_id=$1", [id]);
	const statuses: number[] = [];
	page.on("response", (response) => {
		if (response.url().includes("/api/clips/widget-preview?data=")) statuses.push(response.status());
	});
	await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=serif&reference=${id}`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
	await expect.poll(() => statuses.length).toBeGreaterThanOrEqual(3);
	expect(statuses.every((status) => status === 200)).toBe(true);
	await expect
		.poll(() =>
			page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
				const data = canvas.getContext("2d")!.getImageData(0, 64, 576, 154).data;
				for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) return true;
				return false;
			}),
		)
		.toBe(true);
	await page.screenshot({ path: info.outputPath("builtin-branded-composition.png"), fullPage: true });
});

test("Stalled brand loading offers retry and then loads the creator settings", async ({ page, request, tourWorld }) => {
	test.setTimeout(60000);
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	const blocked: import("@playwright/test").Route[] = [];
	let stall = true;
	await page.route("**/dashboard/settings?tab=brand", (route) => {
		const req = route.request();
		if (stall && req.headers()["next-action"] && req.postData()?.includes(creatorId)) {
			blocked.push(route);
			return;
		}
		return route.continue();
	});
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByRole("button", { name: "Retry brand styling", exact: true })).toBeVisible({ timeout: 22000 });
	stall = false;
	await Promise.all(blocked.map((route) => route.abort()));
	await page.getByRole("button", { name: "Retry brand styling", exact: true }).click();
	await expect(page.getByRole("button", { name: "Apply brand", exact: true })).toBeEnabled({ timeout: 10000 });
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toBeVisible();
});

test("Untrusted overlay font hosts use the built-in fallback when imported and saved", async ({ page, request, tourWorld }) => {
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE overlays SET name='Imported style',theme_font_family=$2,theme_text_color='#ffeecc' WHERE id=$1", [tourWorld.owner!.overlayId, "Laila, sans-serif||url||https://fonts.googleapis.com.evil.example/css2?family=Laila"]);
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=brand`);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByRole("button", { name: "Apply brand", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: /Start from an existing overlay/ }).click();
	await page.getByRole("option", { name: "Imported style", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "Google font family", exact: true })).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toHaveValue("#FFEECC");
	await page.getByRole("button", { name: "Apply brand", exact: true }).click();
	await page.getByRole("button", { name: "Apply to overlays and clips", exact: true }).click();
	await expect(page.getByRole("button", { name: "Save brand", exact: true })).toBeDisabled();
	const { rows } = await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key='creator-brand:v1'", [creatorId]);
	expect(JSON.parse(rows[0].state).brand).toMatchObject({ fontSource: "builtin", fontFamily: "DejaVu Sans" });
});
