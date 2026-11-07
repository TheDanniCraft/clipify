import { compositionGraph } from "../../src/server/clip-composition-graph";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
import { unzipSync, strFromU8 } from "fflate";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
test.use({ actionTimeout: 15000, navigationTimeout: 15000 });
for (const mode of ["audio", "audio_untagged"])
	test(`Browser exports preserve Desktop/Mobile widgets, Google fonts and audio without server video rendering (${mode})`, async ({ page, request, tourWorld }, info) => {
		test.setTimeout(90000);
		await page.setViewportSize({ width: mode === "audio" ? 1440 : 390, height: 950 });
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), mode === "audio" ? "dark" : "light");
		const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
		await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
		await tourWorld.fixture.pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb, '{testDownloadMode}', $2::jsonb)::text WHERE type='clip' AND key=$1`, [`clip:${creatorId}:${id}`, JSON.stringify(mode)]);
		const desktop = createClipComposition("desktop"),
			mobile = createClipComposition("mobile");
		for (const layout of [desktop, mobile]) {
			layout.watermark = false;
			layout.layers.push({ id: "title", kind: "title", label: "Clip info", fontSize: 32, frame: { x: 0, y: 0.7, w: 1, h: 0.2 } });
		}
		await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'clip-layout-template:v2:browser',$2)", [creatorId, JSON.stringify({ name: "Browser parity", composition: desktop, compositions: { desktop, mobile } })]);
		await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'creator-brand:v1',$2)", [creatorId, JSON.stringify({ revision: 1, brand: { fontFamily: "Laila", fontSource: "google", themeBackgroundColor: "#202020", themeTextColor: "#ffffff" } })]);
		const heavy: string[] = [];
		page.on("request", (r) => {
			if (new URL(r.url()).pathname === "/api/clips/export") heavy.push(r.url());
		});
		await page.goto(`${tourWorld.origin}/dashboard/clips`);
		const consentReload = page.waitForEvent("domcontentloaded");
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await consentReload;
		await page.getByRole("button", { name: "Select page", exact: true }).click();
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
		for (const name of ["Desktop", "Mobile"]) {
			await dialog.getByRole("checkbox", { name, exact: true }).focus();
			await page.keyboard.press("Space");
		}
		await dialog.getByRole("button", { name: "Next", exact: true }).click();
		await dialog.getByRole("button", { name: /Export for/ }).click();
		await page.getByRole("option", { name: "Discord", exact: true }).click();
		const preset = mode === "audio" ? { id: "custom", maxSizeMB: 1 } : { id: "discord" };
		if (mode === "audio") {
			await dialog.getByRole("radio", { name: "Custom", exact: true }).click();
			const size = dialog.getByRole("textbox", { name: "Custom maximum size (MB)", exact: true });
			await size.fill("1");
			await size.press("Tab");
		}
		await expect(dialog.getByRole("radiogroup", { name: "Processing" })).toHaveCount(0);
		await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeEnabled();
		await dialog.screenshot({ path: info.outputPath("export-settings.png") });
		const download = page.waitForEvent("download");
		await dialog.getByRole("button", { name: "Start export", exact: true }).click();
		const path = info.outputPath("browser.zip");
		await (await download).saveAs(path);
		const exports = page.getByRole("dialog", { name: "Clip exports", exact: true });
		await expect(exports.getByText("Layout: Browser parity", { exact: true })).toHaveCount(2);
		await expect(exports.getByText("Browser parity Desktop", { exact: true })).toHaveCount(0);
		await expect(exports.getByRole("img", { name: "Original", exact: true })).toBeVisible();
		for (const format of ["Original", "Desktop", "Mobile"]) {
			const icon = exports.getByRole("img", { name: format, exact: true });
			await expect(icon).toBeVisible();
			await expect(icon.locator("title")).toHaveText(format);
		}
		await exports.screenshot({ path: info.outputPath("export-format-icons.png") });
		expect(heavy).toHaveLength(0);
		const archive = unzipSync(await readFile(path)),
			manifest = JSON.parse(strFromU8(archive["manifest.json"]));
		const original = manifest.clips.find((item: any) => item.format === "original");
		expect(Buffer.from(archive[original.filename]).equals(await readFile(mode === "audio" ? "test/fixtures/clips/export-audio.mp4" : "test/fixtures/clips/export-audio-untagged.mp4"))).toBe(false);
		expect(manifest.clips).toHaveLength(3);
		for (const [index, item] of manifest.clips.entries()) {
			const file = info.outputPath(`browser-${index}.mp4`);
			await writeFile(file, archive[item.filename]);
			const streams = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" })).streams;
			expect(streams.some((s: any) => s.codec_type === "audio")).toBe(true);
			if (!index) expect(streams.find((s: any) => s.codec_type === "video")).toMatchObject({ width: 640, height: 360 });
			expect(archive[item.filename].byteLength).toBeLessThanOrEqual(mode === "audio" ? 1_000_000 : 20_000_000);
			if (index) {
				expect(archive[item.filename].byteLength).toBeLessThanOrEqual(mode === "audio" ? 1_000_000 : 20_000_000);
				expect(streams.find((s: any) => s.codec_type === "video")).toMatchObject(item.format === "desktop" ? { width: 1280, height: 720 } : { width: 720, height: 1280 });
				const recipeResponse = await page.request.post(`${tourWorld.origin}/api/clips/export/browser`, { headers: { origin: tourWorld.origin }, data: { creatorId, preset, outputs: [{ key: "native", label: "Native parity", templateId: "browser", format: item.format }], files: [{ clipId: id, outputKey: "native" }] } });
				expect(recipeResponse.status()).toBe(200);
				const recipe = (await recipeResponse.json()).clips[0].outputs[0];
				const graph = compositionGraph(recipe.layout, Object.fromEntries(Object.entries(recipe.assets).map(([key, value]) => [key, Buffer.from(String(value).split(",")[1], "base64")])));
				const inputs = [...graph.inputs];
				for (const [assetIndex, image] of graph.images.entries()) {
					const path = info.outputPath(`native-${index}-asset-${assetIndex}.png`);
					await writeFile(path, image);
					const token = `pipe:${assetIndex + 3}`;
					inputs[inputs.indexOf(token)] = path;
				}
				const nativeFile = info.outputPath(`native-${index}.mp4`);
				execFileSync("ffmpeg", [
					"-v",
					"error",
					"-threads",
					"1",
					...(mode === "audio_untagged" ? ["-colorspace", "bt709"] : []),
					"-i",
					mode === "audio" ? "test/fixtures/clips/export-audio.mp4" : "test/fixtures/clips/export-audio-untagged.mp4",
					...inputs,
					"-filter_complex_threads",
					"1",
					"-filter_complex",
					graph.filters.join(";"),
					"-map",
					`[${graph.output}]`,
					"-t",
					"0.3",
					"-an",
					"-c:v",
					"libx264",
					"-threads",
					"1",
					"-bf",
					"0",
					"-preset",
					"veryfast",
					"-crf",
					"23",
					"-pix_fmt",
					"yuv420p",
					"-r",
					"30",
					"-y",
					nativeFile,
				]);
				const comparison = spawnSync("ffmpeg", ["-hide_banner", "-ss", "0.1", "-i", file, "-ss", "0.1", "-i", nativeFile, "-lavfi", "ssim", "-frames:v", "1", "-f", "null", "-"], { encoding: "utf8" });
				expect(comparison.status).toBe(0);
				const similarity = Number(comparison.stderr.match(/All:([\d.]+)/)?.[1]);
				expect(similarity).toBeGreaterThan(0.97);
			}
		}
		await page.screenshot({ path: info.outputPath("browser-completed.png"), fullPage: true });
	});
test("Unsupported browsers show a recoverable local-support state without server processing", async ({ page, request, tourWorld }, info) => {
	await page.setViewportSize({ width: 390, height: 950 });
	await page.addInitScript(() => Object.defineProperty(window, "Worker", { value: undefined, writable: true }));
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const consentReload = page.waitForEvent("domcontentloaded");
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await consentReload;
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
	await dialog.getByRole("button", { name: "Next", exact: true }).click();
	await dialog.getByRole("button", { name: /Export for/ }).click();
	await page.getByRole("option", { name: "Discord", exact: true }).click();
	await expect(dialog.getByRole("heading", { name: "Video conversion is not supported in this browser" })).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeDisabled();
	await dialog.getByRole("button", { name: "Check again" }).click();
	await expect(dialog.getByRole("heading", { name: "Video conversion is not supported in this browser" })).toBeVisible();
	await dialog.screenshot({ path: info.outputPath("unsupported-conversion.png") });
	await dialog.getByRole("button", { name: /Export for/ }).click();
	await page.getByRole("option", { name: "General", exact: true }).click();
	const pending = page.waitForEvent("download");
	await dialog.getByRole("button", { name: "Start export", exact: true }).click();
	const download = await pending;
	const archive = unzipSync(await readFile((await download.path())!));
	expect(Object.keys(archive).filter((name) => name.endsWith(".mp4"))).toHaveLength(1);
	await download.delete();
});

test("Large browser exports write one disk-backed ZIP without dropping files", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(90000);
	// Exercise the package boundary with real controls/downloads; codec parity has separate real-encoding cases.
	await page.addInitScript(() => {
		const NativeWorker = Worker;
		window.Worker = class extends NativeWorker {
			postMessage(data: unknown, options?: StructuredSerializeOptions | Transferable[]) {
				const message = data as { type: string; bytes: ArrayBuffer };
				if (message.type !== "render") {
					if (Array.isArray(options)) super.postMessage(data, options);
					else super.postMessage(data, options);
					return;
				}
				const original = new Uint8Array(message.bytes),
					bytes = new Uint8Array(31 * 1024 * 1024);
				bytes.set(original);
				new DataView(bytes.buffer).setUint32(original.length, bytes.length - original.length);
				bytes.set([102, 114, 101, 101], original.length + 4);
				setTimeout(() => this.dispatchEvent(new MessageEvent("message", { data: { type: "result", bytes: bytes.buffer } })), 0);
			}
		};
	});
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
	const desktop = createClipComposition("desktop"),
		mobile = createClipComposition("mobile");
	for (let i = 1; i <= 3; i++) await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, `clip-layout-template:v2:parts${i}`, JSON.stringify({ name: `Package ${i}`, composition: desktop, compositions: { desktop, mobile } })]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const consentReload = page.waitForEvent("domcontentloaded");
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await consentReload;
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
	for (const name of ["Desktop", "Mobile"]) {
		await dialog.getByRole("checkbox", { name, exact: true }).focus();
		await page.keyboard.press("Space");
	}
	const picker = page.locator('[data-slot="autocomplete-popover"]');
	for (const name of ["Package 1", "Package 2", "Package 3"]) {
		if (!(await picker.isVisible())) await dialog.locator('[data-slot="autocomplete-trigger"]').click({ timeout: 5000 });
		const option = picker.getByRole("option", { name, exact: true });
		await expect(option).toBeVisible();
		if ((await option.getAttribute("aria-selected")) !== "true") await option.click();
	}
	if (await picker.isVisible()) await page.keyboard.press("Escape");
	await expect(dialog.getByRole("status", { name: "Export file count" })).toHaveText("7 video files");
	const downloads: import("@playwright/test").Download[] = [];
	page.on("download", (download) => downloads.push(download));
	await dialog.getByRole("button", { name: "Next", exact: true }).click();
	await dialog.getByRole("button", { name: "Start export", exact: true }).click();
	await expect.poll(() => downloads.length, { timeout: 45000 }).toBe(1);
	const names: string[] = [];
	for (const [i, download] of downloads.entries()) {
		expect(download.suggestedFilename()).toMatch(/^clipify-export-.*Z\.zip$/);
		const path = info.outputPath(`part-${i}.zip`);
		await download.saveAs(path);
		const archive = unzipSync(await readFile(path));
		names.push(...Object.keys(archive).filter((name) => name.endsWith(".mp4")));
		await (await import("node:fs/promises")).unlink(path);
	}
	expect(names).toHaveLength(7);
	expect(new Set(names).size).toBe(7);
	await expect(page.getByRole("button", { name: "Download ZIP", exact: true })).toBeVisible();
	await page.getByRole("dialog", { name: "Clip exports", exact: true }).screenshot({ path: info.outputPath("completed-archive.png") });
});
for (const removed of ["cached", "provider"])
	test(`Partial browser exports retain metadata and skip removed clips (${removed})`, async ({ page, request, tourWorld }, info) => {
		const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
		await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
		const row = (await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE key=$1', [`clip:${creatorId}:${id}`])).rows[0];
		const stored = JSON.parse(row.value),
			missing = `LibrarySort00_${creatorId.slice("e2e-creator-".length)}`;
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache"(type,key,value) VALUES($1,$2,$3)', ["clip", `clip:${creatorId}:${missing}`, JSON.stringify({ ...stored, clip: { ...stored.clip, id: missing, title: "Removed" }, ...(removed === "provider" ? { testDownloadMode: "deleted" } : {}) })]);
		await page.goto(`${tourWorld.origin}/dashboard/clips`);
		const consentReload = page.waitForEvent("domcontentloaded");
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await consentReload;
		await page.getByRole("button", { name: "Select page", exact: true }).click();
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		if (removed === "cached") await tourWorld.fixture.pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{unavailable}','true')::text WHERE key=$1`, [`clip:${creatorId}:${missing}`]);
		const download = page.waitForEvent("download");
		await page.getByRole("button", { name: "Next", exact: true }).click();
		await page.getByRole("button", { name: "Start export", exact: true }).click();
		const path = info.outputPath("partial.zip");
		await (await download).saveAs(path);
		const archive = unzipSync(await readFile(path)),
			manifest = JSON.parse(strFromU8(archive["manifest.json"]));
		expect(Object.keys(archive).filter((name) => name.endsWith(".mp4"))).toHaveLength(1);
		const included = manifest.clips.find((clip: any) => clip.status === "included"),
			skipped = manifest.clips.find((clip: any) => clip.status === "skipped");
		expect(included).toMatchObject({ id, views: 42, duration: 12, categoryId: "123", broadcasterName: "Browser creator", bytes: archive[included.filename].length });
		expect(skipped).toMatchObject({ id: missing, code: "clip_unavailable", retryable: false });
		expect(JSON.stringify(manifest)).not.toContain("sourceToken");
		const modal = page.getByRole("dialog", { name: "Clip exports", exact: true });
		await expect(modal.getByText("Clip unavailable", { exact: true })).toBeVisible();
		await expect(modal.getByRole("button", { name: "Retry failed files", exact: true })).toHaveCount(0);
		await modal.screenshot({ path: info.outputPath("partial-result.png") });
	});
