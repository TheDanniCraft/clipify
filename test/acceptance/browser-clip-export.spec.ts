import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { createClipComposition } from "../../src/app/lib/clipComposition";
import { unzipSync, strFromU8 } from "fflate";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
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
		await page.getByRole("button", { name: "Reject optional", exact: true }).click();
		await page.reload();
		await page.getByRole("button", { name: "Select page", exact: true }).click();
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
		for (const name of ["Desktop", "Mobile"]) {
			await dialog.getByRole("checkbox", { name, exact: true }).focus();
			await page.keyboard.press("Space");
		}
		await expect(dialog.getByRole("radio", { name: "On this device", exact: true })).toBeChecked();
		await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeEnabled({ timeout: 15000 });
		await dialog.screenshot({ path: info.outputPath("processing-choice.png") });
		const download = page.waitForEvent("download");
		await dialog.getByRole("button", { name: "Start export", exact: true }).click();
		const path = info.outputPath("browser.zip");
		await (await download).saveAs(path);
		expect(heavy).toHaveLength(0);
		const archive = unzipSync(await readFile(path)),
			manifest = JSON.parse(strFromU8(archive["manifest.json"]));
		expect(manifest.clips).toHaveLength(3);
		for (const [index, item] of manifest.clips.entries()) {
			const file = info.outputPath(`browser-${index}.mp4`);
			await writeFile(file, archive[item.filename]);
			const streams = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", file], { encoding: "utf8" })).streams;
			expect(streams.some((s: any) => s.codec_type === "audio")).toBe(true);
			if (index) {
				expect(streams.find((s: any) => s.codec_type === "video")).toMatchObject(item.format === "desktop" ? { width: 1280, height: 720 } : { width: 720, height: 1280 });
				const native = await page.request.post(`${tourWorld.origin}/api/clips/export?format=mp4&plan=1`, { headers: { origin: tourWorld.origin }, data: { creatorId, outputs: [{ key: "native", label: "Native parity", templateId: "browser", format: item.format }], files: [{ clipId: id, outputKey: "native" }] } });
				expect(native.status()).toBe(200);
				const nativeFile = info.outputPath(`native-${index}.mp4`);
				await writeFile(nativeFile, await native.body());
				const comparison = spawnSync("ffmpeg", ["-hide_banner", "-ss", "0.1", "-i", file, "-ss", "0.1", "-i", nativeFile, "-lavfi", "ssim", "-frames:v", "1", "-f", "null", "-"], { encoding: "utf8" });
				expect(comparison.status).toBe(0);
				const similarity = Number(comparison.stderr.match(/All:([\d.]+)/)?.[1]);
				expect(similarity).toBeGreaterThan(0.97);
			}
		}
		await page.screenshot({ path: info.outputPath("browser-completed.png"), fullPage: true });
	});
test("Unsupported devices retain Original and can explicitly choose server processing", async ({ page, request, tourWorld }, info) => {
	await page.setViewportSize({ width: 390, height: 950 });
	await page.addInitScript(() => {
		localStorage.setItem("theme", "light");
		Object.defineProperty(window, "Worker", { value: undefined, writable: true });
	});
	const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope='channel:manage:clips' WHERE account_id=$1", [creatorId]);
	const desktop = createClipComposition("desktop"),
		mobile = createClipComposition("mobile");
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,'clip-layout-template:v2:fallback',$2)", [creatorId, JSON.stringify({ name: "Fallback", composition: desktop, compositions: { desktop, mobile } })]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Export clips", exact: true });
	await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeEnabled();
	await dialog.getByRole("checkbox", { name: "Mobile", exact: true }).focus();
	await page.keyboard.press("Space");
	await expect(dialog.getByRole("radio", { name: "On this device", exact: true })).toBeDisabled();
	await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeDisabled();
	await dialog.screenshot({ path: info.outputPath("unsupported-device.png") });
	await dialog.getByRole("radio", { name: "On the server", exact: true }).focus();
	await page.keyboard.press("Space");
	await expect(dialog.getByRole("button", { name: "Start export", exact: true })).toBeEnabled();
	const download = page.waitForEvent("download");
	await dialog.getByRole("button", { name: "Start export", exact: true }).click();
	await (await download).saveAs(info.outputPath("server-fallback.zip"));
	const archive = unzipSync(await readFile(info.outputPath("server-fallback.zip")));
	expect(Object.keys(archive).filter((name) => name.endsWith(".mp4"))).toHaveLength(2);
});
