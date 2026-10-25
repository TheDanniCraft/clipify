import { createBdd } from "playwright-bdd";
import type { Page } from "@playwright/test";
import { test, expect, type TourWorld } from "../support/user-tour";
const { Given, When, Then } = createBdd(test);
const auth = { Authorization: "Bearer clipify-playwright-auth-fixture" };
const key = (world: TourWorld) => `clipify:user-tour:v1:${world.owner!.creatorId}`;
async function progress(page: Page, world: TourWorld) {
	return page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey) ?? '{"completed":[]}'), key(world));
}
async function panel(page: Page) {
	if (!(await page.getByRole("region", { name: "Your Clipify guide" }).isVisible())) await page.getByRole("button", { name: /^(Get started|Guides)/ }).click();
}
async function start(page: Page, name: string, section?: string) {
	await panel(page);
	if (section) {
		const details = page.locator("details").filter({ has: page.getByText(section, { exact: true }) });
		if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
	}
	await page.getByRole("button", { name, exact: true }).click();
}
async function overlay(page: Page, world: TourWorld) {
	await page.goto(`${world.origin}/dashboard/overlay/${world.owner!.overlayId}`);
	await expect(page.getByLabel("Overlay Name", { exact: true })).toBeVisible();
}
async function resumeTask(page: Page, world: TourWorld) {
	const active = (await progress(page, world)).active;
	const names: Record<string, string> = { "overlay.name": "Create and name your overlay", "overlay.source": "Choose your clips", "overlay.preview": "Preview your overlay" };
	await page.getByRole("button", { name: names[active.task], exact: true }).click();
}
async function nameExisting(page: Page, world: TourWorld) {
	await start(page, "Create and name your overlay");
	await pause(page);
	// Opening a real existing row/editor selects it explicitly; discovery alone never skips Add Overlay.
	await overlay(page, world);
	await resumeTask(page, world);
	await expect(page.locator(".driver-popover-title")).toHaveText("Give it a name");
}
async function pause(page: Page) {
	const close = page.getByRole("button", { name: "Pause guide", exact: true });
	await expect(close).toBeVisible();
	await close.click();
}
async function saveName(page: Page, name = "My first overlay") {
	if (await page.getByRole("region", { name: "Your Clipify guide" }).isVisible()) await page.getByRole("button", { name: "Minimize guide" }).click();
	await page.getByLabel("Overlay Name", { exact: true }).fill(name);
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
}
async function seedClips(world: TourWorld) {
	for (const id of ["GuideFirst", "GuideSecond"]) {
		const clip = { id, title: id, broadcaster_id: world.owner!.creatorId, creator_id: "maker", creator_name: "Guide maker", view_count: 10, duration: 10, created_at: new Date().toISOString(), thumbnail_url: "https://example.invalid/clip.png", game_id: "", url: `https://clips.twitch.tv/${id}` };
		await world.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value,expires_at) VALUES ($1,$2,$3,$4)', ["clip", `clip:${world.owner!.creatorId}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() }), new Date(Date.now() + 3600000)]);
	}
}
Given("an isolated authenticated Clipify guide account", async ({ page, request, tourWorld }) => {
	test.info().setTimeout(90000);
	page.on("pageerror", (error) => console.log("Guide browser error:", error.message));
	await page.route("**/*", (route) => (new URL(route.request().url()).origin === tourWorld.origin ? route.continue() : route.abort()));
	page.setDefaultNavigationTimeout(20000);
	page.setDefaultTimeout(15000);
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: auth, data: { withProviderCredentials: true, withPlaylist: true, withPlaylistItems: true, billingState: "active" } });
	expect(response.status()).toBe(200);
	console.log("Guide fixture account response", response.status());
	const owner = await response.json();
	tourWorld.owner = owner.fixture;
	await page.context().addCookies([owner.cookie]);
	await seedClips(tourWorld);
	console.log("Guide fixture clips ready");
	await page.goto(`${tourWorld.origin}/dashboard`);
	console.log("Guide fixture dashboard loaded");
	// Consent owns the first interaction; reject optional services through the real UI.
	await expect(page.getByRole("button", { name: "Reject optional", exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toHaveCount(0);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await page.screenshot({ path: "/tmp/clipify-tour-debug.png", timeout: 5000 });
	await expect(page.getByRole("button", { name: /Get started/ })).toBeVisible();
});

When("the guide panel is opened and minimized", async ({ page }) => {
	await panel(page);
	await page.getByRole("button", { name: "Minimize guide" }).click();
});
Then("the launcher preserves section progress", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: /Get started.*0\/4/ })).toBeVisible();
	expect((await progress(page, tourWorld)).completed).toEqual([]);
});

When("the first overlay journey is followed", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId]);
	await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key(tourWorld));
	await page.reload();
	await start(page, "Create and name your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Create your first overlay");
	await page.getByRole("button", { name: "Add Overlay", exact: true }).click();
	await expect(page.getByLabel("Overlay Name", { exact: true })).toBeVisible();
	await page.getByLabel("Overlay Name", { exact: true }).fill("My first overlay");
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
});
Then("the named configured overlay is saved", async ({ tourWorld, page }) => {
	const saved = await tourWorld.fixture.pool.query("SELECT name FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId]);
	expect(saved.rows).toEqual([{ name: "My first overlay" }]);
	expect((await progress(page, tourWorld)).completed).toContain("overlay.name");
});

When("the clip preview is opened with available clips", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Preview your overlay");
	await page.getByRole("button", { name: "Preview Clips", exact: true }).click();
});
Then("the preview task completes", async ({ page, tourWorld }) => {
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toContain("overlay.preview");
	await expect(page.getByRole("dialog").getByText("GuideFirst", { exact: true })).toBeVisible();
});
When("the clip preview has no matching clips", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query('DELETE FROM "twitchCache"');
	await overlay(page, tourWorld);
	await start(page, "Preview your overlay");
	await expect(page.locator(".driver-popover-description")).toContainText("broader time range");
	await page.getByRole("button", { name: "Preview Clips", exact: true }).click();
});
Then("preview stays incomplete with recovery guidance", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.preview");
});

When("the URL is copied without installation confirmation", async ({ page, tourWorld }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await overlay(page, tourWorld);
	await start(page, "Add it to OBS or Streamlabs");
	await page.getByRole("button", { name: "Copy to clipboard", exact: true }).click();
});
Then("setup stays incomplete until confirmation", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.setup");
	await page.getByRole("button", { name: "Finish setup guide" }).click();
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toContain("overlay.setup");
});
When("the clipboard write is denied", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } }));
	await start(page, "Add it to OBS or Streamlabs");
	await page.getByRole("button", { name: "Copy to clipboard", exact: true }).click();
});
Then("copy guidance remains available without setup completion", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.setup");
	await expect(page.getByRole("button", { name: "Finish setup guide" })).toHaveCount(0);
	await expect(page.locator(".driver-popover-description")).toContainText("private OBS");
});

When("overlay creation fails", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId]);
	await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key(tourWorld));
	await page.reload();
	await start(page, "Create and name your overlay");
	await expect(page.getByRole("button", { name: "Add Overlay", exact: true })).toBeEnabled();
	await page.route("**/dashboard", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "Controlled unavailable action" }) : route.continue()));
	await page.getByRole("button", { name: "Add Overlay", exact: true }).click();
	await expect(page.getByText("Failed to create overlay. Please try again.", { exact: true })).toBeVisible();
});
Then("the creation task stays incomplete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.name");
	const count = await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays");
	expect(Number(count.rows[0].count)).toBe(0);
});
When("an overlay save fails", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await nameExisting(page, tourWorld);
	await page.getByLabel("Overlay Name", { exact: true }).fill("Unsaved draft");
	await page.locator(".driver-popover-next-btn").click();
	await page.route("**/dashboard/overlay/*", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "Controlled unavailable action" }) : route.continue()));
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Could not save overlay", { exact: true })).toBeVisible();
});
Then("the configuration task stays incomplete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.name");
	const row = await tourWorld.fixture.pool.query("SELECT name FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId]);
	expect(row.rows[0].name).not.toBe("Unsaved draft");
});

When("the running tour is paused and the page reloaded", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await nameExisting(page, tourWorld);
	await pause(page);
	await page.reload();
});
Then("the same task can resume without creating another overlay", async ({ page, tourWorld }) => {
	await panel(page);
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Give it a name");
	const count = await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays");
	expect(Number(count.rows[0].count)).toBe(1);
});
When("the current spotlight target disappears", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await nameExisting(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toBeVisible();
	await page.locator('[data-tour="overlay-name"]').evaluate((element) => element.remove());
});
Then("the guide pauses with a recoverable message", async ({ page }) => {
	await expect(page.getByText("In progress · click to continue", { exact: true })).toBeVisible();
	await expect(page.getByRole("status").filter({ hasText: "This control is not available" })).toBeVisible();
});
When("saved guide progress is malformed", async ({ page, tourWorld }) => {
	await page.evaluate((storageKey) => localStorage.setItem(storageKey, "{invalid"), key(tourWorld));
	await page.reload();
});
Then("the guide opens with safe defaults", async ({ page }) => {
	await expect(page.getByRole("button", { name: /Get started.*0\/4/ })).toBeVisible();
	await panel(page);
	await expect(page.getByText("Your Clipify guide", { exact: true })).toBeVisible();
});
When("browser storage is unavailable", async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new Error("denied");
		};
		Storage.prototype.setItem = () => {
			throw new Error("denied");
		};
	});
	await page.reload();
});
Then("guide actions remain usable for the session", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await saveName(page);
	await panel(page);
	await expect(page.getByText("Completed · click to replay").first()).toBeVisible();
});

When("another account owns the opened overlay", async ({ page, request, tourWorld }) => {
	const previous = key(tourWorld);
	await page.evaluate((storageKey) => localStorage.setItem(storageKey, JSON.stringify({ version: 1, completed: ["overlay.name"], minimized: true })), previous);
	const second = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: auth, data: { withProviderCredentials: true, billingState: "active" } });
	const account = await second.json();
	await page.context().addCookies([account.cookie]);
	await page.goto(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}`);
	tourWorld.result = previous;
});
Then("personal progress is unchanged", async ({ page, tourWorld }) => {
	const saved = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), tourWorld.result as string);
	expect(saved.completed).toEqual(["overlay.name"]);
});
When("a keyboard user starts and pauses a tour with Escape", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await panel(page);
	const task = page.getByRole("button", { name: "Create and name your overlay" });
	await task.focus();
	await task.press("Enter");
	await expect(page.locator(".driver-popover-title")).toBeVisible();
	await page.keyboard.press("Escape");
});
Then("focus returns to the guide launcher", async ({ page }) => {
	await expect(page.getByRole("button", { name: /Get started/ })).toBeFocused();
	await expect(page.getByText("In progress · click to continue", { exact: true })).toBeVisible();
});
When("an owned overlay is saved outside a tour", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await saveName(page);
});
Then("the matching checklist tasks complete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["overlay.name", "overlay.source"]));
});

When("guide analytics are emitted", async ({ page, tourWorld }) => {
	await page.evaluate(() => {
		const calls: unknown[] = [];
		(window as unknown as { tourEvents: unknown[] }).tourEvents = calls;
		(window as unknown as { plausible: (event: string, options: unknown) => void }).plausible = (event, options) => calls.push({ event, options });
	});
	await overlay(page, tourWorld); // Reinstall tracker after full navigation.
	await page.evaluate(() => {
		const calls: unknown[] = [];
		(window as unknown as { tourEvents: unknown[] }).tourEvents = calls;
		(window as unknown as { plausible: (event: string, options: unknown) => void }).plausible = (event, options) => calls.push({ event, options });
	});
	await start(page, "Choose your clips");
	await pause(page);
	await saveName(page);
});
Then("only allowlisted task and journey metadata are present", async ({ page, tourWorld }) => {
	const events = await page.evaluate(() => (window as unknown as { tourEvents: { event: string; options: { props: Record<string, string> } }[] }).tourEvents);
	expect(events.some((entry) => entry.event === "guide_started")).toBe(true);
	for (const entry of events.filter((event) => event.event.startsWith("guide_"))) {
		expect(Object.keys(entry.options.props).sort()).toEqual(["journey", "task"]);
		expect(JSON.stringify(entry)).not.toContain(tourWorld.owner!.overlayId);
		expect(JSON.stringify(entry)).not.toContain("My first overlay");
	}
});
When("the guide sections are inspected", async ({ page }) => {
	await panel(page);
});
Then("the supported journeys are offered", async ({ page }) => {
	const summaries = page.getByRole("region", { name: "Your Clipify guide" }).locator("summary");
	await expect(summaries).toHaveCount(5);
	await expect(summaries.nth(0)).toContainText("Get your first overlay running");
	await expect(summaries.nth(1)).toContainText("Make your overlay yours");
	await expect(summaries.nth(2)).toContainText("Build a playlist");
});

When("a visible theme change is saved through its guide", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Customize and save your look", "Make your overlay yours");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours", { timeout: 15000 });
	await page.getByRole("textbox", { name: "Text Color", exact: true }).fill("#FF0000");
	await page.getByRole("textbox", { name: "Text Color", exact: true }).press("Tab");
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Style", exact: true }).click();
	await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
});
Then("the appearance task completes", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("appearance.style");
	const row = await tourWorld.fixture.pool.query("SELECT theme_text_color FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId]);
	expect(row.rows[0].theme_text_color.toLowerCase()).toBe("#ff0000");
});
When("the default appearance is kept", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Customize and save your look", "Make your overlay yours");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours", { timeout: 15000 });
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Keep default look" }).click();
});
Then("customization is not falsely marked complete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("appearance.style");
});

When("the playlist guide creates names and saves clips", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query("DELETE FROM playlist_clips");
	await tourWorld.fixture.pool.query("DELETE FROM playlists");
	await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key(tourWorld));
	await page.reload();
	await start(page, "Create and name a playlist", "Build a playlist");
	await page.getByRole("tab", { name: /Playlists/ }).click();
	await page.getByRole("button", { name: "Add Playlist", exact: true }).click();
	await page.getByPlaceholder("Playlist name").fill("My curated clips");
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
	await start(page, "Add, arrange and save clips", "Build a playlist");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await page
		.getByRole("dialog")
		.locator("label")
		.filter({ has: page.getByRole("checkbox", { name: "Select GuideFirst" }) })
		.click();
	await page.getByRole("button", { name: "Add selected clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await page.locator(".driver-popover-next-btn").click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Arrange your clips");
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
});
Then("the saved playlist tasks complete", async ({ page, tourWorld }) => {
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["playlist.name", "playlist.clips"]));
	const saved = await progress(page, tourWorld);
	const row = await tourWorld.fixture.pool.query("SELECT name FROM playlists WHERE id=$1", [saved.playlistId]);
	expect(row.rows[0].name).toBe("My curated clips");
});
When("playlist clips are arranged and saved", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toBeVisible();
	// Reorder the real draggable rows while the order spotlight is active.
	await start(page, "Add, arrange and save clips", "Build a playlist");
	await page.locator(".driver-popover-next-btn").click();
	const clips = page.getByRole("list", { name: "Playlist clips" }).locator("li");
	await clips.nth(0).dragTo(clips.nth(1));
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
});
Then("the saved order is retained", async ({ tourWorld, page }) => {
	const rows = await tourWorld.fixture.pool.query("SELECT clip_id FROM playlist_clips WHERE playlist_id=$1 ORDER BY position", [tourWorld.owner!.playlistId]);
	expect(rows.rows.map((row) => row.clip_id)).toEqual(["ClipSecond", "ClipFirst"]);
	expect((await progress(page, tourWorld)).completed).toContain("playlist.clips");
});
When("the guided playlist is selected and the overlay saved", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Use your playlist in an overlay", "Build a playlist");
	await expect(page.locator(".driver-popover-title")).toHaveText("Use a curated playlist");
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "Playlist", exact: true }).click();
	await page.locator(".driver-popover-next-btn").click();
	await page.locator(".driver-popover-next-btn").click();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
});
Then("the playlist association task completes", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("playlist.use");
	const rows = await tourWorld.fixture.pool.query("SELECT playlist_id FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId]);
	expect(rows.rows[0].playlist_id).toBe(tourWorld.owner!.playlistId);
});
When("a completed playlist tour is replayed", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await page.getByPlaceholder("Playlist name").fill("Replay collection");
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
	await start(page, "Create and name a playlist", "Build a playlist");
});
Then("the existing playlist is reused", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover-title")).toHaveText("Name your playlist");
	const row = await tourWorld.fixture.pool.query("SELECT count(*) FROM playlists");
	expect(Number(row.rows[0].count)).toBe(1);
});

When("the guide is opened on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 640 });
	await panel(page);
});
Then("the guide stays within the viewport above other widgets", async ({ page }) => {
	const bounds = await page.getByRole("region", { name: "Your Clipify guide" }).boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
	await page.screenshot({ path: "/tmp/clipify-user-tour-mobile.png" });
});

When("the guided overlay is deleted before the user returns", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await nameExisting(page, tourWorld);
	await pause(page);
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId]);
	await page.reload();
	await panel(page);
	await resumeTask(page, tourWorld);
	await expect(page.getByRole("button", { name: "Choose another overlay" })).toBeVisible({ timeout: 15000 });
});
Then("the user can choose a replacement without automatic creation", async ({ page, tourWorld }) => {
	await page.getByRole("button", { name: "Choose another overlay" }).click();
	await expect(page.getByRole("button", { name: "Add Overlay", exact: true })).toBeEnabled();
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Create your first overlay");
	const rows = await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays");
	expect(Number(rows.rows[0].count)).toBe(0);
});
When("a Free account selects the optional theme journey", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query("UPDATE users SET plan='free', created_at='2020-01-01' WHERE id=$1", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("DELETE FROM entitlement_grants WHERE user_id=$1", [tourWorld.owner!.creatorId]);
	await page.reload();
	await start(page, "Customize and save your look", "Make your overlay yours");
});
Then("the guide explains Pro availability without starting a paywall", async ({ page, tourWorld }) => {
	await expect(page.getByRole("status").filter({ hasText: "Theme Studio requires Pro" })).toBeVisible();
	await expect(page.locator(".driver-popover")).toHaveCount(0);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	expect((await progress(page, tourWorld)).completed).not.toContain("appearance.style");
});

Then("the checklist is open in the corner with progress and no automatic spotlight", async ({ page }) => {
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toBeVisible();
	await expect(page.locator(".driver-popover")).toHaveCount(0);
	await expect(page.getByRole("progressbar", { name: "Getting started progress" })).toBeVisible();
	const launcher = page.getByRole("button", { name: /^Get started/ });
	const rect = await launcher.boundingBox();
	const size = page.viewportSize()!;
	expect(size.width - rect!.x - rect!.width).toBeCloseTo(16, 0);
	expect(size.height - rect!.y - rect!.height).toBeCloseTo(16, 0);
	await page.screenshot({ path: "/tmp/clipify-user-tour-revised-desktop.png" });
});
When("a task is manually skipped and the page reloaded", async ({ page }) => {
	const checkbox = page.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	await page.locator("label").filter({ has: checkbox }).click();
	await expect(page.getByRole("group", { name: "Skip this task?" })).toBeVisible();
	await page.getByRole("button", { name: "Skip task", exact: true }).click();
	await page.reload();
});
Then("it is marked skipped and can be restored", async ({ page, tourWorld }) => {
	await expect(page.getByText("Skipped · click to explore", { exact: true })).toBeVisible();
	expect((await progress(page, tourWorld)).skipped).toEqual(["overlay.source"]);
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.source");
	const checkbox = page.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	await page.locator("label").filter({ has: checkbox }).click();
	await expect.poll(async () => (await progress(page, tourWorld)).skipped).toEqual([]);
});
Then("the next task guides source and filters without changing Save behavior", async ({ page, tourWorld }) => {
	await page.getByRole("button", { name: "Continue: Choose your clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose which clips play");
	await page.locator(".driver-popover-next-btn").click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Fine-tune your clip selection");
	await expect(page.locator('[data-tour="overlay-filters"]')).toHaveClass(/driver-active-element/);
	await page.locator(".driver-popover-next-btn").click();
	await expect(page.getByRole("button", { name: "Save Overlay Settings", exact: true })).toBeDisabled();
	await expect(page.getByText("Keep saved settings", { exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Use current settings", exact: true }).click();
	expect((await progress(page, tourWorld)).skipped).toContain("overlay.source");
	await expect(page.getByRole("button", { name: "Continue: Preview your overlay", exact: true })).toBeVisible();
});
When("the website player guide is followed", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await start(page, "Install a Clip Player on your website", "Bring Clipify to your website");
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your website player");
	await page.locator(".driver-popover-next-btn").click();
	await expect(page.locator('[data-tour="website-copy"]')).toHaveClass(/driver-active-element/);
	await page.locator('[data-tour="website-copy"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Install on your website");
	await page.getByRole("button", { name: "Finish website guide", exact: true }).click();
});
Then("the website guide completes after copying public installation code", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("website.embed");
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain("<iframe");
	expect(copied).toContain("/embed/");
	expect(copied).not.toContain("secret");
});
When("the gallery introduction is followed", async ({ page }) => {
	await start(page, "Discover clip galleries", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Galleries");
	await page.getByRole("tab", { name: "Galleries", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Your clip galleries");
	await page.getByRole("button", { name: "Finish introduction", exact: true }).click();
});
Then("the gallery introduction is complete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("explore.galleries");
});
When("the tools and support introductions are followed", async ({ page, tourWorld }) => {
	tourWorld.result = await page.context().cookies();
	await start(page, "Explore website tools", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Website tools");
	await page.getByRole("button", { name: "Finish introduction", exact: true }).click();
	await start(page, "Find help and report a problem", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("We are here to help");
	await expect(page.locator(".driver-popover-description")).toContainText("functionality consent");
	await page.getByRole("button", { name: "Got it", exact: true }).click();
});
Then("the introductions finish with consent choices unchanged", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["explore.tools", "explore.support"]));
	const consent = (cookies: { name: string; value: string }[]) => cookies.filter((cookie) => /consent|c15t/i.test(cookie.name)).map(({ name, value }) => ({ name, value }));
	expect(consent(await page.context().cookies())).toEqual(consent(tourWorld.result as { name: string; value: string }[]));
});
