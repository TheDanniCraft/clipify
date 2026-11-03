import { test, expect, type TourWorld } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import type { Page, APIRequestContext } from "@playwright/test";
async function setup({ page, request, tourWorld }: { page: Page; request: APIRequestContext; tourWorld: TourWorld }, mode?: string) {
	const seeded = await seedCreatorLibrary({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id=$2 AND account_id=$3", ["channel:manage:clips", "twitch", seeded.creatorId]);
	const row = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${seeded.id}`]);
	const value = JSON.parse(row.rows[0].value);
	await tourWorld.fixture.pool.query('UPDATE "twitchCache" SET value=$1 WHERE type=$2 AND key=$3', [JSON.stringify({ ...value, testDownloadMode: mode }), "clip", `clip:${seeded.creatorId}:${seeded.id}`]);
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const consent = page.getByRole("button", { name: "Reject optional", exact: true });
	await consent.click();
	await expect(consent).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
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
		await expect(page.getByRole("region", { name: "Clip export" }).getByRole("alert")).toContainText("Reconnect Twitch");
		await expect(page.getByRole("link", { name: "Reconnect Twitch (opens in a new tab)", exact: true })).toHaveAttribute("target", "_blank");
		await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
		await expect(page.getByRole("button", { name: "Retry after reconnect", exact: true })).toBeEnabled();
	});
for (const mode of ["provider_429", "provider_5xx"])
	test(`Clip export provider recovery: ${mode}`, async ({ page, request, tourWorld }) => {
		const seeded = await setup({ page, request, tourWorld }, mode);
		await page.getByRole("button", { name: "Export selected", exact: true }).click();
		const retry = page.getByRole("button", { name: "Retry failed clips", exact: true });
		await expect(retry).toBeVisible();
		if (mode === "provider_429") {
			await expect(retry).toBeDisabled();
			await expect(retry).toBeEnabled({ timeout: 5000 });
		}
		await setMode(tourWorld, seeded.creatorId, seeded.id, seeded.value);
		const download = page.waitForEvent("download");
		await retry.click();
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
		await expect(page.getByRole("region", { name: "Clip export" }).getByRole("alert")).toContainText("No selected clips could be downloaded");
		await expect(page.getByRole("button", { name: "Retry failed clips", exact: true })).toHaveCount(0);
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
			await page.getByRole("button", { name: "Reload clips", exact: true }).click();
			await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("2 clips");
			await page.getByRole("button", { name: "Select page", exact: true }).click();
			await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
			const firstDownload = page.waitForEvent("download");
			await page.getByRole("button", { name: "Export selected", exact: true }).click();
			const archive = await firstDownload;
			const entries = unzipSync(new Uint8Array(await readFile((await archive.path())!)));
			const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
			expect(manifest.clips.filter((clip: { status: string }) => clip.status === "included").map((clip: { id: string }) => clip.id)).toEqual([seeded.id]);
			await expect(page.getByText("1 clips were skipped.", { exact: false })).toBeVisible();
			await setMode(tourWorld, seeded.creatorId, second, { ...seeded.value, clip: { ...seeded.value.clip, id: second, title: "Retry this clip" } });
			const requestPromise = page.waitForRequest((request) => request.url().endsWith("/api/clips/export") && request.method() === "POST");
			const retryDownload = page.waitForEvent("download");
			await page.getByRole("button", { name: "Retry failed clips", exact: true }).click();
			expect((await requestPromise).postDataJSON().clipIds).toEqual([second]);
			await retryDownload;
		});
test("Clip export cancellation retains explicit selection", async ({ page, request, tourWorld }) => {
	await setup({ page, request, tourWorld }, "delay");
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("button", { name: "Cancel export", exact: true }).click();
	await expect(page.getByText("Export cancelled. Your selection is kept.", { exact: true })).toBeVisible();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("1 selected");
	await expect(page.getByRole("button", { name: "Export selected", exact: true })).toBeEnabled();
});
test("Clip export refuses an expired session without dropping the local selection", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query("DELETE FROM auth.session WHERE user_id=$1", [seeded.authUserId]);
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await expect(page.getByRole("region", { name: "Clip export" }).getByRole("alert")).toContainText("Sign in again");
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
	await setup({ page, request, tourWorld }, "portrait_only");
	const downloading = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	const archive = await downloading;
	const manifest = JSON.parse(strFromU8(unzipSync(new Uint8Array(await readFile((await archive.path())!)))["manifest.json"]));
	expect(manifest.clips).toHaveLength(1);
	expect(manifest.clips[0].variant).toBe("portrait");
	expect(manifest.clips[0].status).toBe("included");
});

test("Clip inventory renders a warm ten-thousand-clip page within two seconds", async ({ page, request, tourWorld }, info) => {
	const seeded = await setup({ page, request, tourWorld });
	await tourWorld.fixture.pool.query(`INSERT INTO "twitchCache" (type,key,value) SELECT 'clip','clip:'||$1||':Warm'||i,jsonb_build_object('clip',$2::jsonb||jsonb_build_object('id','Warm'||i,'view_count',i))::text FROM generate_series(1,9999) AS i`, [seeded.creatorId, JSON.stringify(seeded.value.clip)]);
	await page.getByRole("button", { name: "Reload clips", exact: true }).click();
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
	await expect(page.getByRole("region", { name: "Clip export" }).getByRole("alert")).toContainText("This creator account is suspended. Contact support");
	await expect(page.getByRole("button", { name: "Retry failed clips", exact: true })).toHaveCount(0);
});
test("Clip export withholds buffered media when the current grant is revoked during preparation", async ({ page, request, tourWorld }) => {
	const seeded = await setup({ page, request, tourWorld });
	const second = `LibrarySort01_${seeded.creatorId.slice("e2e-creator-".length)}`;
	await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${seeded.creatorId}:${second}`, JSON.stringify({ ...seeded.value, clip: { ...seeded.value.clip, id: second, title: "Delayed clip" }, testDownloadMode: "delay" })]);
	await page.getByRole("button", { name: "Reload clips", exact: true }).click();
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("2 clips");
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
	let downloads = 0;
	page.on("download", () => downloads++);
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await expect
		.poll(async () => {
			const result = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${seeded.creatorId}:${second}`]);
			return JSON.parse(result.rows[0].value).testMediaStarted;
		})
		.toBe(true);
	await tourWorld.fixture.pool.query("UPDATE auth.member SET role=$1 WHERE organization_id=$2 AND user_id=$3", ["analyst", tourWorld.owner!.creatorOrganizationId, seeded.authUserId]);
	await expect(page.getByRole("region", { name: "Clip export" }).getByRole("alert")).toContainText("no longer have permission", { timeout: 10000 });
	expect(downloads).toBe(0);
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("2 selected");
});
