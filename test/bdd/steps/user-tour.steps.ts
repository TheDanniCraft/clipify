import { createBdd } from "playwright-bdd";
import type { Page } from "@playwright/test";
import { defaultProgress, guideContentKey, journeys, type GuideProgress } from "../../../src/app/lib/userTour";
import { test, expect, type TourWorld } from "../support/user-tour";
const { Given, When, Then } = createBdd(test);
const auth = { Authorization: "Bearer clipify-playwright-auth-fixture" };
const key = (world: TourWorld) => `clipify:user-tour:v1:${world.owner!.creatorId}`;
async function progress(page: Page, world: TourWorld): Promise<GuideProgress> {
	await expect(page.locator("[data-guide-sync]")).toHaveAttribute("data-guide-sync", "idle");
	const result = await world.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [world.owner!.creatorId, guideContentKey]);
	return JSON.parse(result.rows[0].state);
}
async function seedProgress(world: TourWorld, patch: Partial<GuideProgress> = {}) {
	await world.fixture.pool.query("INSERT INTO user_content_states (user_id,content_key,state) VALUES ($1,$2,$3) ON CONFLICT (user_id,content_key) DO UPDATE SET state=EXCLUDED.state", [world.owner!.creatorId, guideContentKey, JSON.stringify({ ...defaultProgress(), ...patch })]);
}
async function panel(page: Page) {
	if (!(await page.getByRole("region", { name: "Your Clipify guide" }).isVisible())) await page.locator('[data-tour="guide-launcher"]').click();
}
async function start(page: Page, name: string, section?: string) {
	await panel(page);
	if (section) {
		const trigger = page.getByRole("region", { name: "Your Clipify guide" }).getByRole("button", { name: new RegExp(`^${section}`) });
		if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
	}
	await page.getByRole("button", { name, exact: true }).click();
}
async function overlay(page: Page, world: TourWorld) {
	await page.goto(`${world.origin}/dashboard/overlay/${world.owner!.overlayId}`);
	await expect(page.getByLabel("Overlay Name", { exact: true })).toBeVisible();
}
async function pause(page: Page) {
	await page.getByRole("button", { name: "Pause guide", exact: true }).click();
}
async function resumeTask(page: Page, world: TourWorld) {
	const active = (await progress(page, world)).active!;
	const task = journeys.flatMap((journey) => journey.tasks.map((task) => ({ id: task.id, title: task.title }))).find((task) => task.id === active.task)!;
	await panel(page);
	await page.getByRole("button", { name: task.title, exact: true }).click();
}
async function nameExisting(page: Page, world: TourWorld) {
	await progress(page, world);
	await seedProgress(world, { overlayId: world.owner!.overlayId, playlistId: world.owner!.playlistId, active: { task: "overlay.name", index: 1, paused: true, navigation: [] } });
	await overlay(page, world);
	await start(page, "Create and name your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Give it a name");
}
async function saveName(page: Page, name = "My first overlay") {
	if (await page.getByRole("region", { name: "Your Clipify guide" }).isVisible()) await page.getByRole("button", { name: "Minimize guide" }).click();
	await page.getByLabel("Overlay Name", { exact: true }).fill(name);
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
}
async function chooseSkip(page: Page, title: string) {
	const checkbox = page.getByRole("checkbox", { name: `Mark ${title} as done` });
	await page.locator("label").filter({ has: checkbox }).click();
	const confirmation = page.getByRole("dialog", { name: `Skip ${title}?`, exact: true });
	await expect(confirmation).toBeVisible();
	await confirmation.getByRole("button", { name: "Skip task", exact: true }).click();
	await expect(confirmation).toBeHidden();
}
async function seedClips(world: TourWorld) {
	for (const id of ["GuideFirst", "GuideSecond"]) {
		const clip = { id, title: id, broadcaster_id: world.owner!.creatorId, creator_id: "maker", creator_name: "Guide maker", view_count: 10, duration: 10, created_at: new Date().toISOString(), thumbnail_url: "https://example.invalid/clip.png", game_id: "", url: `https://clips.twitch.tv/${id}` };
		await world.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value,expires_at) VALUES ($1,$2,$3,$4)', ["clip", `clip:${world.owner!.creatorId}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() }), new Date(Date.now() + 3600000)]);
	}
}
Given("an isolated authenticated Clipify guide account", async ({ page, request, tourWorld }) => {
	test.info().setTimeout(120000);
	page.setDefaultNavigationTimeout(30000);
	page.setDefaultTimeout(15000);
	await page.route("**/*", (route) => (new URL(route.request().url()).origin === tourWorld.origin ? route.continue() : route.abort()));
	const response = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: auth, data: { withProviderCredentials: true, withPlaylist: true, withPlaylistItems: true, billingState: "active" } });
	expect(response.status()).toBe(200);
	const owner = await response.json();
	tourWorld.owner = owner.fixture;
	await page.context().addCookies([owner.cookie]);
	await seedClips(tourWorld);
	// The fixture has sample resources; model a guide account with no prior tutorial activity.
	await seedProgress(tourWorld);
	await page.goto(`${tourWorld.origin}/dashboard`);
	await expect(page.getByRole("button", { name: "Reject optional", exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toHaveCount(0);
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
	await expect(page.getByRole("button", { name: /Get started/ })).toBeVisible();
	await progress(page, tourWorld);
});
When("the guide panel is opened and minimized", async ({ page }) => {
	await panel(page);
	await page.getByRole("button", { name: "Minimize guide" }).click();
});
Then("the launcher preserves section progress", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: /Get started.*0%/ })).toBeVisible();
	expect((await progress(page, tourWorld)).completed).toEqual([]);
});
When("the first overlay journey is followed", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId]);
	await seedProgress(tourWorld);
	await page.reload();
	await start(page, "Create and name your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Create an overlay");
	await page.getByRole("button", { name: "Add Overlay", exact: true }).click();
	await expect(page.getByLabel("Overlay Name", { exact: true })).toBeVisible();
	await page.getByLabel("Overlay Name", { exact: true }).fill("My first overlay");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
});
Then("the named configured overlay is saved", async ({ page, tourWorld }) => {
	expect((await tourWorld.fixture.pool.query("SELECT name FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId])).rows).toEqual([{ name: "My first overlay" }]);
	expect((await progress(page, tourWorld)).completed).toContain("overlay.name");
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
});
When("the clip preview is opened with available clips", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Preview your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Preview your overlay");
	await page.getByRole("button", { name: "Preview Clips", exact: true }).click();
});
Then("the preview task completes", async ({ page, tourWorld }) => {
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toContain("overlay.preview");
	await expect(page.getByRole("dialog").getByText("GuideFirst", { exact: true })).toBeVisible();
	expect((await progress(page, tourWorld)).active?.task).toBe("overlay.setup");
});
When("the clip preview has no matching clips", async ({ page, tourWorld }) => {
	await tourWorld.fixture.pool.query('DELETE FROM "twitchCache"');
	await overlay(page, tourWorld);
	await start(page, "Preview your overlay");
	await expect(page.locator(".driver-popover-description")).toContainText("broaden");
	await page.getByRole("button", { name: "Preview Clips", exact: true }).click();
});
Then("preview stays incomplete with recovery guidance", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.preview");
});
When("the URL is copied without installation confirmation", async ({ page, tourWorld }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await overlay(page, tourWorld);
	await start(page, "Add it to OBS or Streamlabs");
	await expect(page.locator('[data-tour="overlay-copy"]')).toHaveClass(/driver-active-element/);
	await page.getByRole("button", { name: "Copy to clipboard", exact: true }).click();
});
Then("setup stays incomplete until confirmation", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.setup");
	await page.getByRole("button", { name: "Finish guide", exact: true }).click();
	expect((await progress(page, tourWorld)).completed).toContain("overlay.setup");
	expect((await progress(page, tourWorld)).active).toBeNull();
	await expect(page.locator(".driver-popover")).toHaveCount(0);
});
When("the clipboard write is denied", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } }));
	await start(page, "Add it to OBS or Streamlabs");
	await expect(page.locator(".driver-popover-title")).toHaveText("Copy the overlay URL");
	await page.getByRole("button", { name: "Copy to clipboard", exact: true }).click();
});
Then("copy guidance remains available without setup completion", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.setup");
	await expect(page.getByRole("button", { name: "Finish guide", exact: true })).toHaveCount(0);
	await expect(page.locator(".driver-popover-description")).toContainText("private OBS");
});
When("overlay creation fails", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE owner_id=$1", [tourWorld.owner!.creatorId]);
	await seedProgress(tourWorld);
	await page.reload();
	await start(page, "Create and name your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Create an overlay");
	await expect(page.getByRole("button", { name: "Add Overlay", exact: true })).toBeEnabled();
	await progress(page, tourWorld);
	await page.route("**/dashboard", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "Controlled unavailable action" }) : route.continue()));
	await page.getByRole("button", { name: "Add Overlay", exact: true }).click();
});
Then("the creation task stays incomplete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.name");
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count)).toBe(0);
});
When("an overlay save fails", async ({ page, tourWorld }) => {
	await nameExisting(page, tourWorld);
	await page.getByLabel("Overlay Name", { exact: true }).fill("Unsaved draft");
	await page.locator('[data-tour-action="next"]').click();
	await progress(page, tourWorld);
	await page.route("**/dashboard/overlay/*", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 500, body: "Controlled unavailable action" }) : route.continue()));
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Could not save overlay", { exact: true })).toBeVisible();
});
Then("the configuration task stays incomplete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.name");
	expect((await tourWorld.fixture.pool.query("SELECT name FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId])).rows[0].name).not.toBe("Unsaved draft");
});
When("the running tour is paused and the page reloaded", async ({ page, tourWorld }) => {
	await nameExisting(page, tourWorld);
	await pause(page);
	await progress(page, tourWorld);
	await page.reload();
});
Then("the same task can resume without creating another overlay", async ({ page, tourWorld }) => {
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Give it a name");
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count)).toBe(1);
});
When("the current spotlight target disappears", async ({ page, tourWorld }) => {
	await nameExisting(page, tourWorld);
	await page.locator('[data-tour="overlay-name"]').evaluate((element) => element.remove());
});
Then("the guide pauses with a recoverable message", async ({ page }) => {
	await expect(page.getByRole("status").filter({ hasText: "That control isn't available" })).toBeVisible();
	await expect(page.getByRole("checkbox", { name: "Mark Create and name your overlay as done" })).toBeChecked({ indeterminate: true });
});
When("saved guide progress is malformed", async ({ page, tourWorld }) => {
	await page.evaluate((storageKey) => localStorage.setItem(storageKey, "{invalid"), key(tourWorld));
	await page.reload();
});
Then("the guide opens with safe defaults", async ({ page }) => {
	await panel(page);
	await expect(page.getByRole("button", { name: /Get started.*0%/ })).toBeVisible();
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
	expect((await progress(page, tourWorld)).completed).toContain("overlay.name");
});
When("another account owns the opened overlay", async ({ page, request, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { completed: ["overlay.name"], minimized: true });
	const second = await request.post(`${tourWorld.origin}/api/test/auth-fixture`, { headers: auth, data: { withProviderCredentials: true, billingState: "active" } });
	const account = await second.json();
	await page.context().addCookies([account.cookie]);
	await page.goto(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}`);
});
Then("personal progress is unchanged", async ({ tourWorld }) => {
	const saved = await tourWorld.fixture.pool.query("SELECT state FROM user_content_states WHERE user_id=$1 AND content_key=$2", [tourWorld.owner!.creatorId, guideContentKey]);
	expect(JSON.parse(saved.rows[0].state).completed).toEqual(["overlay.name"]);
});
When("a keyboard user starts and pauses a tour with Escape", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await panel(page);
	const task = page.getByRole("button", { name: "Create and name your overlay", exact: true });
	await task.focus();
	await task.press("Enter");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
	await page.keyboard.press("Escape");
});
Then("focus returns to the guide launcher", async ({ page }) => {
	await expect(page.getByRole("button", { name: /Get started/ })).toBeFocused();
	await expect(page.getByRole("checkbox", { name: "Mark Create and name your overlay as done" })).toBeChecked({ indeterminate: true });
});
When("an owned overlay is saved outside a tour", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await saveName(page);
});
Then("the matching checklist tasks complete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["overlay.name", "overlay.source"]));
});
When("guide analytics are emitted", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await page.evaluate(() => {
		const calls: unknown[] = [];
		(window as any).tourEvents = calls;
		(window as any).plausible = (event: string, options: unknown) => calls.push({ event, options });
	});
	await start(page, "Choose your clips");
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await pause(page);
	await saveName(page);
});
Then("only allowlisted task and journey metadata are present", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	const events = await page.evaluate(() => (window as any).tourEvents as { event: string; options: { props: Record<string, string> } }[]);
	expect(events.some((entry) => entry.event === "guide_started")).toBe(true);
	for (const entry of events.filter((event) => event.event.startsWith("guide_"))) {
		expect(Object.keys(entry.options.props).sort()).toEqual(["journey", "task"]);
		expect(JSON.stringify(entry)).not.toContain(tourWorld.owner!.overlayId);
	}
});
When("the guide sections are inspected", async ({ page }) => {
	await panel(page);
});
Then("the supported journeys are offered", async ({ page }) => {
	const sections = page.locator('[data-slot="accordion-trigger"]');
	await expect(sections).toHaveCount(4);
	await expect(sections.nth(3)).toContainText("Explore Clipify");
	await expect(page.getByText("Bring Clipify to your website", { exact: true })).toHaveCount(0);
});
When("a visible theme change is saved through its guide", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Customize your look", "Make your overlay yours");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await page.getByRole("textbox", { name: "Text Color", exact: true }).fill("#FF0000");
	await page.getByRole("textbox", { name: "Text Color", exact: true }).press("Tab");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Style", exact: true }).click();
	await expect(page.getByText("Style saved", { exact: true })).toBeVisible();
});
Then("the appearance task completes", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("appearance.style");
	expect((await tourWorld.fixture.pool.query("SELECT theme_text_color FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId])).rows[0].theme_text_color.toLowerCase()).toBe("#ff0000");
});
When("the default appearance is kept", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Customize your look", "Make your overlay yours");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Keep default look" }).click();
});
Then("customization is not falsely marked complete", async ({ page, tourWorld }) => {
	const saved = await progress(page, tourWorld);
	expect(saved.completed).not.toContain("appearance.style");
	expect(saved.skipped).toContain("appearance.style");
});
When("the playlist guide creates names and saves clips", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("DELETE FROM playlist_clips");
	await tourWorld.fixture.pool.query("DELETE FROM playlists");
	await seedProgress(tourWorld);
	await page.reload();
	await start(page, "Create and name a playlist", "Build a playlist");
	await page.getByRole("tab", { name: "Playlists", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Create a playlist");
	await page.getByRole("button", { name: "Add Playlist", exact: true }).click();
	await page.getByPlaceholder("Playlist name").fill("My curated clips");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Find your clips");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select clips");
	await page
		.getByRole("dialog")
		.locator("label")
		.filter({ has: page.getByRole("checkbox", { name: "Select GuideFirst" }) })
		.click();
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Add selected clips");
	await page.getByRole("button", { name: "Add selected clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Arrange your clips");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
});
Then("the saved playlist tasks complete", async ({ page, tourWorld }) => {
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["playlist.name", "playlist.clips"]));
	const saved = await progress(page, tourWorld);
	expect(saved.completed).toEqual(expect.arrayContaining(["playlist.name", "playlist.clips"]));
	expect((await tourWorld.fixture.pool.query("SELECT name FROM playlists WHERE id=$1", [saved.playlistId])).rows[0].name).toBe("My curated clips");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
});
When("playlist clips are arranged and saved", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { playlistId: tourWorld.owner!.playlistId, active: { task: "playlist.clips", index: 4, paused: true } });
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toBeVisible();
	await start(page, "Add and arrange clips", "Build a playlist");
	await expect(page.locator(".driver-popover-title")).toHaveText("Arrange your clips");
	const clips = page.getByRole("list", { name: "Playlist clips" }).locator("li");
	await clips.nth(0).dragTo(clips.nth(1));
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
});
Then("the saved order is retained", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("playlist.clips");
	const rows = await tourWorld.fixture.pool.query("SELECT clip_id FROM playlist_clips WHERE playlist_id=$1 ORDER BY position", [tourWorld.owner!.playlistId]);
	expect(rows.rows.map((row) => row.clip_id)).toEqual(["ClipSecond", "ClipFirst"]);
});
When("the guided playlist is selected and the overlay saved", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Use your playlist in an overlay", "Build a playlist");
	await expect(page.locator(".driver-popover-title")).toHaveText("Use a playlist");
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "Playlist", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select your playlist");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect(page.getByText("Overlay settings saved", { exact: true })).toBeVisible();
});
Then("the playlist association task completes", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("playlist.use");
	expect((await tourWorld.fixture.pool.query("SELECT playlist_id FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId])).rows[0].playlist_id).toBe(tourWorld.owner!.playlistId);
});
When("a completed playlist tour is replayed", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { playlistId: tourWorld.owner!.playlistId, completed: ["playlist.name"], minimized: true });
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await start(page, "Create and name a playlist", "Build a playlist");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await page.locator('[data-tour="dashboard-home"]').click();
	await page.getByRole("tab", { name: "Playlists", exact: true }).click();
});
Then("the existing playlist is reused", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover-title")).toHaveText("Create a playlist");
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM playlists")).rows[0].count)).toBe(1);
});
When("the guide is opened on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 640 });
	await panel(page);
});
Then("the guide stays within the viewport above other widgets", async ({ page }) => {
	const bounds = await page.getByRole("region", { name: "Your Clipify guide" }).boundingBox();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
	const feedback = page.getByRole("button", { name: "Report a problem", exact: true });
	const reportBox = await feedback.boundingBox();
	expect(reportBox!.y + reportBox!.height).toBeGreaterThan(560);
	await page.screenshot({ path: "/tmp/clipify-user-tour-mobile.png" });
});
When("the guided overlay is deleted before the user returns", async ({ page, tourWorld }) => {
	await nameExisting(page, tourWorld);
	await pause(page);
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("DELETE FROM overlays WHERE id=$1", [tourWorld.owner!.overlayId]);
	await page.reload();
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
});
Then("the user can choose a replacement without automatic creation", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: "Choose another overlay" })).toHaveCount(0);
	await page.locator('[data-tour="dashboard-home"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Create an overlay");
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count)).toBe(0);
});
When("a Free account selects the optional theme journey", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("UPDATE users SET plan='free', created_at='2020-01-01' WHERE id=$1", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("UPDATE billing_subscriptions SET status='canceled' WHERE user_id=$1", [tourWorld.owner!.creatorId]);
	await tourWorld.fixture.pool.query("DELETE FROM entitlement_grants WHERE user_id=$1", [tourWorld.owner!.creatorId]);
	await page.reload();
	await start(page, "Customize your look", "Make your overlay yours");
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
	await expect(page.locator('[data-slot="progress-circle"] svg')).toBeVisible();
	const ring = await page.locator('[data-slot="progress-circle"] svg').boundingBox();
	expect(ring!.width).toBeGreaterThanOrEqual(32);
	expect(ring!.height).toBeGreaterThanOrEqual(32);
	const launcher = await page.getByRole("button", { name: /^Get started/ }).boundingBox();
	const size = page.viewportSize()!;
	expect(size.width - launcher!.x - launcher!.width).toBeCloseTo(16, 0);
	expect(size.height - launcher!.y - launcher!.height).toBeCloseTo(96, 0);
	const feedback = await page.getByRole("button", { name: "Report a problem", exact: true }).boundingBox();
	expect(feedback!.y).toBeGreaterThan(launcher!.y + launcher!.height);
	await page.screenshot({ path: "/tmp/clipify-user-tour-revised-desktop.png" });
});
When("a task is manually skipped and the page reloaded", async ({ page, tourWorld }) => {
	await chooseSkip(page, "Choose your clips");
	await progress(page, tourWorld);
	await page.reload();
});
Then("it is marked skipped and can be restored", async ({ page, tourWorld }) => {
	await panel(page);
	const checkbox = page.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	await expect(checkbox).toBeChecked();
	expect((await progress(page, tourWorld)).skipped).toEqual(["overlay.source"]);
	await page.locator("label").filter({ has: checkbox }).click();
	expect((await progress(page, tourWorld)).skipped).toEqual([]);
});
Then("the next task guides source and filters without changing Save behavior", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await expect(page.getByText(/Continue:|done\./)).toHaveCount(0);
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Adjust the filters");
	await expect(page.locator('[data-tour="overlay-filters"]')).toHaveClass(/driver-active-element/);
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.getByRole("button", { name: "Save Overlay Settings", exact: true })).toBeDisabled();
	await page.getByRole("button", { name: "Use current settings", exact: true }).click();
	expect((await progress(page, tourWorld)).skipped).toContain("overlay.source");
	await expect(page.locator(".driver-popover-title")).toHaveText("Preview your overlay");
});
When("the website player guide is followed", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	await start(page, "Add Clipify to your website", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open the app menu");
	await page.getByRole("button", { name: "Open profile menu", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Tools");
	await page.getByRole("menuitem", { name: "Tools", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose a player");
	await page.locator('[data-tour-action="next"]').click();
	await page.locator('[data-tour="website-copy"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Install on your website");
	await page.getByRole("button", { name: "Finish guide", exact: true }).click();
});
Then("the website guide completes after copying public installation code", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("explore.tools");
	const copied = await page.evaluate(() => navigator.clipboard.readText());
	expect(copied).toContain("<iframe");
	expect(copied).toContain("/embed/");
	expect(copied).not.toContain("secret");
});
When("the gallery introduction is followed", async ({ page }) => {
	await start(page, "Discover clip galleries", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Galleries");
	await page.getByRole("tab", { name: "Galleries", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Discover galleries");
	await page.getByRole("button", { name: "Done", exact: true }).click();
});
Then("the gallery introduction is complete", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("explore.galleries");
});
When("the tools and support introductions are followed", async ({ page, tourWorld }) => {
	tourWorld.result = await page.context().cookies();
	await start(page, "Find help and report a problem", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Report a problem");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Get help");
	await expect(page.locator(".driver-popover-description")).toContainText("Use chat for questions.");
	await page.getByRole("button", { name: "Done", exact: true }).click();
});
Then("the introductions finish with consent choices unchanged", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).completed).toContain("explore.support");
	const consent = (cookies: { name: string; value: string }[]) => cookies.filter((cookie) => /consent|c15t/i.test(cookie.name)).map(({ name, value }) => ({ name, value }));
	expect(consent(await page.context().cookies())).toEqual(consent(tourWorld.result as { name: string; value: string }[]));
	await expect(page.getByText(/Need a hand|Progress is saved|click to replay|click to continue/)).toHaveCount(0);
});
When("the first section is finished and browser data is cleared", async ({ page, tourWorld }) => {
	for (const title of ["Create and name your overlay", "Choose your clips", "Preview your overlay", "Add it to OBS or Streamlabs"]) await chooseSkip(page, title);
	await page.getByRole("button", { name: "Minimize guide" }).click();
	await progress(page, tourWorld);
	const authentication = (await page.context().cookies()).filter((cookie) => !/consent|c15t/i.test(cookie.name));
	await page.evaluate(() => {
		localStorage.clear();
		sessionStorage.clear();
	});
	await page.context().clearCookies();
	// Restore the same authenticated fixture identity, simulating signing back in.
	await page.context().addCookies(authentication);
	await page.reload();
	await expect(page.getByRole("button", { name: "Reject optional", exact: true })).toBeVisible();
	await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
});
Then("the same account keeps its progress without reopening onboarding", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: "Get started · 100%", exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toHaveCount(0);
	expect((await progress(page, tourWorld)).skipped).toHaveLength(4);
});
When("different checklist sections are expanded", async ({ page }) => {
	await panel(page);
	await page.getByRole("button", { name: /^Build a playlist/ }).click();
	await expect(page.getByRole("button", { name: /^Get your first overlay running/ })).toHaveAttribute("aria-expanded", "false");
	await page.getByRole("button", { name: /^Explore Clipify/ }).click();
});
Then("only the last selected section remains expanded", async ({ page }) => {
	const sections = page.locator('[data-slot="accordion-trigger"][aria-expanded="true"]');
	await expect(sections).toHaveCount(1);
	await expect(sections).toContainText("Explore Clipify");
	await expect(page.getByRole("button", { name: /^Build a playlist/ })).toHaveAttribute("aria-expanded", "false");
});
When("completed overlay creation is replayed from the editor", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { overlayId: tourWorld.owner!.overlayId, completed: ["overlay.name"], minimized: true });
	await overlay(page, tourWorld);
	await start(page, "Create and name your overlay");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}`);
	await page.locator('[data-tour="dashboard-home"]').click();
});
Then("Add Overlay is highlighted without opening or creating an overlay", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover-title")).toHaveText("Create an overlay");
	await expect(page.locator('[data-tour="create-overlay"]')).toHaveClass(/driver-active-element/);
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard`);
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM overlays")).rows[0].count)).toBe(1);
});
When("an account with existing resources has no guide record", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query("DELETE FROM user_content_states WHERE user_id=$1 AND content_key=$2", [tourWorld.owner!.creatorId, guideContentKey]);
	await page.reload();
});
Then("existing setup is recognized with the checklist minimized", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: /Get started.*50%/ })).toBeVisible();
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toHaveCount(0);
	expect((await progress(page, tourWorld)).completed).toEqual(expect.arrayContaining(["overlay.name", "overlay.source", "playlist.name", "playlist.clips"]));
});
When("an overlay task is started from Tools", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/tools`);
	await expect(page.getByRole("heading", { name: "Configure Clip Player", exact: true })).toBeVisible();
	await start(page, "Choose your clips");
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your Dashboard");
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/tools`);
});
Then("normal Dashboard navigation opens the overlay through its edit control", async ({ page, tourWorld }) => {
	await page.locator('[data-tour="dashboard-home"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your overlay");
	await page.locator('[data-tour="open-overlay"]').click();
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}`);
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
});
When("a running task's checkbox is opened and cancellation is retried", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Choose your clips");
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await panel(page);
	const checkbox = page.getByRole("checkbox", { name: "Mark Choose your clips as done" });
	await page.locator("label").filter({ has: checkbox }).click();
	const confirmation = page.getByRole("dialog", { name: "Skip Choose your clips?", exact: true });
	await expect(confirmation).toBeVisible();
	await expect(page.getByRole("region", { name: "Your Clipify guide" }).getByRole("dialog")).toHaveCount(0);
	await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(confirmation).toBeHidden();
	expect((await progress(page, tourWorld)).skipped).toEqual([]);
	await page.locator("label").filter({ has: checkbox }).click();
	await expect(confirmation).toBeVisible();
	expect((await progress(page, tourWorld)).skipped).toEqual([]);
	await confirmation.getByRole("button", { name: "Skip task", exact: true }).click();
});
Then("the task is skipped only after its popover confirmation", async ({ page, tourWorld }) => {
	expect((await progress(page, tourWorld)).skipped).toEqual(["overlay.source"]);
	expect((await progress(page, tourWorld)).completed).not.toContain("overlay.source");
});
When("the report button is clicked during its introduction", async ({ page }) => {
	await start(page, "Find help and report a problem", "Explore Clipify");
	await expect(page.locator(".driver-popover-title")).toHaveText("Report a problem");
	await page.getByRole("button", { name: "Report a problem", exact: true }).click();
});
Then("the normal report form opens with the guide paused", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Send report", exact: true })).toBeVisible();
	expect((await progress(page, tourWorld)).active?.paused).toBe(true);
});

When("customization is started inside Theme Studio and left at its save step", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Overlay Style", exact: true })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toBeVisible();
	await progress(page, tourWorld);
	await start(page, "Customize your look", "Make your overlay yours");
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}/theme`);
	await expect(page.locator('[data-tour="theme-controls"]')).toContainText("Text Color");
	await expect(page.locator('[data-tour="theme-controls"]')).toContainText("Background Color");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Save your look");
	await pause(page);
	await page.locator('[data-tour="dashboard-home"]').click();
	await expect(page.getByRole("region", { name: "Your Clipify guide" })).toBeVisible();
});
Then("resuming teaches the route back to Theme Studio and allows reviewing the look", async ({ page, tourWorld }) => {
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Open your overlay");
	await page.locator('[data-tour="open-overlay"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Save your look");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
	await page.screenshot({ path: "/tmp/clipify-tour-theme-workspace.png", animations: "disabled" });
});
When("the appearance-only personalization task keeps its default look", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await panel(page);
	await page.getByRole("button", { name: /^Make your overlay yours/ }).click();
	await expect(page.getByRole("button", { name: "Adjust your filters", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Customize your look", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Keep default look", exact: true }).click();
	await progress(page, tourWorld);
	await page.reload();
});
Then("the launcher retains personalization progress after reload", async ({ page, tourWorld }) => {
	await expect(page.locator('[data-tour="guide-launcher"]')).toHaveAccessibleName("Make your overlay yours · 100%");
	await expect(page.locator('[data-tour="guide-launcher"]')).toContainText("100%");
	expect((await progress(page, tourWorld)).journeyId).toBe("appearance");
	expect((await progress(page, tourWorld)).skipped).toEqual(["appearance.style"]);
});

When("the clip source dropdown is opened during the guide", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { overlayId: tourWorld.owner!.overlayId, playlistId: tourWorld.owner!.playlistId, completed: ["overlay.name"] });
	await overlay(page, tourWorld);
	await start(page, "Choose your clips");
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await expect(page.getByRole("option", { name: "Top Clips - Last 7 Days", exact: true })).toBeVisible();
});
Then("its options stay usable above the dimming and section progress survives reload", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-overlay")).toHaveCSS("opacity", "1");
	const option = page.getByRole("option", { name: "Top Clips - Last 7 Days", exact: true });
	await expect
		.poll(() =>
			option.evaluate((element) => {
				const box = element.getBoundingClientRect();
				const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
				return Boolean(hit && element.contains(hit));
			}),
		)
		.toBe(true);
	await page.screenshot({ path: "/tmp/clipify-tour-dropdown.png", animations: "disabled" });
	await page.mouse.click(40, 150);
	await expect(option).toBeHidden();
	await expect(page.locator(".driver-overlay")).toHaveCSS("opacity", "1");
	await expect(page.locator(".driver-popover-title")).toBeVisible();
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await option.click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await pause(page);
	await progress(page, tourWorld);
	await page.reload();
	await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "38");
	expect((await progress(page, tourWorld)).completed).toContain("overlay.name");
});

When("the clip task is reviewed backward from save through filters to source", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { overlayId: tourWorld.owner!.overlayId, completed: ["overlay.name"] });
	await overlay(page, tourWorld);
	await start(page, "Choose your clips");
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
	const next = page.getByRole("button", { name: "Continue", exact: true });
	await expect(next).toHaveAttribute("data-slot", "button");
	await next.click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Adjust the filters");
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveAttribute("data-slot", "button");
	await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
	await page.screenshot({ path: "/tmp/clipify-tour-hero-back.png", animations: "disabled" });
	await next.click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Save your clip settings");
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveAttribute("data-slot", "button");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Adjust the filters");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "Top Clips - Last 7 Days", exact: true }).click();
	await next.click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Adjust the filters");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.getByRole("button", { name: /Overlay Type/ })).toContainText("Top Clips - Last 7 Days");
});
Then("every later action has a HeroUI Back button and the ring always shows percent", async ({ page, tourWorld }) => {
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Pause guide", exact: true })).toHaveAttribute("data-slot", "button");
	await expect(page.locator('[data-tour="guide-launcher"]')).toContainText("38%");
	await pause(page);
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { completed: ["overlay.name", "overlay.source"], minimized: true });
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toHaveText(/50%/);
});
When("Back is used from the styling workspace", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await page.getByRole("button", { name: "Customize Overlay Style", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Overlay Style", exact: true })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Text Color", exact: true })).toBeVisible();
	await progress(page, tourWorld);
	await start(page, "Customize your look", "Make your overlay yours");
	await expect(page.locator(".driver-popover-title")).toHaveText("Make it yours");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Return to overlay settings");
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "Back to Overlay Settings", exact: true }).click();
});
Then("normal app navigation returns to the first styling step", async ({ page, tourWorld }) => {
	await expect(page).toHaveURL(`${tourWorld.origin}/dashboard/overlay/${tourWorld.owner!.overlayId}`);
	await expect(page.locator(".driver-popover-title")).toHaveText("Open Theme Studio");
	await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

When("clips are selected across pages through the guided picker", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await tourWorld.fixture.pool.query('DELETE FROM "twitchCache" WHERE type=$1', ["clip"]);
	await tourWorld.fixture.pool.query("DELETE FROM playlist_clips WHERE playlist_id=$1", [tourWorld.owner!.playlistId]);
	for (let index = 0; index < 52; index++) {
		const id = `Paged${String(index).padStart(3, "0")}`;
		const clip = { id, title: id, broadcaster_id: tourWorld.owner!.creatorId, creator_id: "maker", creator_name: "Guide maker", view_count: 10, duration: 10, created_at: new Date(Date.now() - index * 1000).toISOString(), thumbnail_url: "https://example.invalid/clip.png", game_id: "", url: `https://clips.twitch.tv/${id}` };
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value,expires_at) VALUES ($1,$2,$3,$4)', ["clip", `clip:${tourWorld.owner!.creatorId}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() }), new Date(Date.now() + 3600000)]);
	}
	await seedProgress(tourWorld, { playlistId: tourWorld.owner!.playlistId, completed: ["playlist.name"] });
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toBeVisible();
	await start(page, "Add and arrange clips", "Build a playlist");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Find your clips");
	await page.getByPlaceholder("Search by title or creator...").fill("Paged");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select clips");
	const modal = page.locator('[data-slot="modal-dialog"]').filter({ has: page.getByRole("heading", { name: "Select clips to add", exact: true }) });
	await expect(modal.getByText("Paged000", { exact: true })).toBeVisible();
	await modal
		.locator("label")
		.filter({ has: page.getByRole("checkbox", { name: "Select all clips", exact: true }) })
		.click();
	await modal.getByRole("button", { name: "Next", exact: true }).click();
	await expect(modal.getByText("Paged051", { exact: true })).toBeVisible();
	await modal
		.locator("label")
		.filter({ has: page.getByRole("checkbox", { name: "Select all clips", exact: true }) })
		.click();
	await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
	await page.screenshot({ path: "/tmp/clipify-guided-clip-picker.png", animations: "disabled" });
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Add selected clips");
	await expect(page.locator('[data-tour="playlist-clip-confirm"]')).toHaveClass(/driver-active-element/);
	await page.getByRole("button", { name: "Add selected clips", exact: true }).click();
});
Then("adding advances automatically to arrangement and saving keeps all selected clips", async ({ page, tourWorld }) => {
	await expect(page.locator(".driver-popover-title")).toHaveText("Arrange your clips");
	expect((await progress(page, tourWorld)).completed).not.toContain("playlist.clips");
	await expect(page.getByRole("list", { name: "Playlist clips" }).locator("li")).toHaveCount(52);
	await page.locator('[data-tour-action="next"]').click();
	await page.getByRole("button", { name: "Save Playlist", exact: true }).click();
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toContain("playlist.clips");
	expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM playlist_clips WHERE playlist_id=$1", [tourWorld.owner!.playlistId])).rows[0].count)).toBe(52);
});
When("the guided picker is cancelled during selection", async ({ page, tourWorld }) => {
	await progress(page, tourWorld);
	await seedProgress(tourWorld, { playlistId: tourWorld.owner!.playlistId });
	await page.goto(`${tourWorld.origin}/dashboard/playlist/${tourWorld.owner!.playlistId}`);
	await expect(page.getByPlaceholder("Playlist name")).toBeVisible();
	await start(page, "Add and arrange clips", "Build a playlist");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Find your clips");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Return to Add Clips");
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Choose your clips");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Find your clips");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select clips");
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect.poll(async () => (await progress(page, tourWorld)).active?.paused).toBe(true);
});
Then("resuming reopens the picker through Add Clips and continues from selection", async ({ page, tourWorld }) => {
	await resumeTask(page, tourWorld);
	await expect(page.locator(".driver-popover-title")).toHaveText("Open the clip picker");
	await page.getByRole("button", { name: "Add Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select clips");
	expect((await progress(page, tourWorld)).active).toMatchObject({ task: "playlist.clips", index: 2, paused: false });
});

When("playlist source guidance changes to Playlist and back to another type", async ({ page, tourWorld }) => {
	await overlay(page, tourWorld);
	await start(page, "Use your playlist in an overlay", "Build a playlist");
	await expect(page.locator(".driver-popover-title")).toHaveText("Use a playlist");
	await expect(page.locator('[data-tour-action="next"]')).toBeDisabled();
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "Playlist", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select your playlist");
	await page.getByRole("button", { name: "Back", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Use a playlist");
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "All Clips", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Use a playlist");
	await expect(page.locator('[data-tour-action="next"]')).toBeDisabled();
	expect((await progress(page, tourWorld)).active).toMatchObject({ task: "playlist.use", index: 0, paused: false });
});
Then("it stays in the flow and advances again when Playlist is selected", async ({ page, tourWorld }) => {
	await page.getByRole("button", { name: /Overlay Type/ }).click();
	await page.getByRole("option", { name: "Playlist", exact: true }).click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Select your playlist");
	await page.locator('[data-tour-action="next"]').click();
	await expect(page.locator(".driver-popover-title")).toHaveText("Save the overlay");
	await page.getByRole("button", { name: "Save Overlay Settings", exact: true }).click();
	await expect.poll(async () => (await progress(page, tourWorld)).completed).toContain("playlist.use");
	expect((await progress(page, tourWorld)).active).toBeNull();
});
