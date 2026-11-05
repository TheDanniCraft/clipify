import { guideContentKey } from "../../src/app/lib/userTour";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { execFileSync } from "node:child_process";
for (const theme of ["light", "dark"])
	for (const width of [390, 820, 1440])
		test(`C creator dashboard and portrait export at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			test.setTimeout(150000);
			await page.setViewportSize({ width, height: 950 });

			await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
			const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
			const auditMedia = info.outputPath("framing-source.mp4");
			execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=15", "-vf", "drawbox=x=720:y=0:w=240:h=162:color=0x333333:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text=CAMERA:x=760:y=60:fontcolor=white:fontsize=28", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-threads", "1", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", auditMedia]);
			await page.route(`**/clip/${id}.mp4*`, (route) => route.fulfill({ path: auditMedia, contentType: "video/mp4", headers: { "Access-Control-Allow-Origin": "*" } }));
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
			await expect(page.getByRole("grid", { name: "Available streams" })).toBeVisible();
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
			await expect(page.getByRole("link", { name: "Create portrait clips", exact: true })).toBeDisabled();
			await expect(page.getByRole("link", { name: "Create portrait clips", exact: true })).toHaveClass(/button--secondary/);
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
			await expect(page.getByRole("link", { name: "Create portrait clip", exact: true })).toHaveClass(/button--secondary/);
			await page.getByRole("link", { name: "Create portrait clip" }).click();
			await expect(page).toHaveURL(/\/dashboard\/clips\/layout\?/);
			await expect(page.getByRole("button", { name: "Play clip", exact: true })).toBeEnabled();
			await expect.poll(() => page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
			const sourceFrame = page.locator("[data-source-stage]"),
				portraitFrame = page.locator("[data-portrait-stage]");
			if (width === 1440) {
				const [a, b] = await Promise.all([sourceFrame.boundingBox(), portraitFrame.boundingBox()]);
				expect(Math.abs(a!.height - b!.height)).toBeLessThan(2);
				expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
				expect(b!.width).toBeGreaterThan(210);
			}
			await expect(page.getByRole("radio", { name: "Stacked", exact: true })).toBeChecked();
			if (width === 1440 && theme === "dark") {
				await page.getByRole("radio", { name: "Stacked", exact: true }).focus();
				await page.keyboard.press("ArrowLeft");
				await expect(page.getByRole("radio", { name: "Full", exact: true })).toBeFocused();
				await page.keyboard.press("Space");
				await expect(page.getByRole("radio", { name: "Full", exact: true })).toBeChecked();
				await page.getByRole("radio", { name: "Stacked", exact: true }).click();
			}
			await page.getByRole("button", { name: "Play clip", exact: true }).click();
			await expect(page.getByRole("button", { name: "Pause clip", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Pause clip", exact: true }).click();
			const gameplay = page.getByRole("button", { name: "Move gameplay crop", exact: true });
			await gameplay.focus();
			await page.keyboard.press("ArrowRight");
			if (width === 1440) {
				const crop = page.getByRole("button", { name: "Move camera crop", exact: true });
				const before = await crop.boundingBox();
				if (!before) throw new Error("Camera crop missing");
				await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
				await page.mouse.down();
				await page.mouse.move(before.x + before.width / 2 - 15, before.y + before.height / 2 + 10);
				await page.mouse.up();
				await expect.poll(async () => Number.parseFloat(await crop.evaluate((e) => e.parentElement!.style.left))).toBeLessThan(75);
			}
			await page.getByRole("radio", { name: "Camera", exact: true }).click();
			await page.getByRole("radio", { name: "Full", exact: true }).click();
			await expect(page.getByRole("slider", { name: "Crop width", exact: true })).toHaveValue("100");
			await page.getByRole("radio", { name: "Stacked", exact: true }).click();
			const slider = page.getByRole("slider", { name: "Crop width", exact: true });
			await slider.focus();
			await page.keyboard.press("Home");
			await page.keyboard.press("ArrowRight");
			await page.getByText("Clip title", { exact: true }).click();
			await page.getByRole("button", { name: "Save channel layout", exact: true }).click();
			await expect(page.getByText("Channel layout saved", { exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Save channel layout", exact: true })).toBeDisabled();
			const saved = (await pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-portrait-layout:v1"])).rows[0];
			expect(JSON.parse(saved.state).gameplay.w).toBe(0.03);
			await page.reload();
			await expect(page.getByRole("slider", { name: "Crop width", exact: true })).toHaveValue("3");
			await page.getByRole("button", { name: "Reset layout", exact: true }).click();
			await page.screenshot({ path: info.outputPath("portrait-editor.png"), fullPage: true, animations: "disabled" });
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			const download = page.waitForEvent("download");
			const exportResponse = page.waitForResponse((r) => r.url().includes("/api/clips/export") && r.request().method() === "POST");
			await page.getByRole("button", { name: "Download portrait", exact: true }).click();
			const exported = await exportResponse;
			expect(exported.status(), exported.status() === 200 ? "MP4" : await exported.text()).toBe(200);
			const file = await download;
			const path = info.outputPath("portrait.mp4");
			await file.saveAs(path);
			const media = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", path], { encoding: "utf8" }));
			expect(media.streams.find((s: { codec_type: string }) => s.codec_type === "video")).toMatchObject({ width: 720, height: 1280 });
			await page.getByRole("button", { name: "Back to clip details", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Leave without saving?", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Keep editing", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Leave without saving?", exact: true })).not.toBeVisible();
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

test("A selected portrait batch downloads a ZIP with per-clip titles and metadata", async ({ page, request, tourWorld }, info) => {
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id=$2 AND account_id=$3", ["channel:manage:clips", "twitch", creatorId]);
	const row = (await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0];
	const stored = JSON.parse(row.value);
	const second = `LibrarySort01_${creatorId.slice("e2e-creator-".length)}`;
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${second}`, JSON.stringify({ clip: { ...stored.clip, id: second, title: "Second stream moment" } })]);
	await page.goto(`${tourWorld.origin}/dashboard/clips/layout?clips=${id},${second}`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await expect(page.getByRole("button", { name: "Export portrait clips", exact: true })).toBeEnabled();
	await page.getByText("Clip title", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Clip title", exact: true })).toBeChecked();
	const download = page.waitForEvent("download"),
		reply = page.waitForResponse((r) => r.url().includes("/api/clips/export") && r.request().method() === "POST");
	await page.getByRole("button", { name: "Export portrait clips", exact: true }).click();
	expect((await reply).status()).toBe(200);
	const file = await download;
	const path = info.outputPath("portrait-batch.zip");
	await file.saveAs(path);
	const { readFile, writeFile } = await import("node:fs/promises"),
		{ unzipSync, strFromU8 } = await import("fflate");
	const files = unzipSync(new Uint8Array(await readFile(path))),
		manifest = JSON.parse(strFromU8(files["manifest.json"]));
	expect(manifest.clips).toHaveLength(2);
	expect(manifest.clips.every((clip: { variant: string }) => clip.variant === "portrait")).toBe(true);
	expect(manifest.clips.map((clip: { title: string }) => clip.title)).toContain("Second stream moment");
	for (const [index, [name, bytes]] of Object.entries(files)
		.filter(([name]) => name.endsWith(".mp4"))
		.entries()) {
		const mediaPath = info.outputPath(`batch-${index}.mp4`);
		await writeFile(mediaPath, bytes);
		const stream = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", mediaPath], { encoding: "utf8" }));
		expect(stream.streams.find((s: { codec_type: string }) => s.codec_type === "video")).toMatchObject({ width: 720, height: 1280 });
		expect(name).toMatch(/\.mp4$/);
	}
});

for (const width of [390, 1440])
	test(`Portrait preview failure preserves framing and recovers at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 950 });
		await page.addInitScript(() => localStorage.setItem("theme", "dark"));
		const { id } = await seedCreatorLibrary({ page, request, tourWorld });
		await page.goto(`${tourWorld.origin}/dashboard/clips/layout?clips=${id}`);
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await page.reload();
		await expect(page.getByRole("button", { name: "Play clip", exact: true })).toBeEnabled();
		await page.getByRole("radio", { name: "Full", exact: true }).click();
		await page.getByText("Clip title", { exact: true }).click({ timeout: 10000 });
		const stage = page.locator("[data-source-stage]"),
			before = await stage.boundingBox();
		await page.locator("video").evaluate((v) => v.dispatchEvent(new Event("error")));
		await expect(page.getByRole("button", { name: "Retry preview", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Download portrait", exact: true })).toBeDisabled();
		await expect(page.getByRole("slider", { name: "Preview position", exact: true })).toBeDisabled();
		await expect(page.getByText("Load the source clip to preview your portrait.", { exact: true })).toBeVisible();
		expect((await stage.boundingBox())!.height).toBeCloseTo(before!.height, 0);
		await page.screenshot({ path: info.outputPath("preview-error.png"), fullPage: true, animations: "disabled" });
		await page.getByRole("button", { name: "Retry preview", exact: true }).click();
		await expect(page.getByRole("button", { name: "Play clip", exact: true })).toBeEnabled();
		await expect(page.getByRole("button", { name: "Download portrait", exact: true })).toBeEnabled();
		await expect(page.getByRole("radio", { name: "Full", exact: true })).toBeChecked();
		await expect(page.getByRole("checkbox", { name: "Clip title", exact: true })).toBeChecked();
		await page.screenshot({ path: info.outputPath("preview-recovered.png"), fullPage: true, animations: "disabled" });
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

test("Reset layout clears visible credits as well as framing", async ({ page, request, tourWorld }, info) => {
	const { id } = await seedCreatorLibrary({ page, request, tourWorld });
	await page.goto(`${tourWorld.origin}/dashboard/clips/layout?clips=${id}`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await expect(page.getByRole("button", { name: "Play clip", exact: true })).toBeEnabled();
	await page.getByText("Clip title", { exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Clip title", exact: true })).toBeChecked();
	await expect(page.getByRole("slider", { name: "Text size", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Reset layout", exact: true }).click();
	await expect(page.getByRole("checkbox", { name: "Clip title", exact: true })).not.toBeChecked();
	await expect(page.getByRole("slider", { name: "Text size", exact: true })).toHaveCount(0);
	await expect(page.getByRole("radio", { name: "Stacked", exact: true })).toBeChecked();
	await page.screenshot({ path: info.outputPath("reset-credits.png"), fullPage: true, animations: "disabled" });
});
