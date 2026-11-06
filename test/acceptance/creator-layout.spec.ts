import { guideContentKey } from "../../src/app/lib/userTour";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { execFileSync } from "node:child_process";
test.use({ actionTimeout: 15000 });
for (const theme of ["light", "dark"])
	for (const width of [390, 820, 1440])
		test(`C creator dashboard and portrait export at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(150000);
			await page.setViewportSize({ width, height: 950 });

			await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
			const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE playlist_clips SET clip_data=jsonb_set(clip_data::jsonb,'{testPreviewOfficial}','true')::text WHERE clip_id=$1", [id]);
			const auditMedia = info.outputPath("framing-source.mp4");
			execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=15", "-vf", "drawbox=x=720:y=0:w=240:h=162:color=0x333333:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text=CAMERA:x=760:y=60:fontcolor=white:fontsize=28", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", auditMedia]);
			await page.route(`**/api/clips/preview?creatorId=${creatorId}&clipId=${id}&*`, (route) => route.fulfill({ path: auditMedia, contentType: "video/mp4", headers: { "Access-Control-Allow-Origin": "*" } }));
			const pool = tourWorld.fixture.pool;
			await pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id=$2 AND account_id=$3", ["channel:manage:clips", "twitch", creatorId]);
			await pool.query(`UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2`, [creatorId, guideContentKey]);
			const broadcast = { id: "12345", user_id: creatorId, type: "archive", title: "Evening community stream", duration: "2h10m", created_at: new Date().toISOString(), thumbnail_url: "https://static-cdn.jtvnw.net/clip-library-fixture.png" };
			const cached = JSON.stringify({ data: [broadcast], fetchedAt: new Date().toISOString() });
			for (const suffix of ["first", "video-12345"]) await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["user", `broadcasts:${creatorId}:${suffix}`, cached]);
			const original = (await pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0];
			const stored = JSON.parse(original.value);
			for (let i = 0; i < 30; i++) await pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:Dense${i}`, JSON.stringify({ clip: { ...stored.clip, id: `Dense${i}`, title: `Library clip ${i}`, created_at: new Date(Date.now() - i * 1000).toISOString() } })]);
			await page.goto(`${tourWorld.origin}/dashboard`);
			await page.getByRole("button", { name: "Reject optional", exact: true }).click();
			await page.reload();
			await expect(page.getByRole("navigation", { name: "Quick access" })).toBeVisible();
			await expect(page.getByRole("heading", { name: "Latest stream", exact: true })).toBeVisible();
			await expect(page.getByRole("link", { name: "Evening community stream", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("home.png"), fullPage: true, animations: "disabled" });
			await page.goto(`${tourWorld.origin}/dashboard/streams`);
			await expect(page.getByRole("grid", { name: "Saved streams" })).toBeVisible();
			await page.screenshot({ path: info.outputPath("streams.png"), fullPage: true, animations: "disabled" });
			await page.getByRole("link", { name: "Evening community stream", exact: true }).click();
			await expect(page.getByRole("region", { name: "Stream moments" })).toBeVisible();
			await expect(page.getByRole("region", { name: "Stream moments" }).getByText("0:10 into stream", { exact: true }).first()).toBeVisible();
			await page.screenshot({ path: info.outputPath("stream-detail.png"), fullPage: true, animations: "disabled" });
			await page.goto(`${tourWorld.origin}/dashboard/clips`);
			await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("31 clips");
			await expect(page.getByRole("button", { name: "Apply filters", exact: true })).toBeEnabled();
			const table = page.getByRole("grid", { name: "Clip inventory" });
			await expect(table.locator("[data-clip-id]")).toHaveCount(25);
			await expect(page.getByRole("link", { name: "Clip layouts", exact: true })).toBeEnabled();
			await expect(page.getByRole("link", { name: "Clip layouts", exact: true })).toHaveClass(/button--secondary/);
			await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
			const response = page.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]));
			await page.getByRole("button", { name: "Next", exact: true }).click();
			const reply = await response;
			console.log("Pagination action status", reply.status());
			await expect(table.locator("[data-clip-id]")).toHaveCount(6, { timeout: 15000 });
			await page.evaluate(() => window.scrollTo(0, 0));
			await page.screenshot({ path: info.outputPath("inventory.png"), fullPage: true, animations: "disabled" });
			await page.goto(`${tourWorld.origin}/dashboard/clips/${id}`);
			await expect(page.getByRole("link", { name: "Open on Twitch", exact: true }).locator("svg")).toBeVisible();
			await expect(page.getByRole("button", { name: "Back to clip inventory", exact: true })).toBeEnabled();
			await page.getByRole("link", { name: "Customize layouts", exact: true }).click();
			await expect(page).toHaveURL(/dashboard\/clip-layouts\?/);
			await page.getByRole("button", { name: "Create layout", exact: true }).click();
			await page.getByRole("textbox", { name: /^Layout name/ }).fill("Main mobile");
			await page.getByRole("dialog").getByRole("button", { name: "Create layout", exact: true }).click();
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
			await page.getByRole("button", { name: "Play preview", exact: true }).click();
			await page.getByRole("button", { name: "Pause preview", exact: true }).click();
			const crop = page.getByRole("button", { name: "Gameplay crop", exact: true });
			await crop.focus();
			await page.keyboard.press("ArrowRight");
			await page.getByRole("button", { name: "Save layout", exact: true }).click();
			await expect(page.getByText("Layout saved", { exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Save layout", exact: true })).toBeDisabled();
			const saved = await pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND starts_with(content_key,'clip-layout-template:v2:')", [creatorId]);
			expect(saved.rows).toHaveLength(1);
			expect(JSON.parse(saved.rows[0].state).composition.version).toBe(2);
			await page.screenshot({ path: info.outputPath("composition-editor.png"), fullPage: true, animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await crop.focus();
			await page.keyboard.press("ArrowLeft");
			await page.getByRole("button", { name: "Back to clip layouts", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Leave without saving?", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Keep editing", exact: true }).click();
			await expect(page.getByRole("button", { name: "Save layout", exact: true })).toBeEnabled();
		});

test("Settings identity keeps the support ID compact in both themes and viewport sizes", async ({ page, request, tourWorld }, info) => {
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query(`UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2`, [creatorId, guideContentKey]);
	await page.goto(`${tourWorld.origin}/dashboard/settings`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	for (const theme of ["light", "dark"])
		for (const width of [390, 1440]) {
			await page.setViewportSize({ width, height: 950 });
			await page.evaluate((t) => localStorage.setItem("theme", t), theme);
			await page.reload();
			const identity = page.locator('[data-tour="settings-overview"]'),
				id = page.getByText("User ID:", { exact: true });
			await expect(identity).toBeVisible();
			await expect(id).toBeVisible();
			if (width === 1440) {
				const [a, b] = await Promise.all([identity.boundingBox(), id.boundingBox()]);
				expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(20);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ path: info.outputPath(`settings-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
		}
});

for (const width of [390, 1440])
	test(`Clip override and preview recovery at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 950 });
		const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
		await tourWorld.fixture.pool.query("UPDATE playlist_clips SET clip_data=jsonb_set(clip_data::jsonb,'{testPreviewOfficial}','true')::text WHERE clip_id=$1", [id]);
		const { createClipComposition } = await import("../../src/app/lib/clipComposition");
		const composition = createClipComposition("mobile");
		await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, "clip-layout-template:v2:camera", JSON.stringify({ name: "Camera mobile", composition })]);
		await page.goto(`${tourWorld.origin}/dashboard/clip-layouts?layout=camera&clip=${id}`);
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await page.reload();
		await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
		const box = page.getByRole("button", { name: "Camera output", exact: true });
		await box.focus();
		await page.keyboard.press("ArrowDown");
		await page.locator("video").evaluate((v) => v.dispatchEvent(new Event("error")));
		await expect(page.getByRole("button", { name: "Retry preview", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeDisabled();
		await page.getByRole("button", { name: "Retry preview", exact: true }).click();
		await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
		if (width === 390) {
			await page.evaluate(() => {
				const original = CanvasRenderingContext2D.prototype.drawImage;
				CanvasRenderingContext2D.prototype.drawImage = function () {
					CanvasRenderingContext2D.prototype.drawImage = original;
					throw new Error("Simulated lost preview frame");
				};
			});
			await expect(page.getByRole("button", { name: "Retry preview", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Retry preview", exact: true }).click();
			await expect(page.getByRole("button", { name: "Play preview", exact: true })).toBeEnabled();
			await expect
				.poll(() =>
					page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
						const pixel = canvas.getContext("2d")!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * 0.8), 1, 1).data;
						return pixel[0] + pixel[1] + pixel[2];
					}),
				)
				.toBeGreaterThan(50);
		}
		await page.getByRole("button", { name: "Save clip adjustments", exact: true }).click();
		await expect(page.getByText("Clip adjustments saved", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Save clip adjustments", exact: true })).toBeDisabled();
		const rows = await tourWorld.fixture.pool.query("SELECT content_key,state FROM user_content_states WHERE user_id=$1 AND starts_with(content_key,'clip-layout-')", [creatorId]);
		expect(JSON.parse(rows.rows.find((r: any) => r.content_key === "clip-layout-template:v2:camera").state).composition).toEqual(composition);
		expect(rows.rows.some((r: any) => r.content_key === `clip-layout-override:v2:camera:${id}:mobile`)).toBe(true);
		expect(JSON.parse(rows.rows.find((r: any) => r.content_key === `clip-layout-override:v2:camera:${id}:mobile`).state).composition.layers[0].frame.y).toBeGreaterThan(0);
		await page.screenshot({ path: info.outputPath("override.png"), fullPage: true, animations: "disabled" });
		await page.getByRole("button", { name: "Reset to template", exact: true }).click();
		await page.getByRole("button", { name: "Reset adjustments", exact: true }).click();
		await expect(page.getByRole("dialog")).not.toBeVisible();
		expect((await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, `clip-layout-override:v2:camera:${id}:mobile`])).rowCount).toBe(0);
	});

test("Clip preview actions remain grouped and usable in the installed modal", async ({ page, request, tourWorld }, info) => {
	const { id } = await seedCreatorLibrary({ page, request, tourWorld });
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	for (const width of [390, 1440]) {
		await page.setViewportSize({ width, height: 950 });
		await expect(page.getByRole("button", { name: "Select page", exact: true })).toBeEnabled();
		await page.getByRole("button", { name: "Preview Last night's clutch", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("link", { name: "View clip details", exact: true })).toBeVisible();
		await expect.poll(() => dialog.locator("video").evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
		await expect(dialog.getByRole("link", { name: "Open on Twitch", exact: true })).toHaveAttribute("href", `https://clips.twitch.tv/${id}`);
		const detail = dialog.getByRole("link", { name: "View clip details", exact: true });
		await expect(detail).toHaveClass(/button--secondary/);
		expect(await detail.evaluate((e) => parseFloat(getComputedStyle(e).columnGap))).toBeGreaterThanOrEqual(8);
		await page.screenshot({ path: info.outputPath(`preview-modal-${width}.png`), fullPage: true, animations: "disabled" });
		await detail.click();
		await expect(page).toHaveURL(new RegExp(`/dashboard/clips/${id}$`));
		await page.getByRole("button", { name: "Back to clip inventory", exact: true }).click();
	}
});
