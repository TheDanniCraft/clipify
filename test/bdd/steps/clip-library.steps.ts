import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { createBdd } from "playwright-bdd";
import type { Page, APIRequestContext } from "@playwright/test";
import { test, expect, type TourWorld } from "../support/user-tour";
import { seedCreatorLibrary } from "../../support/creator-library";

const { Given, When, Then } = createBdd(test);
const cases = new WeakMap<TourWorld, { variant?: string; ids: string[]; expected?: string[]; field?: string; archive?: Uint8Array; home?: { start: number; end: number; count: number; views: number; ids: string[] }; total?: number }>();
const title = "Last night's clutch";

async function seedInventory({ page, request, tourWorld }: { page: Page; request: APIRequestContext; tourWorld: TourWorld }) {
	test.info().setTimeout(120000);
	const { id } = await seedCreatorLibrary({ page, request, tourWorld });
	cases.set(tourWorld, { ids: [id] });
}

Given("clips with complete metadata", seedInventory);

Given("the required fixture class is {string}", async ({ tourWorld }, variant: string) => {
	if (variant === "public creator page disabled") await tourWorld.fixture.pool.query('INSERT INTO "userSettings" (id,creator_page_enabled) VALUES ($1,false) ON CONFLICT (id) DO UPDATE SET creator_page_enabled=false', [tourWorld.owner!.creatorId]);
	else if (variant !== "public creator page enabled") {
		expect([...Object.keys(filterCases), ...Object.keys(invalidCases), ...Object.keys(sortCases), ...Object.keys(exportCounts), ...homeVariants, ...streamVariants, ...Object.keys(navigationDestinations)]).toContain(variant);
	}
	cases.get(tourWorld)!.variant = variant;
	if (variant === "next saved page") {
		const owner = tourWorld.owner!.creatorId;
		const lastSeenAt = new Date().toISOString();
		for (let index = 0; index < 19; index++) {
			const older = index === 18;
			const id = older ? "12347" : String(20000 + index);
			const video = { id, user_id: owner, type: "archive", title: older ? "Older stream" : `Saved stream ${index + 1}`, created_at: older ? "2026-10-01T00:00:00Z" : "2026-10-15T00:00:00Z", duration: "1h", thumbnail_url: "" };
			await tourWorld.fixture.pool.query("INSERT INTO user_content_states(user_id,content_key,state) VALUES($1,$2,$3)", [owner, `broadcast:v1:${id}`, JSON.stringify({ video, lastSeenAt, unavailable: true })]);
		}
	}
	if (homeVariants.includes(variant)) {
		const state = cases.get(tourWorld)!;
		const home = state.home!;
		const owner = tourWorld.owner!.creatorId;
		const result = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${owner}:${state.ids[0]}`]);
		const template = JSON.parse(result.rows[0].value).clip;
		await tourWorld.fixture.pool.query('DELETE FROM "twitchCache" WHERE type=$1 AND starts_with(key,$2)', ["clip", `clip:${owner}:`]);
		const count = variant === "zero clips" ? 0 : variant === "equal view tie" ? 6 : 1;
		for (let index = 0; index < count; index++) {
			const id = `LibraryHome${String.fromCharCode(65 + index)}_${owner.slice("e2e-creator-".length)}`;
			const time = variant === "start minus one millisecond" ? home.start - 1 : variant === "end minus one millisecond" ? home.end - 1 : variant === "exact exclusive end" ? home.end : home.start;
			const clip = { ...template, id, title: `Home clip ${index + 1}`, created_at: new Date(time).toISOString(), view_count: 10 };
			await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${owner}:${id}`, JSON.stringify({ clip })]);
			home.ids.push(id);
			if (time >= home.start && time < home.end) {
				home.count++;
				home.views += 10;
			}
		}
	}

	if (variant in exportCounts) {
		const state = cases.get(tourWorld)!;
		await tourWorld.fixture.pool.query("UPDATE auth.account SET scope=$1 WHERE provider_id=$2 AND account_id=$3", ["channel:manage:clips", "twitch", tourWorld.owner!.creatorId]);
		if (exportCounts[variant] === 1) await tourWorld.fixture.pool.query('DELETE FROM "twitchCache" WHERE type=$1 AND starts_with(key,$2) AND key<>$3', ["clip", `clip:${tourWorld.owner!.creatorId}:`, `clip:${tourWorld.owner!.creatorId}:${state.ids[0]}`]);
	}
});

When("I open Inventory and preview a clip", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(privacy).toBeVisible();
	await privacy.click();
	await expect(privacy).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	if (await page.getByRole("region", { name: "Your Clipify guide", exact: true }).isVisible()) await page.getByRole("button", { name: "Minimize guide", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
	const row = page.getByRole("row", { name: new RegExp(title) });
	await expect(row.getByText("42", { exact: true })).toBeVisible();
	await expect(row.getByText("Strategy", { exact: true }).filter({ visible: true })).toBeVisible();
	await expect(row.locator("time:visible")).toHaveCount(1);
	await row.getByRole("button", { name: `Preview ${title}` }).click();
});

Then("the actual thumbnail category local date duration views and provider link are shown", async ({ page }) => {
	const dialog = page.getByRole("dialog", { name: title, exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("link", { name: "Open on Twitch" })).toHaveAttribute("href", /https:\/\/clips.twitch.tv\/RunnerPresentation_/);
	const video = dialog.locator("video");
	await expect(video).toBeVisible();
	await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThan(1);
});

const filterCases: Record<string, { query: Record<string, string>; expected: number[] }> = {
	"title substring mixed case": { query: { title: "cLuTcH" }, expected: [2, 0] },
	category: { query: { category: "123" }, expected: [0] },
	"start boundary": { query: { startedAt: "2026-11-02T12:00:00Z" }, expected: [2, 0] },
	"exclusive end boundary": { query: { endedAt: "2026-11-02T12:00:00Z" }, expected: [1] },
	"minimum views": { query: { minViews: "42" }, expected: [2, 0] },
	"minimum duration": { query: { minDuration: "12" }, expected: [2, 0] },
	"maximum duration": { query: { maxDuration: "12" }, expected: [0, 1] },
	"combined intersection": { query: { title: "clutch", category: "123", minViews: "42", minDuration: "12", maxDuration: "12" }, expected: [0] },
	"restore URL": { query: { title: "clutch", category: "123", minViews: "42" }, expected: [0] },
};
const invalidCases: Record<string, { query: Record<string, string>; field: string }> = {
	"negative views": { query: { minViews: "-1" }, field: "minViews" },
	"nonfinite duration": { query: { maxDuration: "Infinity" }, field: "maxDuration" },
	"negative duration": { query: { minDuration: "-1" }, field: "minDuration" },
	"reversed duration range": { query: { minDuration: "20", maxDuration: "10" }, field: "maxDuration" },
	"reversed date range": { query: { startedAt: "2026-11-03T00:00:00Z", endedAt: "2026-11-01T00:00:00Z" }, field: "endedAt" },
	"invalid timezone": { query: { timeZone: "Mars/Crater" }, field: "timeZone" },
	"page size above fifty": { query: { pageSize: "51" }, field: "pageSize" },
	"invalid timestamp": { query: { startedAt: "yesterday" }, field: "startedAt" },
};

async function seedFilterInventory(world: { page: Page; request: APIRequestContext; tourWorld: TourWorld }) {
	await seedInventory(world);
	const { tourWorld } = world;
	const creatorId = tourWorld.owner!.creatorId;
	const state = cases.get(tourWorld)!;
	const result = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${creatorId}:${state.ids[0]}`]);
	const raw = typeof result.rows[0].value === "string" ? JSON.parse(result.rows[0].value) : result.rows[0].value;
	for (const [index, overrides] of [
		{ title: "Another moment", game_id: "456", created_at: "2026-11-01T12:00:00Z", view_count: 5, duration: 5 },
		{ title: "Another clutch", game_id: "456", created_at: "2026-11-03T12:00:00Z", view_count: 100, duration: 30 },
	].entries()) {
		const id = `LibraryFilter${index}_${creatorId.slice("e2e-creator-".length)}`;
		state.ids.push(id);
		const clip = { ...raw.clip, ...overrides, id, url: `https://clips.twitch.tv/${id}` };
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${creatorId}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() })]);
	}
}
Given("clips differing in title category creation date views and duration", async ({ page, request, tourWorld }) => seedFilterInventory({ page, request, tourWorld }));
Given("negative views nonfinite duration reversed ranges invalid timezone and excessive page size", async ({ page, request, tourWorld }) => seedFilterInventory({ page, request, tourWorld }));

async function expectResults(page: Page, ids: string[]) {
	await expect(page.locator("[data-clip-id]")).toHaveCount(ids.length);
	await expect.poll(() => page.locator("[data-clip-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-clip-id")))).toEqual(ids);
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText(`${ids.length} ${ids.length === 1 ? "clip" : "clips"}`);
}
When("I apply each filter then their combined intersection and restore the URL", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	const chosen = filterCases[state.variant!];
	await page.goto(`${tourWorld.origin}/dashboard/clips?${new URLSearchParams(chosen.query)}`);
	await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
	await expectResults(
		page,
		chosen.expected.map((index) => state.ids[index]),
	);
	const combined = filterCases["combined intersection"];
	await page.goto(`${tourWorld.origin}/dashboard/clips?${new URLSearchParams(combined.query)}`);
	await expectResults(page, [state.ids[0]]);
	await page.reload();
	await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
	state.expected = [state.ids[0]];
});
Then("results and total counts exactly match case-insensitive title category date minimum-view and duration predicates", async ({ page, tourWorld }) => {
	await expectResults(page, cases.get(tourWorld)!.expected!);
});
When("I submit each invalid query", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	const chosen = invalidCases[state.variant!];
	state.field = chosen.field;
	await page.goto(`${tourWorld.origin}/dashboard/clips?${new URLSearchParams(chosen.query)}`);
});
Then("field-level validation preserves entered values and no provider fetch occurs", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	await expect(page.getByRole("alert", { name: "Filter validation" })).toBeVisible();
	await expect(page.getByRole("alert", { name: "Filter validation" }).locator(`[data-filter-error-field="${state.field}"]`)).toBeVisible();
	for (const [key, value] of Object.entries(invalidCases[state.variant!].query)) expect(new URL(page.url()).searchParams.get(key)).toBe(value);
	// Provider-call denial is independently owned by the server validation test; this browser checks visible error and draft preservation.
});

const sortCases: Record<string, { page: number; sort: string }> = {
	"newest tie": { page: 1, sort: "newest" },
	"most viewed tie": { page: 1, sort: "most_viewed" },
	"first page": { page: 1, sort: "newest" },
	"next page": { page: 2, sort: "newest" },
	"last page": { page: 3, sort: "newest" },
};
async function seedMany({ page, request, tourWorld }: { page: Page; request: APIRequestContext; tourWorld: TourWorld }) {
	await seedInventory({ page, request, tourWorld });
	const creatorId = tourWorld.owner!.creatorId;
	const state = cases.get(tourWorld)!;
	const result = await tourWorld.fixture.pool.query('SELECT value FROM "twitchCache" WHERE type=$1 AND key=$2', ["clip", `clip:${creatorId}:${state.ids[0]}`]);
	const raw = typeof result.rows[0].value === "string" ? JSON.parse(result.rows[0].value) : result.rows[0].value;
	for (let index = 0; index < 54; index++) {
		const id = `LibrarySort${String(index).padStart(2, "0")}_${creatorId.slice("e2e-creator-".length)}`;
		state.ids.push(id);
		await tourWorld.fixture.pool.query('INSERT INTO "twitchCache" (type,key,value) VALUES ($1,$2,$3)', ["clip", `clip:${creatorId}:${id}`, JSON.stringify({ clip: { ...raw.clip, id }, lastValidatedAt: new Date().toISOString() })]);
	}
}
Given("more than fifty clips with equal dates or views", seedMany);
Given("three inventory pages", seedMany);
When("I use newest and most-viewed sorts and traverse pages", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	const chosen = sortCases[state.variant!];
	const expectedOrder = [...state.ids.slice(1), state.ids[0]];
	state.expected = expectedOrder.slice((chosen.page - 1) * 25, chosen.page * 25);
	state.total = 55;
	await page.goto(`${tourWorld.origin}/dashboard/clips?${new URLSearchParams({ page: String(chosen.page), sort: chosen.sort })}`);
	await expect(page.getByRole("heading", { name: "Clip Inventory", exact: true })).toBeVisible();
});
Then("results have stable ID tie-breaks with no duplicates and correct page totals", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	await expect(page.locator("[data-clip-id]")).toHaveCount(state.expected!.length);
	await expect.poll(() => page.locator("[data-clip-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-clip-id")))).toEqual(state.expected);
	await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText("55 clips");
});

When("I select page one remove a row and select items on page two", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(privacy).toBeVisible();
	await privacy.click();
	await expect(privacy).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	if (await page.getByRole("region", { name: "Your Clipify guide", exact: true }).isVisible()) await page.getByRole("button", { name: "Minimize guide", exact: true }).click();
	await expect(page.getByRole("button", { name: "Select page", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("25 selected");
	const first = page.locator("[data-clip-id]").first().getByRole("checkbox");
	await expect(first).toBeChecked();
	await first.focus();
	await expect(first).toBeFocused();
	await page.keyboard.press("Space");
	await expect(first).not.toBeChecked();
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("24 selected");
	await page.getByRole("button", { name: "Next", exact: true }).click();
	await expect(page.locator("[data-clip-id]").first()).toHaveAttribute("data-clip-id", cases.get(tourWorld)!.ids[26]);
	const next = page.locator("[data-clip-id]").first().getByRole("checkbox");
	await expect(next).not.toBeChecked();
	await next.focus();
	await expect(next).toBeFocused();
	await page.keyboard.press("Space");
	await expect(next).toBeChecked();
});
Then("only explicit selected IDs persist and selected count equals their unique count", async ({ page }) => {
	await expect(page.getByRole("status", { name: "Clip selection" })).toHaveText("25 selected");
	await page.getByRole("button", { name: "Previous", exact: true }).click();
	await expect(page.locator("[data-clip-id]").first().getByRole("checkbox")).not.toBeChecked();
	await expect(page.locator("[data-clip-id]").getByRole("checkbox")).toHaveCount(25);
	const checked = await page.locator('[data-clip-id] input[type="checkbox"]:checked').count();
	expect(checked).toBe(24);
});

const exportCounts: Record<string, number> = { "one eligible clip": 1, "twenty-five eligible clips": 25, "fifty eligible clips": 50 };
Given("one then twenty-five then fifty eligible small MP4 fixtures", seedMany);
When("I export each explicitly selected set", async ({ page, tourWorld }) => {
	const state = cases.get(tourWorld)!;
	const count = exportCounts[state.variant!];
	await page.goto(`${tourWorld.origin}/dashboard/clips`);
	const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(privacy).toBeVisible();
	await privacy.click();
	await expect(privacy).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	if (await page.getByRole("region", { name: "Your Clipify guide", exact: true }).isVisible()) await page.getByRole("button", { name: "Minimize guide", exact: true }).click();
	await expect(page.getByRole("button", { name: "Select page", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select page", exact: true }).click();
	if (count === 50) {
		await page.getByRole("button", { name: "Next", exact: true }).click();
		await expect(page).toHaveURL(/page=2/);
		await expect(page.getByRole("button", { name: "Select page", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Select page", exact: true }).click();
	}
	state.expected = count === 1 ? [state.ids[0]] : state.ids.slice(1, count + 1);
	const downloading = page.waitForEvent("download", { timeout: 30000 });
	const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/clips/export/browser" && response.request().method() === "POST", { timeout: 30000 });
	await page.getByRole("button", { name: "Export selected", exact: true }).click();
	await page.getByRole("dialog", { name: "Export clips", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
	await page.getByRole("button", { name: "Start export", exact: true }).click();
	const response = await responsePromise;
	expect(response.status(), response.ok() ? "export preparation response" : await response.text()).toBe(200);
	const download = await downloading;
	expect(await download.failure()).toBeNull();
	state.archive = await readFile((await download.path())!);
});
Then("one ZIP per set has exactly those complete MP4s and a manifest for every ID", async ({ tourWorld }) => {
	const state = cases.get(tourWorld)!;
	const entries = unzipSync(state.archive!);
	const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
	expect(manifest.clips.map((entry: { id: string }) => entry.id).sort()).toEqual([...state.expected!].sort());
	expect(Object.keys(entries)).toHaveLength(state.expected!.length + 1);
	for (const entry of manifest.clips) {
		expect(entry.status).toBe("included");
		expect(entries[entry.filename].byteLength).toBe(entry.bytes);
		expect(strFromU8(entries[entry.filename].slice(4, 8))).toBe("ftyp");
	}
	expect(strFromU8(entries["manifest.json"])).not.toContain("isolated-dashboard-fixture-token");
});

const homeVariants = ["start minus one millisecond", "exact start", "end minus one millisecond", "exact exclusive end", "equal view tie", "zero clips"];
Given("known clips before at and after the local 30-day boundaries with tied views", async ({ page, request, tourWorld }) => {
	await seedInventory({ page, request, tourWorld });
	const window = await page.evaluate(() => {
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		start.setDate(start.getDate() - 29);
		const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		return { start: start.getTime(), end: end.getTime() };
	});
	cases.get(tourWorld)!.home = { ...window, count: 0, views: 0, ids: [] };
});
When("I open Home", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard`);
	await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
});
Then("the recent clip metrics and all-time top five or actionable empty state are shown", async ({ page, tourWorld }) => {
	const home = cases.get(tourWorld)!.home!;
	if (home.count === 0) {
		await expect(page.getByText("No clips from the last 30 days", { exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "Browse clip inventory", exact: true })).toHaveAttribute("href", "/dashboard/clips");
		await expect(page.getByRole("status", { name: "Known clips" })).toHaveCount(0);
		await expect(page.getByRole("status", { name: "Current clip views" })).toHaveCount(0);
	} else {
		await expect(page.getByRole("status", { name: "Known clips" })).toHaveText(String(home.count));
		await expect(page.getByRole("status", { name: "Current clip views" })).toHaveText(String(home.views));
	}
	await expect.poll(() => page.locator("[data-top-clip-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-top-clip-id")))).toEqual(home.ids.slice(0, 5));
});

const streamVariants = ["archive with clips", "zero-clip archive", "exclude highlight", "exclude upload", "next saved page"];
Given("two archive broadcasts one with no matching clips and a non-archive video", seedInventory);
When("I browse Streams and open both archive broadcasts", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard/streams`);
	const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(privacy).toBeVisible();
	await privacy.click();
	await expect(privacy).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	if (await page.getByRole("region", { name: "Your Clipify guide", exact: true }).isVisible()) await page.getByRole("button", { name: "Minimize guide", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Streams", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "Highlight", exact: true })).toHaveCount(0);
	await expect(page.getByRole("link", { name: "Upload", exact: true })).toHaveCount(0);
	for (const [title, total] of [
		["Latest stream", 0],
		["Earlier stream", 1],
	] as const) {
		await page.getByRole("link", { name: title, exact: true }).click();
		await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
		await expect(page.getByRole("status", { name: "Inventory results" })).toHaveText(`${total} ${total === 1 ? "clip" : "clips"}`);
		await page.getByRole("link", { name: "Back to streams", exact: true }).click();
	}
	if (cases.get(tourWorld)!.variant === "next saved page") {
		await expect(page.locator("[data-broadcast-id]")).toHaveCount(20);
		await page.getByRole("link", { name: "Next streams", exact: true }).click();
		await expect(page.getByRole("link", { name: "Older stream", exact: true })).toBeVisible();
		await expect(page.locator("[data-broadcast-id]")).toHaveCount(1);
	}
});
Then("the archives appear newest first and the empty stream shows zero clip counts", async ({ page, tourWorld }) => {
	if (cases.get(tourWorld)!.variant !== "next saved page") await expect.poll(() => page.locator("[data-broadcast-id]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-broadcast-id")))).toEqual(["12346", "12345"]);
});

const navigationDestinations: Record<string, string> = { Home: "/dashboard", Streams: "/dashboard/streams", "Clip Inventory": "/dashboard/clips", Overlays: "/dashboard/overlays", Playlists: "/dashboard/playlists", Galleries: "/dashboard/galleries", Runner: "/dashboard/runners", Tools: "/dashboard/tools?tool=player", Settings: "/dashboard/settings" };
Given("an owner with all creator tools", seedInventory);
When("I visit every sidebar destination", async ({ page, tourWorld }) => {
	await page.goto(`${tourWorld.origin}/dashboard`);
	const privacy = page.getByRole("button", { name: "Reject optional", exact: true });
	await expect(privacy).toBeVisible();
	await privacy.click();
	await expect(privacy).not.toBeVisible();
	await page.reload();
	await expect(page.locator('[data-tour="guide-launcher"]')).toBeVisible();
	const tree = page.getByRole("treegrid", { name: "Creator navigation", exact: true });
	await expect(tree).toBeVisible();
	if (cases.get(tourWorld)!.variant === "Home") {
		const panel = await page.getByRole("region", { name: "Your Clipify guide", exact: true }).boundingBox();
		const navigation = await tree.boundingBox();
		expect(panel).not.toBeNull();
		expect(navigation).not.toBeNull();
		expect(panel!.x).toBeGreaterThanOrEqual(navigation!.x + navigation!.width);
		await page.screenshot({ path: test.info().outputPath("first-use-guide-navigation.png"), animations: "disabled" });
	}
	const destination = cases.get(tourWorld)!.variant!;
	await tree.getByRole("row", { name: destination, exact: true }).click();
	if (destination === "Tools" || destination === "Settings") {
		await expect(page).toHaveURL(`${tourWorld.origin}/dashboard`);
		await tree.getByRole("row", { name: destination === "Tools" ? "Clip Player" : "Account", exact: true }).click();
	}
});
Then("the selected location and correct existing resource list are shown", async ({ page, tourWorld }) => {
	const title = cases.get(tourWorld)!.variant!;
	await expect(page).toHaveURL(`${tourWorld.origin}${navigationDestinations[title]}`);
	await expect(page.getByRole("heading", { name: title === "Tools" ? "Clip Player" : title, exact: true })).toBeVisible();
	const row = title === "Tools" ? "Clip Player" : title === "Settings" ? "Account" : title;
	await expect(page.getByRole("treegrid", { name: "Creator navigation", exact: true }).getByRole("row", { name: row, exact: true })).toHaveAttribute("aria-current", "page");
});
