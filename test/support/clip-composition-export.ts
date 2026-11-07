import { execFileSync } from "node:child_process";
import type { Page, APIRequestContext, TestInfo } from "@playwright/test";
import { expect, type TourWorld } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "./creator-library";
type Context = { page: Page; request: APIRequestContext; tourWorld: TourWorld };
export type CompositionExportState = { creatorId: string; id: string; foreign: string; path?: string };
export async function prepareCompositionExports({ page, request, tourWorld }: Context): Promise<CompositionExportState> {
	const { creatorId, id } = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id='twitch' AND account_id=$2", ["channel:manage:clips", creatorId]);
	const { createClipComposition } = await import("../../src/app/lib/clipComposition");
	for (const [key, name, format] of [
		["desk", "Main desktop", "desktop"],
		["mobile1", "Camera mobile", "mobile"],
		["mobile2", "Gameplay mobile", "mobile"],
	] as const) {
		await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, `clip-layout-template:v2:${key}`, JSON.stringify({ name, composition: createClipComposition(format) })]);
	}

	const desktop = createClipComposition("desktop");
	const overridden = { ...desktop, layers: [...desktop.layers, { id: "title", kind: "title", label: "Clip title", fontSize: 64, frame: { x: 0.05, y: 0.05, w: 0.9, h: 0.12 } }] };
	await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [creatorId, `clip-layout-override:v2:desk:${id}`, JSON.stringify({ composition: overridden })]);
	const otherReply = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { withProviderCredentials: true, billingState: "active" } });
	expect(otherReply.status()).toBe(200);
	const foreign = (await otherReply.json()).fixture.creatorId;
	for (const [key, state] of [
		["clip-layout-template:v2:secret", { name: "Forbidden layout", composition: desktop }],
		["clip-layout-template:v2:desk", { name: "Foreign desktop", composition: desktop }],
		[`clip-layout-override:v2:desk:${id}`, { composition: desktop }],
		["clip-layout-default:v2:desktop", { id: "desk" }],
	] as const)
		await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [foreign, key, JSON.stringify(state)]);
	return { creatorId, id, foreign };
}
export async function downloadCompositionExports({ page, tourWorld }: Context, state: CompositionExportState, info: TestInfo) {
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	await page.getByRole("button", { name: "Reject optional", exact: true }).click();
	await page.reload();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	for (const name of ["Desktop", "Mobile"]) {
		const checkbox = page.getByRole("checkbox", { name, exact: true });
		await checkbox.focus();
		await page.keyboard.press("Space");
		await expect(checkbox).toBeChecked();
	}
	await expect(page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: /Layout templates/ })).toBeEnabled();
	await page.getByRole("dialog", { name: "Export clips", exact: true }).locator('[data-slot="autocomplete-trigger"]').click();
	await expect(page.getByRole("option", { name: "Forbidden layout", exact: true })).toHaveCount(0);
	for (const name of ["Camera mobile", "Main desktop"]) {
		const option = page.getByRole("option", { name, exact: true });
		if ((await option.getAttribute("aria-selected")) !== "true") await option.click();
	}
	// Remove the automatically selected legacy template if it is not one of these two.
	const extra = page.getByRole("option", { name: "Gameplay mobile", exact: true });
	if ((await extra.getAttribute("aria-selected")) === "true") await extra.click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("status", { name: "Export file count" })).toHaveText("5 video files");
	const download = page.waitForEvent("download", { timeout: 90000 });
	await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	const path = info.outputPath("four-versions.zip");
	await (await download).saveAs(path);
	state.path = path;
}
export async function verifyCompositionExports({ tourWorld }: Context, state: CompositionExportState, info: TestInfo) {
	const { creatorId, id, foreign, path } = state;
	const { readFile, writeFile } = await import("node:fs/promises"),
		{ unzipSync, strFromU8 } = await import("fflate");
	const files = unzipSync(await readFile(path!)),
		manifest = JSON.parse(strFromU8(files["manifest.json"]));
	expect(manifest.clips).toHaveLength(5);
	expect(manifest.clips.map((clip: any) => clip.outputLabel)).toEqual(["Original", "Camera mobile Desktop", "Camera mobile Mobile", "Main desktop Desktop", "Main desktop Mobile"]);
	for (const [index, clip] of manifest.clips.entries()) {
		const mediaPath = info.outputPath(`version-${index}.mp4`);
		await writeFile(mediaPath, files[clip.filename]);
		const media = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-show_streams", "-of", "json", mediaPath], { encoding: "utf8" }));
		if (index) expect(media.streams.find((s: any) => s.codec_type === "video")).toMatchObject(clip.format === "desktop" ? { width: 1280, height: 720 } : { width: 720, height: 1280 });
		expect(clip.id).toBe(id);
	}
	const desktopFile = manifest.clips.find((clip: any) => clip.outputLabel === "Main desktop Desktop"),
		originalFile = manifest.clips.find((clip: any) => clip.outputLabel === "Original");
	const originalPath = info.outputPath("source-for-parity.mp4"),
		desktopPath = info.outputPath("desktop-override.mp4");
	await writeFile(originalPath, files[originalFile.filename]);
	await writeFile(desktopPath, files[desktopFile.filename]);
	const whitePixels = (path: string) => {
		const pixels = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vf", "scale=1280:720,crop=1000:150:0:0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
		let count = 0;
		for (let i = 0; i < pixels.length; i += 3) if (pixels[i] > 220 && pixels[i + 1] > 220 && pixels[i + 2] > 220) count++;
		return count;
	};
	expect(whitePixels(desktopPath)).toBeGreaterThan(whitePixels(originalPath) + 100);
	const globalRow = (await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [creatorId, "clip-layout-template:v2:desk"])).rows[0];
	expect(JSON.parse(globalRow.state).composition.layers).toHaveLength(1);
	const remaining = await tourWorld.fixture.pool.query("SELECT user_id,content_key FROM user_content_states WHERE user_id=ANY($1::text[]) AND content_key=ANY($2::text[])", [
		[creatorId, foreign],
		["clip-layout-template:v2:desk", `clip-layout-override:v2:desk:${id}`, "clip-layout-default:v2:desktop"],
	]);
	expect(remaining.rows.filter((row: any) => row.user_id === creatorId)).toHaveLength(2);
	expect(remaining.rows.filter((row: any) => row.user_id === foreign)).toHaveLength(3);
}
