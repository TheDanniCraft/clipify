import { test, expect, type TourWorld } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import type { Page, APIRequestContext } from "@playwright/test";
async function setup({ page, request, tourWorld }: { page: Page; request: APIRequestContext; tourWorld: TourWorld }, mode?: string) {
	const seeded = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip-sync-force:${seeded.creatorId}`, JSON.stringify({ lastForcedAt: new Date().toISOString() })]);
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id=$2 AND account_id=$3", ["channel:manage:clips", "twitch", seeded.creatorId]);
	const row = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${seeded.id}`]);
	const value = JSON.parse(row.rows[0].value);
	await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify({ ...value, testDownloadMode: mode }), "clip", `clip:${seeded.creatorId}:${seeded.id}`]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const consent = page.getByRole("button", { name: "Reject optional", exact: true });
	await consent.click();
	await expect(consent).not.toBeVisible();
	await page.reload();
	const mobile = (page.viewportSize()?.width ?? 1280) < 768;
	if (mobile) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	if (mobile) await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
	return { ...seeded, value };
}
async function setMode(tourWorld: TourWorld, creatorId: string, id: string, value: unknown, mode?: string) {
	await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify({ ...(value as object), testDownloadMode: mode }), "clip", `clip:${creatorId}:${id}`]);
}
for (const mode of ["missing_scope", "revoked"])
	test(`Clip export reconnect recovery: ${mode}`, async ({ page, request, tourWorld }) => {
		const seeded = await setup({ page, request, tourWorld }, mode === "revoked" ? mode : undefined);
		if (mode === "missing_scope") await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE account_id=$2", ["", seeded.creatorId]);
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		await page.getByRole("button", { name: "Start export", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Clip exports", exact: true })).toContainText("Reconnect Twitch");
		await expect(page.getByRole("link", { name: "Reconnect Twitch (opens in a new tab)", exact: true })).toHaveAttribute("target", "_blank");
		await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
		await expect(page.getByRole("button", { name: "Retry after reconnect", exact: true })).toBeEnabled();
	});
for (const mode of ["provider_429", "provider_5xx"])
	test(`Clip export provider recovery: ${mode}`, async ({ page, request, tourWorld }) => {
		const seeded = await setup({ page, request, tourWorld }, mode);
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		await page.getByRole("button", { name: "Start export", exact: true }).click();
		const download = page.waitForEvent("download");
		if (mode === "provider_429") {
			await expect(page.getByText(/Waiting for the download limit/)).toBeVisible();
			await setMode(tourWorld, seeded.creatorId, seeded.id, seeded.value);
		} else {
			const retry = page.getByRole("button", { name: "Retry failed files", exact: true });
			await expect(retry).toBeEnabled();
			await setMode(tourWorld, seeded.creatorId, seeded.id, seeded.value);
			await retry.click();
		}
		const archive = await download;
		expect(archive.suggestedFilename()).toMatch(/\.zip$/);
		await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
	});
for (const mode of ["deleted", "html", "truncated"])
	test(`Clip export rejects unavailable media: ${mode}`, async ({ page, request, tourWorld }) => {
		await setup({ page, request, tourWorld }, mode);
		let downloads = 0;
		page.on("download", () => downloads++);
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		await page.getByRole("button", { name: "Start export", exact: true }).click();
		await expect(page.getByRole("dialog", { name: "Clip exports", exact: true })).toContainText("No selected clips could be downloaded");
		await expect(page.getByRole("button", { name: "Retry failed files", exact: true })).toHaveCount(0);
		await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
		expect(downloads).toBe(0);
	});
for (const width of [390, 1440])
	for (const theme of ["light", "dark"] as const)
		test(`Clip export partial retry at ${width}px in ${theme}`, async ({ page, request, tourWorld }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const seeded = await setup({ page, request, tourWorld });
			const second = `LibrarySort01_${seeded.creatorId.slice("e2e-creator-".length)}`;
			await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${seeded.creatorId}:${second}`, JSON.stringify({ ...seeded.value, clip: { ...seeded.value.clip, id: second, title: "Retry this clip" }, testDownloadMode: "media_5xx" })]);
			await page.getByRole("button", { name: "Refresh library", exact: true }).click();
			await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("2 clips");
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
			const firstDownload = page.waitForEvent("download");
			await page.getByRole("button", { name: "Export selected", exact: true }).click();
			await page.getByRole("button", { name: "Start export", exact: true }).click();
			const archive = await firstDownload;
			const entries = unzipSync(new Uint8Array(await readFile((await archive.path())!)));
			const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
			expect(manifest.clips.filter((clip: { status: string }) => clip.status === "included").map((clip: { id: string }) => clip.id)).toEqual([seeded.id]);
			await expect(page.getByRole("dialog", { name: "Clip exports" }).getByText(/1 file skipped/)).toBeVisible();
			await setMode(tourWorld, seeded.creatorId, second, { ...seeded.value, clip: { ...seeded.value.clip, id: second, title: "Retry this clip" } });
			const requestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/clips/export" && request.method() === "POST");
			const retryDownload = page.waitForEvent("download");
			await page.getByRole("button", { name: "Retry failed files", exact: true }).click();
			expect((await requestPromise).postDataJSON().files.map((file: { clipId: string }) => file.clipId)).toEqual([second]);
			await retryDownload;
		});
test("Clip export cancellation retains explicit selection", async ({ page, request, tourWorld }) => {
	await setup({ page, request, tourWorld }, "delay");
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await page.getByRole("button", { name: "Cancel export", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Clip exports" }).getByText("Export cancelled. Your selection is kept.", { exact: true })).toBeVisible();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
	await expect(page.getByRole("button", { name: "Export selected", exact: true })).toBeEnabled();
});
test("Clip export refuses an expired session without dropping the local selection", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("DELETE FROM auth.session WHERE user_id=$1", [seeded.authUserId]);
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Clip exports", exact: true })).toContainText("Sign in again");
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
});

for (const role of ["owner", "operations", "contentManager", "analyst", "billingManager", "custom-read", "custom-export"])
	test(`Clip export authorizes the current ${role} role at the real HTTP boundary`, async ({ page, request, tourWorld }) => {
		const seeded = await setup({ page, request, tourWorld });
		if (role.startsWith("custom-")) await tourWorld.fixture.pool.query("INSERT INTO auth.organization_role (id,organization_id,role,permission) VALUES ($1,$2,$3,$4)", [`role-${seeded.creatorId}`, tourWorld.owner!.creatorOrganizationId, role, JSON.stringify({ creator: ["read"], clips: role === "custom-export" ? ["export"] : [] })]);
		await tourWorld.fixture.pool.query("UPDATE auth.member SET role=$1 WHERE organization_id=$2 AND user_id=$3", [role, tourWorld.owner!.creatorOrganizationId, seeded.authUserId]);
		const result = await page.evaluate(
			async (payload) => {
				const response = await fetch("/api/clips/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
				return { status: response.status, type: response.headers.get("content-type"), body: response.ok ? null : await response.json() };
			},
			{ creatorId: seeded.creatorId, clipIds: [seeded.id] },
		);
		if (["owner", "operations", "contentManager", "custom-export"].includes(role)) {
			expect(result.status).toBe(200);
			expect(result.type).toBe("application/zip");
		} else {
			expect(result.status).toBe(403);
			expect(result.body.code).toBe("PERMISSION_DENIED");
		}
	});
test("Clip export rejects a mixed owned and foreign selection before emitting media", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	const result = await page.evaluate(
		async (payload) => {
			const response = await fetch("/api/clips/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
			return { status: response.status, body: await response.json() };
		},
		{ creatorId: seeded.creatorId, clipIds: [seeded.id, "ForeignClip"] },
	);
	expect(result.status).toBe(400);
	expect(result.body.code).toBe("INVALID_INPUT");
});
test("Clip export records portrait fallback in the downloaded manifest", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld }, "portrait_only");
	// The compatibility API retains portrait fallback; configured Original exports require landscape.
	const response = await page.request.post(`${tourWorld.origin}/api/clips/export`, { headers: { Origin: tourWorld.origin }, data: { creatorId: seeded.creatorId, clipIds: [seeded.id] } });
	expect(response.status()).toBe(200);
	const manifest = JSON.parse(strFromU8(unzipSync(new Uint8Array(await response.body()))["manifest.json"]));
	expect(manifest.clips).toHaveLength(1);
	expect(manifest.clips[0].variant).toBe("portrait");
	expect(manifest.clips[0].status).toBe("included");
});

test("Clip inventory renders a warm ten-thousand-clip page within two seconds", async ({ page, request, tourWorld }, info) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query(`INSERT INTO "twitchCache" (type,key,value) SELECT 'clip','clip:'||$1||':Warm'||i,jsonb_build_object('clip',$2::jsonb||jsonb_build_object('id','Warm'||i,'view_count',i))::text FROM generate_series(1,9999) AS i`, [seeded.creatorId, JSON.stringify(seeded.value.clip)]);
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("10000 clips");
	await expect(page.locator("[data-clip-id]")).toHaveCount(25);
	const first = await page.locator("[data-clip-id]").first().getAttribute("data-clip-id");
	const start = performance.now();
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.locator("[data-clip-id]").first()).not.toHaveAttribute("data-clip-id", first!);
	await expect(page.locator("[data-clip-id]")).toHaveCount(25);
	const elapsedMs = performance.now() - start;
	await info.attach("warm-inventory-latency", { body: JSON.stringify({ clips: 10000, pageSize: 25, elapsedMs }), contentType: "application/json" });
	expect(elapsedMs).toBeLessThan(2000);
});
test("Clip export refuses a suspended creator with actionable feedback", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE users SET disabled=true WHERE id=$1", [seeded.creatorId]);
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Clip exports", exact: true })).toContainText("This creator account is suspended. Contact support");
	await expect(page.getByRole("button", { name: "Retry failed files", exact: true })).toHaveCount(0);
});
test("Clip export withholds buffered media when the current grant is revoked during preparation", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	const second = `LibrarySort01_${seeded.creatorId.slice("e2e-creator-".length)}`;
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${seeded.creatorId}:${second}`, JSON.stringify({ ...seeded.value, clip: { ...seeded.value.clip, id: second, title: "Delayed clip" }, testDownloadMode: "delay" })]);
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("2 clips");
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
	let downloads = 0;
	page.on("download", () => downloads++);
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	await expect
		.poll(async () => {
			const result = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${second}`]);
			return JSON.parse(result.rows[0].value).testMediaStarted;
		})
		.toBe(true);
	await tourWorld.fixture.pool.query("UPDATE auth.member SET role=$1 WHERE organization_id=$2 AND user_id=$3", ["analyst", tourWorld.owner!.creatorOrganizationId, seeded.authUserId]);
	await expect(page.getByRole("dialog", { name: "Clip exports", exact: true })).toContainText("no longer have permission", { timeout: 10000 });
	expect(downloads).toBe(0);
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
});

test("Maximum clip package downloads intact with measured browser memory", async ({ page, request, tourWorld }, info) => {
	test.setTimeout(120000);
	const seeded = await setup({ page, request, tourWorld }, "maximum_file");
	for (let index = 1; index < 4; index++) {
		const id = `LibrarySort${String(index).padStart(2, "0")}_${seeded.creatorId.slice("e2e-creator-".length)}`;
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${seeded.creatorId}:${id}`, JSON.stringify({ ...seeded.value, clip: { ...seeded.value.clip, id, title: `Maximum package clip ${index}` }, testDownloadMode: "maximum_file" })]);
	}
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("4 clips");
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	const cdp = await page.context().newCDPSession(page);
	const samples: { usedSize: number; totalSize: number; embedderHeapUsedSize: number; backingStorageSize: number }[] = [];
	const sample = async () => {
		samples.push(await cdp.send("Runtime.getHeapUsage"));
	};
	await sample();
	let sampling = true;
	const measurements = (async () => {
		while (sampling) {
			await sample();
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	})();
	const started = Date.now();
	try {
		const downloaded = page.waitForEvent("download");
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		await page.getByRole("button", { name: "Start export", exact: true }).click();
		const archive = await downloaded;
		const bytes = new Uint8Array(await readFile((await archive.path())!));
		const entries = unzipSync(bytes);
		const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
		expect(manifest.clips.filter((clip: { status: string }) => clip.status === "included")).toHaveLength(4);
		const videos = Object.entries(entries).filter(([name]) => name.endsWith(".mp4"));
		expect(videos).toHaveLength(4);
		expect(videos.every(([, bytes]) => bytes.length === 32 * 1024 * 1024)).toBe(true);
		await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("4 selected");
		await info.attach("maximum-package-browser-memory.json", { body: JSON.stringify({ archiveBytes: bytes.length, elapsedMs: Date.now() - started, samples, note: "Chromium heap/backing-storage samples; not whole-process RSS or concurrent capacity." }, null, 2), contentType: "application/json" });
	} finally {
		sampling = false;
		await measurements;
		await cdp.detach();
	}
});

test("Refresh library shows synchronized provider metadata and retains selection", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query('DELETE FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip-sync-force:${seeded.creatorId}`]);
	await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify({ ...seeded.value, testProviderTitle: "Synchronized highlight" }), "clip", `clip:${seeded.creatorId}:${seeded.id}`]);
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect(page.getByText("Refresh started. New clips may take a moment to appear.", { exact: false })).toBeVisible();
	await expect
		.poll(
			async () => {
				const row = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${seeded.id}`]);
				return JSON.parse(row.rows[0].value).clip.title;
			},
			{ timeout: 15000 },
		)
		.toBe("Synchronized highlight");
	await page.getByRole("button", { name: "Refresh library", exact: true }).click();
	await expect(page.getByRole("button", { name: "Preview Synchronized highlight", exact: true })).toBeVisible();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
});

test("Clip export downloads Twitch legacy CDN media intact", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld }, "legacy_cdn");
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	const archive = await download;
	const entries = unzipSync(await readFile((await archive.path())!));
	const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
	expect(manifest.clips).toHaveLength(1);
	expect(manifest.clips[0]).toMatchObject({ id: seeded.id, status: "included" });
	expect(strFromU8(entries[manifest.clips[0].filename].slice(4, 8))).toBe("ftyp");
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
});

test("Clip details exposes owned metadata and MP4 with the shared bulk budget", async ({ page, request, tourWorld }, info) => {
	const seeded = await setup({ page, request, tourWorld });
	await page.getByRole("link", { name: "Last night's clutch", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/dashboard/clips/${seeded.id}$`));
	await expect(page.getByRole("heading", { name: "Last night's clutch", exact: true })).toBeVisible();
	await expect(page.getByText("Clip maker", { exact: true })).toBeVisible();
	await expect(page.getByText("Strategy", { exact: true })).toBeVisible();
	const download = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download original", exact: true }).click();
	const media = await download;
	expect(media.suggestedFilename()).toMatch(/\.mp4$/);
	const bytes = await readFile((await media.path())!);
	expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
	await page.getByRole("dialog", { name: "Clip exports" }).getByRole("button", { name: "Close exports", exact: true }).click();
	for (let i = 0; i < 2; i++) expect((await page.request.post(`${tourWorld.origin}/api/clips/export`, { data: { creatorId: seeded.creatorId, clipIds: [seeded.id] }, headers: { Origin: tourWorld.origin } })).status()).toBe(200);
	const denied = await page.request.post(`${tourWorld.origin}/api/clips/export?format=mp4`, { data: { creatorId: seeded.creatorId, clipIds: [seeded.id] }, headers: { Origin: tourWorld.origin } });
	expect(denied.status()).toBe(429);
	expect((await denied.json()).code).toBe("RATE_LIMITED");
	await expect(page.getByText("Download started", { exact: true })).not.toBeVisible({ timeout: 10000 });
	for (const theme of ["light", "dark"]) {
		if (!(await page.locator("html").getAttribute("class"))?.split(" ").includes(theme)) await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
		await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
		for (const width of [390, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
			expect((await page.locator("nav").first().boundingBox())!.y).toBe(0);
			await page.screenshot({ path: info.outputPath(`clip-details-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
		}
	}
});

test("Export failure dialog preserves page geometry and selection", async ({ page, request, tourWorld }, info) => {
	await setup({ page, request, tourWorld }, "html");
	const selection = page.getByRole("status", { name: "Clip selection", exact: true });
	const before = await selection.boundingBox();
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	const details = page.getByRole("dialog", { name: "Clip exports", exact: true });
	await expect(details).toBeVisible();
	await expect(details.getByRole("list")).toContainText("Last night's clutch");
	await expect(details.getByRole("list")).toContainText("Twitch returned an incomplete video");
	await expect(details).not.toContainText("RunnerPresentation_");
	await page.screenshot({ path: info.outputPath("export-error-dialog.png"), fullPage: true });
	await details.getByRole("button", { name: "Close exports", exact: true }).click();
	await expect(details).not.toBeVisible();
	await expect(selection).toHaveText("1 selected");
	const after = await selection.boundingBox();
	expect(Math.abs(after!.x - before!.x)).toBeLessThan(1);
	expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
});

for (const width of [390, 1280])
	test(`Real Sentry feedback does not shift dashboard content at ${width}px`, async ({ page, request, tourWorld }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await setup({ page, request, tourWorld });
		const heading = page.getByRole("heading", { name: "Clip Inventory", exact: true });
		const before = await heading.boundingBox();
		if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
		await page.getByRole("button", { name: "Report a problem", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Report a problem", exact: true });
		await expect(dialog).toBeVisible();
		const during = await heading.boundingBox();
		expect(Math.abs(during!.x - before!.x)).toBeLessThan(1);
		expect(Math.abs(during!.width - before!.width)).toBeLessThan(1);
		await page.screenshot({ path: info.outputPath("sentry-feedback.png"), fullPage: true });
		await dialog
			.getByRole("button", { name: /Cancel|Close/ })
			.first()
			.click();
		await expect(dialog).not.toBeVisible();
	});

test("Mobile Settings sidebar preserves drafts and guided navigation", async ({ page, request, tourWorld }, info) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await setup({ page, request, tourWorld });
	await page.goto(`${tourWorld.origin}/dashboard/settings?tab=creator`);
	const title = page.getByRole("textbox", { name: "Preview title", exact: true });
	await title.fill("Keep this creator draft");
	const timeOrigin = await page.evaluate(() => performance.timeOrigin);
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await page.locator('[data-slot="sidebar-mobile"] [data-tour="settings-team-tab"]').click();
	await expect(page).toHaveURL(/tab=team/);
	await expect(page.getByRole("dialog", { name: "Unsaved Changes", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await page.locator('[data-slot="sidebar-mobile"] [data-tour="guide-launcher"]').click();
	const chapter = page.getByRole("region", { name: "Your Clipify guide", exact: true }).getByRole("button", { name: /^Explore Clipify/ });
	if ((await chapter.getAttribute("aria-expanded")) !== "true") await chapter.click();
	await page.getByRole("button", { name: "Discover AI connections", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose Connections");
	const connections = page.locator('[data-slot="sidebar-mobile"] [data-tour="settings-connections-tab"]');
	await expect(connections).toBeVisible();
	await connections.click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Connected AI apps");
	await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
	await page.screenshot({ path: info.outputPath("mobile-settings-guide.png"), fullPage: true, animations: "disabled" });
	await page.getByRole("button", { name: "Pause guide", exact: true }).click();
	await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
	await page.locator('[data-slot="sidebar-mobile"] [data-tour="settings-creator-tab"]').click();
	await expect(title).toHaveValue("Keep this creator draft");
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Sidebar icons, completed progress and collapse spacing at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
			const seeded = await seedCreatorLibrary({ page, request, tourWorld });
			const { defaultProgress, guideContentKey, journeys } = await import("../../src/app/lib/userTour");
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=$1 WHERE user_id=$2 AND content_key=$3", [JSON.stringify({ ...defaultProgress(), welcomeSeen: true, minimized: true, journeyId: journeys.at(-1)!.id, completed: journeys.flatMap((journey) => journey.tasks.map((task) => task.id)) }), seeded.creatorId, guideContentKey]);
			await page.goto(`${tourWorld.origin}/dashboard/tools`);
			await page.getByRole("button", { name: "Reject optional", exact: true }).click();
			await page.reload();
			if (width === 390) await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			const sidebar = page.locator(`[data-slot="${width === 390 ? "sidebar-mobile" : "sidebar"}"]`);
			const navigation = sidebar.getByRole("treegrid", { name: "Creator navigation", exact: true });
			for (const title of ["Clip Player", "Clip Gallery"]) await expect(navigation.getByRole("row", { name: title, exact: true }).locator("svg").first()).toBeVisible();
			await navigation.getByRole("row", { name: "Settings", exact: true }).click();
			for (const title of ["Account", "Connections", "Creator Page", "Billing", "Team"]) {
				const icon = navigation.getByRole("row", { name: title, exact: true }).locator("svg").first();
				await icon.scrollIntoViewIfNeeded();
				await expect(icon).toBeVisible();
			}
			const circle = sidebar.getByRole("progressbar");
			await expect(circle).toHaveAttribute("aria-valuenow", "100");
			const guide = sidebar.locator('[data-tour="guide-launcher"]');
			const support = sidebar.getByRole("button", { name: "Enable support chat", exact: true });
			await expect(guide.getByText("100%", { exact: true })).toBeVisible();
			expect((await circle.boundingBox())!.width).toBeLessThanOrEqual(20);
			expect((await guide.boundingBox())!.height).toBe((await support.boundingBox())!.height);
			await page.screenshot({ path: info.outputPath("sidebar-polish.png"), animations: "disabled" });
			if (width === 1440) {
				await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				const toggle = page.getByRole("button", { name: "Toggle navigation", exact: true });
				await expect(toggle).toHaveAttribute("aria-expanded", "false");
				await expect
					.poll(async () => {
						const [rail, button] = await Promise.all([sidebar.boundingBox(), toggle.boundingBox()]);
						return button!.x - rail!.x - rail!.width;
					})
					.toBeLessThanOrEqual(10);
				await page.screenshot({ path: info.outputPath("collapsed-sidebar-polish.png"), animations: "disabled" });
			}
		});
