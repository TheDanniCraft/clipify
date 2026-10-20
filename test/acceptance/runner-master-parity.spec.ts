import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { browserDatabaseUrl } from "../support/mcp/browser-database.cjs";
import { createAuthenticatedFixture, type AuthFixture } from "../atdd/support/auth-engine-rewrite";
async function prepare(page: Page) {
	await page.goto("/legal/cookies");
	await expect(page.getByRole("button", { name: "Enable support chat", exact: true })).toBeVisible();
	const preferences = page.getByRole("main").getByRole("button", { name: "Cookie preferences", exact: true });
	await preferences.focus();
	await preferences.press("Enter");
	await Promise.all([page.waitForEvent("load"), page.getByRole("dialog", { name: "Privacy preferences", exact: true }).getByRole("button", { name: "Reject optional", exact: true }).click()]);
}
test("Runner preserves first connection, headless setup, updates, quality and recoverable preview", async ({ page, context, request }, testInfo) => {
	test.setTimeout(180000);
	page.setDefaultTimeout(20000);
	const pool = new Pool({ connectionString: browserDatabaseUrl(), max: 1 });
	let owner: AuthFixture | undefined;
	const runnerId = randomUUID(),
		sessionId = randomUUID(),
		destinationId = randomUUID(),
		runnerToken = randomUUID();
	const latestArm = "a".repeat(64);
	let previewAction: string | undefined,
		failPreview = false,
		manifestPatched = false;
	try {
		owner = await createAuthenticatedFixture(request, context, { withProviderCredentials: true });
		const creatorId = owner.fixture.creatorId;
		await pool.query("INSERT INTO runners(id,owner_id,name,token,status,protocol_version,capabilities) VALUES($1,$2,'Master parity computer',$3,'offline',2,$4::jsonb)", [runnerId, creatorId, runnerToken, JSON.stringify(["admissions", "destinations", "drain", "runner_presentation", "free_lease"])]);
		await pool.query("INSERT INTO runner_destinations(id,owner_id,name,provider,rtmp_url) VALUES($1,$2,'Local output','custom','rtmp://127.0.0.1:1949/live')", [destinationId, creatorId]);
		await pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode,resolution,fps) VALUES($1,$2,$3,$4,'24/7','manual','720p',30)", [sessionId, creatorId, runnerId, owner.fixture.overlayId]);
		await pool.query("INSERT INTO stream_session_destinations(session_id,destination_id,owner_id,position) VALUES($1,$2,$3,0)", [sessionId, destinationId, creatorId]);
		// Synthetic manifest metadata only; installed controls and download-link actions,
		// authorization, heartbeat polling, preview upload/read and storage remain real.
		await page.route(`**/dashboard/runners/${runnerId}`, async (route) => {
			if (route.request().method() !== "POST") return route.continue();
			const action = route.request().headers()["next-action"];
			if (previewAction && action === previewAction && failPreview) return route.abort("failed");
			const response = await route.fetch();
			let body = await response.text();
			if (body.includes('"success":true,"image":null')) previewAction = action;
			if (body.includes('"sourceFingerprint":"local"')) {
				const replacement = body.replace(/"linuxArm":(?:null|"[^"]*")/, `"linuxArm":"${latestArm}"`);
				manifestPatched ||= replacement !== body;
				body = replacement;
			}
			await route.fulfill({ response, body });
		});
		await prepare(page);
		await page.goto(`/dashboard/runners/${runnerId}`);
		const setup = page.getByRole("region", { name: "Connect runner", exact: true });
		await expect(setup.getByRole("heading", { name: "Setup Your Runner", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Save Configuration", exact: true })).toHaveCount(0);
		await expect(setup.getByText("Waiting for Runner to connect", { exact: true })).toBeVisible();
		const expectCenteredSetup = async () => {
			const panel = await setup.boundingBox();
			const spinner = await setup.getByLabel("Waiting for first Runner connection", { exact: true }).boundingBox();
			const title = await setup.getByRole("heading", { name: "Setup Your Runner", exact: true }).evaluate((node) => {
				const range = document.createRange();
				range.selectNodeContents(node);
				const rect = range.getBoundingClientRect();
				return { x: rect.x, width: rect.width };
			});
			expect(panel).not.toBeNull();
			expect(spinner).not.toBeNull();
			const center = panel!.x + panel!.width / 2;
			expect(Math.abs(spinner!.x + spinner!.width / 2 - center)).toBeLessThan(2);
			expect(Math.abs(title.x + title.width / 2 - center)).toBeLessThan(2);
			if ((page.viewportSize()?.width ?? 1280) < 640) {
				const buttons = await Promise.all(["Windows", "Linux", "macOS"].map((platform) => setup.getByRole("button", { name: `Download for ${platform}`, exact: true }).boundingBox()));
				for (const button of buttons) {
					expect(button).not.toBeNull();
					expect(Math.abs(button!.x + button!.width / 2 - center)).toBeLessThan(2);
					expect(Math.abs(button!.width - buttons[0]!.width)).toBeLessThan(2);
				}
			}
		};
		await expectCenteredSetup();
		const advanced = setup.getByRole("button", { name: "Advanced / Docker setup", exact: true });
		await advanced.focus();
		await advanced.press("Enter");
		await expect(setup.getByText(/CLIPIFY_TOKEN/)).toBeVisible();
		const token = setup.getByLabel("Manual Runner Token", { exact: true });
		await expect(token).toHaveAttribute("type", "password");
		await setup.getByRole("button", { name: "Reveal runner token", exact: true }).click();
		await expect(token).toHaveValue(runnerToken);
		await expect(token).toHaveAttribute("type", "text");
		await setup.getByRole("button", { name: "Hide runner token", exact: true }).click();
		await page.evaluate(() => {
			Object.defineProperty(navigator.clipboard, "writeText", {
				configurable: true,
				value: async () => {
					throw new Error("Synthetic clipboard denial");
				},
			});
		});
		await setup.getByRole("button", { name: "Copy runner token", exact: true }).click();
		await expect(setup.getByRole("alert")).toHaveText("Clipboard unavailable. Reveal the token and copy it manually.");
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.evaluate(() => Reflect.deleteProperty(navigator.clipboard, "writeText"));
		await setup.getByRole("button", { name: "Copy runner token", exact: true }).click();
		await expect(setup.getByRole("status").filter({ hasText: "Token copied" })).toBeVisible();
		await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(runnerToken);
		// Observe the real download link action without requiring five executable builds
		// in the browser job. Binary delivery/execution belongs to the native matrix.
		await page.evaluate(() => {
			document.documentElement.dataset.runnerDownloads = "[]";
			document.addEventListener(
				"click",
				(event) => {
					if (!(event.target instanceof HTMLAnchorElement) || !event.target.hasAttribute("download")) return;
					const url = new URL(event.target.href);
					if (url.pathname !== "/api/runner/download") return;
					const seen = JSON.parse(document.documentElement.dataset.runnerDownloads ?? "[]");
					document.documentElement.dataset.runnerDownloads = JSON.stringify([...seen, url.searchParams.get("os")]);
				},
				true,
			);
		});
		for (const platform of ["windows", "linux", "linux-arm64", "macos", "macos-arm64"]) {
			if (platform === "windows") await setup.getByRole("button", { name: "Download for Windows", exact: true }).click();
			else {
				await setup.getByRole("button", { name: platform.startsWith("linux") ? "Download for Linux" : "Download for macOS", exact: true }).click();
				await page.getByRole("menuitem", { name: ({ linux: "Linux x64", "linux-arm64": "Linux ARM64", macos: "macOS Intel", "macos-arm64": "macOS Apple Silicon" } as Record<string, string>)[platform], exact: true }).click();
			}
			const install = page.getByRole("dialog", { name: "Your download is starting" });
			await expect(install).toBeVisible();
			await expect(install.getByText(/^Clipify Runner for/)).toBeVisible();
			const retry = install.getByRole("link", { name: /^download again/ });
			await expect(retry).toHaveAttribute("aria-disabled", "true");
			if (platform === "windows") {
				await expect(retry).not.toHaveAttribute("aria-disabled", "true", { timeout: 7_000 });
				await retry.focus();
				await page.keyboard.press("Enter");
				await expect(retry).toHaveAttribute("aria-disabled", "true");
				await expect(retry).toContainText(/\([1-5]s\)/);
			}
			if (platform.startsWith("linux")) await expect(install.getByText(`chmod +x clipify-runner-${platform}`, { exact: true })).toBeVisible();
			await install.getByRole("button", { name: "Close", exact: true }).click();
			await expect(install).not.toBeVisible();
		}
		expect(await page.evaluate(() => JSON.parse(document.documentElement.dataset.runnerDownloads ?? "[]"))).toEqual(["windows", "windows", "linux", "linux-arm64", "macos", "macos-arm64"]);
		for (const theme of ["dark", "light"]) {
			if (theme === "light") await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			for (const viewport of [
				{ width: 1280, height: 900 },
				{ width: 390, height: 844 },
			]) {
				await page.setViewportSize(viewport);
				await expectCenteredSetup();
				await page.screenshot({ path: testInfo.outputPath(`runner-first-connection-${theme}-${viewport.width}.png`), fullPage: true, animations: "disabled" });
				await setup.getByRole("button", { name: "Download for Windows", exact: true }).click();
				const downloadDialog = page.getByRole("dialog", { name: "Your download is starting" });
				await expect(downloadDialog).toBeVisible();
				await page.screenshot({ path: testInfo.outputPath(`runner-download-${theme}-${viewport.width}.png`), fullPage: true, animations: "disabled" });
				await downloadDialog.getByRole("button", { name: "Close", exact: true }).click();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			}
		}
		await page.setViewportSize({ width: 1280, height: 900 });
		const heartbeat = await request.post("/api/runner/heartbeat", { headers: { Authorization: `Bearer ${runnerToken}` }, data: { requestId: randomUUID(), protocolVersion: 2, capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease"], executions: [], os: "Linux aarch64", version: "outdated-fixture", hostname: "Master parity computer" } });
		expect(heartbeat.status()).toBe(200);
		await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
		await expect(setup).toHaveCount(0);
		expect(manifestPatched).toBe(true);
		await page.getByRole("button", { name: /^Runner details/ }).click();
		await expect(page.getByText("720p at 30 FPS", { exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Download latest runner", exact: true })).toBeEnabled();
		await expect(page.getByLabel("Runner update available", { exact: true })).toBeVisible();
		await pool.query("UPDATE runners SET version=$2 WHERE id=$1", [runnerId, latestArm]);
		await expect(page.getByRole("button", { name: "Runner up to date", exact: true })).toBeDisabled();
		await pool.query("UPDATE stream_sessions SET actual_state='running',last_error='private-diagnostic-with-stream-key' WHERE id=$1", [sessionId]);
		await expect(page.getByText("The Runner reported a broadcast error. Check its logs before retrying.", { exact: true })).toBeVisible();
		await expect(page.getByText("private-diagnostic-with-stream-key", { exact: false })).toHaveCount(0);
		await expect(page.getByText("Waiting for first frame...", { exact: true })).toBeVisible();
		await expect.poll(() => Boolean(previewAction)).toBe(true);
		failPreview = true;
		await expect(page.getByRole("button", { name: "Retry preview", exact: true })).toBeVisible();
		failPreview = false;
		await page.getByRole("button", { name: "Retry preview", exact: true }).click();
		await expect(page.getByText("Waiting for first frame...", { exact: true })).toBeVisible();
		const image = await page.evaluate(() => {
			const canvas = document.createElement("canvas");
			canvas.width = 8;
			canvas.height = 8;
			return canvas.toDataURL("image/jpeg");
		});
		const upload = await request.post("/api/runner/preview", { headers: { Authorization: `Bearer ${runnerToken}` }, data: { overlayId: owner.fixture.overlayId, image } });
		expect(upload.status()).toBe(200);
		const preview = page.getByRole("img", { name: "Broadcast snapshot", exact: true });
		await expect(preview).toBeVisible();
		await expect(page.getByText("Snapshots", { exact: true })).toBeVisible();
		await expect(page.getByRole("timer", { name: "Snapshot refresh" })).toHaveText(/Refresh in [12]s|Refreshing…/);
		await expect.poll(() => preview.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(8);
		for (const theme of ["light", "dark"]) {
			if (theme === "dark") await page.getByRole("button", { name: "Toggle Theme", exact: true }).click();
			for (const width of [1280, 390]) {
				await page.setViewportSize({ width, height: 900 });
				await expect(page.getByRole("timer", { name: "Snapshot refresh" })).toBeVisible();
				await page.screenshot({ path: testInfo.outputPath(`runner-snapshots-${theme}-${width}.png`), fullPage: true, animations: "disabled" });
			}
		}
		await pool.query("UPDATE runners SET status='offline' WHERE id=$1", [runnerId]);
		await expect(page.getByRole("img", { name: "Broadcast snapshot", exact: true })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Stream Configuration", exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Setup Your Runner", exact: true })).toHaveCount(0);
	} finally {
		await page.unrouteAll({ behavior: "wait" });
		await pool.end();
		if (owner) {
			const response = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(response.status()).toBe(204);
		}
	}
});
