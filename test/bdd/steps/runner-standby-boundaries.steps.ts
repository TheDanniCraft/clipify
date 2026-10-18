import { createBdd } from "playwright-bdd";
import { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { test, expect } from "../support/mcp-support";
import { state } from "../support/runner-presentation";
import { browserDatabaseUrl } from "../../support/mcp/browser-database.cjs";
const { Given, When, Then } = createBdd(test);

When("image storage fails while they upload a new standby image", async ({ page, mcpWorld }) => {
	const { standbyImageBoundary } = await import("../../support/runner/standby-image-boundary");
	const file = await standbyImageBoundary({});
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	boundary.image = { width: 16, height: 16, mimeType: file.mimeType };
	let failedUploads = 0;
	await page.route("**/api/runner/branding-assets?**", async (route) => {
		failedUploads++;
		await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, code: "SERVICE_UNAVAILABLE", error: "Could not upload the image. Your saved appearance is unchanged. Please try again." }) });
	});
	await page.getByLabel("Standby background image", { exact: true }).setInputFiles(file);
	await expect.poll(() => failedUploads).toBe(1);
	await expect(page.getByRole("alert").filter({ hasText: "Could not upload the image. Your saved appearance is unchanged." })).toBeVisible();
});

Given("its playlist has no playable clips", async ({ mcpWorld }) => {
	const world = state(mcpWorld.input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("DELETE FROM playlist_clips WHERE playlist_id=$1", [world.owner.fixture.playlistId]);
		expect(Number((await pool.query("SELECT count(*) FROM playlist_clips WHERE playlist_id=$1", [world.owner.fixture.playlistId])).rows[0].count)).toBe(0);
	} finally {
		await pool.end();
	}
});

Then("its active presentation shows the configured empty-playlist standby", async ({ page, mcpWorld }) => {
	const world = state(mcpWorld.input);
	const response = await page.request.post("http://127.0.0.1:3107/api/runner/presentation", { headers: { Authorization: `Bearer ${world.token}` }, data: { sessionId: world.sessionId, executionGeneration: world.generation } });
	expect(response.status()).toBe(200);
	const { url } = await response.json();
	await page.goto(`http://127.0.0.1:3107${url}`);
	await expect(page.locator("[data-runner-content-phase]")).toHaveAttribute("data-runner-content-phase", /^(standby|empty)$/);
	await expect(page.locator("[data-runner-standby]")).toHaveCSS("background-color", "rgb(22, 50, 79)");
	await expect(page.getByText("Original scene", { exact: true })).toBeVisible();
	await expect(page.getByRole("img", { name: "Standby background", exact: true })).toHaveJSProperty("naturalWidth", 16);
	await expect(page.locator('[data-runner-content-phase="playback"]')).toHaveCount(0);
});
type Boundary = { before: Record<string, unknown>; assets: Record<string, unknown>[]; oldAsset: string; length?: number; image?: { width: number; height: number; mimeType: string } };
async function readStored(input?: Record<string, unknown>) {
	const world = state(input);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		return { profile: (await pool.query("SELECT to_jsonb(p) AS profile FROM runner_branding_profiles p WHERE owner_id=$1 AND runner_id=$2", [world.owner.fixture.creatorId, world.runnerId])).rows[0]?.profile, assets: (await pool.query("SELECT id,checksum,normalized_mime,size_bytes,width,height FROM runner_branding_assets WHERE owner_id=$1 ORDER BY id", [world.owner.fixture.creatorId])).rows };
	} finally {
		await pool.end();
	}
}
Given("its saved custom standby has an existing image and message", async ({ mcpWorld }) => {
	const world = state(mcpWorld.input);
	const sharp = (await import("sharp")).default;
	const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 60, b: 90 } } })
		.png()
		.toBuffer();
	const oldAsset = randomUUID();
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	try {
		await pool.query("INSERT INTO runner_branding_assets(id,owner_id,kind,normalized_mime,size_bytes,width,height,checksum,bytes) VALUES($1,$2,'background','image/png',$3,16,16,$4,$5)", [oldAsset, world.owner.fixture.creatorId, bytes.length, createHash("sha256").update(bytes).digest("hex"), bytes]);
		await pool.query("INSERT INTO runner_branding_profiles(owner_id,runner_id,watermark_corner,standby_background_color,background_asset_id,message) VALUES($1,$2,'bottom_right','#16324f',$3,'Original scene')", [world.owner.fixture.creatorId, world.runnerId, oldAsset]);
	} finally {
		await pool.end();
	}
	const stored = await readStored(mcpWorld.input);
	mcpWorld.input = { ...mcpWorld.input, standbyBoundary: { before: stored.profile, assets: stored.assets, oldAsset } satisfies Boundary };
});
When("they submit a standby message containing {int} characters", async ({ page, mcpWorld }, length: number) => {
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	boundary.length = length;
	const editor = page.getByLabel("Standby message", { exact: true });
	await expect(editor).toBeVisible();
	if (length <= 160) await editor.fill("x".repeat(length));
	else
		await editor.evaluate((element, count) => {
			const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
			setter.call(element, "x".repeat(count));
			element.dispatchEvent(new Event("input", { bubbles: true }));
		}, length);
	await expect(editor).toHaveValue("x".repeat(length));
	await expect(page.getByText(`${length}/160 characters`, { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Save appearance", exact: true }).click();
});
Then("the standby message is {string} and the saved appearance is consistent", async ({ page, mcpWorld }, outcome: string) => {
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	if (outcome === "accepted") await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
	else await expect(page.getByRole("alert")).toBeVisible();
	const stored = await readStored(mcpWorld.input);
	if (outcome === "accepted") {
		expect(stored.profile).toMatchObject({ ...boundary.before, message: "x".repeat(boundary.length!), revision: Number(boundary.before.revision) + 1, updated_at: expect.any(String) });
		expect(stored.assets).toEqual(boundary.assets);
	} else {
		expect(stored.profile).toEqual(boundary.before);
		expect(stored.assets).toEqual(boundary.assets);
	}
	await page.reload();
	await expect(page.getByLabel("Standby message", { exact: true })).toHaveValue(outcome === "accepted" ? "x".repeat(boundary.length!) : String(boundary.before.message));
});

When("they upload a standby image containing {int} file bytes", async ({ page, mcpWorld }, bytes: number) => {
	const { standbyImageBoundary } = await import("../../support/runner/standby-image-boundary");
	const file = await standbyImageBoundary({ bytes });
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	boundary.image = { width: 16, height: 16, mimeType: file.mimeType };
	await page.getByLabel("Standby background image", { exact: true }).setInputFiles(file);
});

Then("the standby image is {string} and the saved appearance is consistent", async ({ page, mcpWorld }, outcome: string) => {
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	const image = page.frameLocator('iframe[title="Runner appearance preview"]').getByRole("img", { name: "Standby background", exact: true });
	if (outcome === "accepted") {
		await expect(image).toHaveJSProperty("naturalWidth", boundary.image!.width);
		await expect(image).toHaveJSProperty("naturalHeight", boundary.image!.height);
		await expect.poll(async () => (await readStored(mcpWorld.input)).assets.length).toBe(2);
		// Upload stages owned bytes; the saved screen changes only after Save.
		expect((await readStored(mcpWorld.input)).profile).toEqual(boundary.before);
		await expect(page.getByRole("button", { name: "Save appearance", exact: true })).toBeEnabled();
		await page.getByRole("button", { name: "Save appearance", exact: true }).click();
		await expect(page.getByRole("status").filter({ hasText: "Appearance saved" })).toBeVisible();
		const stored = await readStored(mcpWorld.input);
		expect(stored.assets).toHaveLength(1);
		const asset = stored.assets[0];
		expect(asset.id).not.toBe(boundary.oldAsset);
		expect(asset).toMatchObject({ width: boundary.image!.width, height: boundary.image!.height, normalized_mime: boundary.image!.mimeType });
		expect(Number(asset.size_bytes)).toBeGreaterThan(0);
		expect(Number(asset.size_bytes)).toBeLessThanOrEqual(2097152);
		expect(stored.profile).toEqual({ ...boundary.before, background_asset_id: asset.id, revision: Number(boundary.before.revision) + 1, updated_at: expect.any(String) });
	} else {
		await expect(page.getByRole("alert").filter({ hasText: /Images must|Use a PNG|This image could not be read|Could not upload the image/ })).toBeVisible();
		await expect(image).toHaveAttribute("src", new RegExp(boundary.oldAsset));
		await expect(image).toHaveJSProperty("naturalWidth", 16);
		await expect(page.frameLocator('iframe[title="Runner appearance preview"]').getByText(String(boundary.before.message), { exact: true })).toBeVisible();
		const stored = await readStored(mcpWorld.input);
		expect(stored.profile).toEqual(boundary.before);
		expect(stored.assets).toEqual(boundary.assets);
	}
	await page.reload();
	await expect(image).toHaveJSProperty("naturalWidth", outcome === "accepted" ? boundary.image!.width : 16);
	await expect(image).toHaveJSProperty("naturalHeight", outcome === "accepted" ? boundary.image!.height : 16);
	await expect(page.getByLabel("Standby message", { exact: true })).toHaveValue(String(boundary.before.message));
});

When("they upload a {int} by {int} standby raster image", async ({ page, mcpWorld }, width: number, height: number) => {
	const { standbyImageBoundary } = await import("../../support/runner/standby-image-boundary");
	const file = await standbyImageBoundary({ width, height });
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	boundary.image = { width, height, mimeType: file.mimeType };
	await page.getByLabel("Standby background image", { exact: true }).setInputFiles(file);
});

When("they upload a standby file in {string} format", async ({ page, mcpWorld }, format: string) => {
	const { standbyImageBoundary } = await import("../../support/runner/standby-image-boundary");
	let file: { name: string; mimeType: string; buffer: Buffer };
	if (format === "png" || format === "jpeg" || format === "webp") file = await standbyImageBoundary({ format });
	else if (format === "svg") file = { name: "standby.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>') };
	else if (format === "html") file = { name: "standby.png", mimeType: "image/png", buffer: Buffer.from("<!doctype html><html><body>Invalid image</body></html>") };
	else if (format === "unreadable") file = { name: "standby.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]) };
	else throw new Error("Unknown boundary fixture format");
	const boundary = mcpWorld.input?.standbyBoundary as Boundary;
	boundary.image = { width: 16, height: 16, mimeType: file.mimeType };
	await page.getByLabel("Standby background image", { exact: true }).setInputFiles(file);
});
