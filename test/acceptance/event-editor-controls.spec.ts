import { openEventSection } from "../support/event-editor-navigation";
import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { guideContentKey } from "../../src/app/lib/userTour";

for (const width of [390, 1440])
	for (const theme of ["light", "dark"])
		test(`Event visible switch controls at ${width}px in ${theme}`, async ({ page, request, tourWorld }, info) => {
			await page.setViewportSize({ width, height: 950 });
			await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
			const { creatorId } = await seedCreatorLibrary({ page, request, tourWorld });
			await tourWorld.fixture.pool.query("UPDATE user_content_states SET state=jsonb_set(state::jsonb,'{minimized}','true')::text WHERE user_id=$1 AND content_key=$2", [creatorId, guideContentKey]);
			await tourWorld.fixture.pool.query(`UPDATE "twitchCache" SET value=jsonb_set(value::jsonb,'{clip,created_at}','"2023-06-01T12:00:00Z"')::text WHERE type='clip' AND key LIKE $1`, [`clip:${creatorId}:%`]);
			await page.goto(`${tourWorld.origin}/dashboard/events`);
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await page.getByRole("button", { name: "Use Babbler example", exact: true }).click();
			await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
			const eventId = new URL(page.url()).pathname.split("/").at(-1)!;
			await expect(page.getByRole("button", { name: "Save event", exact: true })).toBeEnabled();
			const branding = page.locator('[data-slot="switch"]').filter({ hasText: "Hide Clipify branding" });
			await branding.locator('[data-slot="switch-control"]').click();
			await expect(branding.getByRole("switch")).toBeChecked();
			await openEventSection(page, "Roadmap");
			const review = page.locator('[data-slot="switch"]').filter({ hasText: "Review nominations before voting" });
			await review.locator('[data-slot="switch-control"]').click();
			await expect(review.getByRole("switch")).not.toBeChecked();
			await openEventSection(page, "Categories");
			await page.getByRole("button", { name: "Add category", exact: true }).click();
			await page.getByRole("textbox", { name: "Category title", exact: true }).fill("Community surprise");
			const unlimited = page.locator('[data-slot="switch"]').filter({ hasText: "Unlimited submissions" });
			await unlimited.locator('[data-slot="switch-control"]').click();
			await expect(unlimited.getByRole("switch")).toBeChecked();
			await page.getByRole("button", { name: "Apply category", exact: true }).click();
			await page.getByRole("button", { name: "Save event", exact: true }).click();
			await expect(page.getByText("Event saved.", { exact: true })).toBeVisible();
			const stored = (await tourWorld.fixture.pool.query("SELECT configuration FROM award_events WHERE id=$1", [eventId])).rows[0].configuration;
			expect(stored.categories).toHaveLength(20);
			expect(stored.categories.filter((category: { source: string }) => category.source === "clip").every((category: { rules: { startedAt?: string; endedAt?: string } }) => !category.rules.startedAt && !category.rules.endedAt)).toBe(true);
			expect(Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM award_candidates WHERE event_id=$1 AND content->>'createdAt'='2023-06-01T12:00:00Z'", [eventId])).rows[0].count)).toBeGreaterThan(0);
			expect(stored.whiteLabel).toBe(true);
			expect(stored.schedule.reviewRequired).toBe(false);
			expect(stored.categories.find((category: { title: string }) => category.title === "Community surprise").submissionLimit).toBeNull();
			if (width > 768) {
				await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
				const roadmap = page.locator('[data-slot="sidebar"]').getByRole("row", { name: "Roadmap", exact: true });
				await roadmap.focus();
				await page.keyboard.press("Enter");
				await expect(page.getByRole("tabpanel", { name: "Roadmap", exact: true })).toBeVisible();
				await page.getByRole("button", { name: "Toggle navigation", exact: true }).click();
			}
			await openEventSection(page, "Connections");
			await page.route("https://accounts.google.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Isolated Google consent preview</h1>" }));
			for (const provider of ["drive", "youtube"] as const) {
				const authorization = page.waitForRequest((request) => request.url().startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
				await page.getByRole("button", { name: provider === "drive" ? "Connect Google Drive" : "Connect YouTube", exact: true }).click();
				const google = new URL((await authorization).url()),
					scopes = google.searchParams.get("scope")!.split(" ");
				expect(scopes).toContain(provider === "drive" ? "https://www.googleapis.com/auth/drive.file" : "https://www.googleapis.com/auth/youtube.readonly");
				expect(scopes).not.toContain(provider === "drive" ? "https://www.googleapis.com/auth/youtube.readonly" : "https://www.googleapis.com/auth/drive.file");
				expect(google.searchParams.get("include_granted_scopes")).toBe("false");
				await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}?section=connections&connection=retry`);
				await expect(page.getByText("Google was not connected.", { exact: true })).toBeVisible();
			}
			await openEventSection(page, "Chat");
			const chat = page.locator('[data-slot="switch"]').filter({ hasText: "Show Twitch chat" });
			await chat.locator('[data-slot="switch-control"]').click();
			await expect(chat.getByRole("switch")).toBeChecked();
			await page.screenshot({ path: info.outputPath("chat-settings.png"), fullPage: true, animations: "disabled" });
			await page.getByRole("button", { name: "Save event", exact: true }).click();
			await expect(page.getByText("Event saved.", { exact: true })).toBeVisible();
			await openEventSection(page, "Presentation");
			await expect(page.getByRole("link", { name: "Open preview", exact: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath("presentation-editor.png"), fullPage: true, animations: "disabled" });
			const previewUrl = new URL((await page.getByRole("link", { name: "Open preview", exact: true }).getAttribute("href"))!, tourWorld.origin).toString();
			const anonymous = await page
				.context()
				.browser()!
				.newContext({ viewport: { width, height: 950 } });
			try {
				const viewer = await anonymous.newPage();
				await viewer.goto(previewUrl);
				await expect(viewer.getByRole("heading", { name: "Babbler Awards", exact: true })).toBeVisible();
				await expect(viewer.getByText(/Read-only event preview/)).toBeVisible();
				const nomineeCount = Number((await tourWorld.fixture.pool.query("SELECT count(*) FROM award_candidates WHERE event_id=$1", [eventId])).rows[0].count);
				const next = viewer.getByRole("button", { name: "Next slide", exact: true });
				const maxSteps = nomineeCount + 5 * stored.categories.length + 10;
				for (let i = 0; i < maxSteps && (await next.isEnabled()); i++) await viewer.keyboard.press("ArrowRight");
				await expect(viewer.getByRole("heading", { name: "End of preview", exact: true })).toBeVisible();
				await expect(viewer.getByRole("button", { name: "Publish results", exact: true })).toHaveCount(0);
				await viewer.screenshot({ path: info.outputPath("shared-preview.png"), fullPage: true, animations: "disabled" });
			} finally {
				await anonymous.close();
			}
			const state = (await tourWorld.fixture.pool.query("SELECT published_at,results_published_at FROM award_events WHERE id=$1", [eventId])).rows[0];
			expect(state).toEqual({ published_at: null, results_published_at: null });
			if (width === 1440 && theme === "light") {
				await tourWorld.fixture.pool.query("UPDATE users SET plan='free',created_at='2020-01-01' WHERE id=$1", [creatorId]);
				await page.goto(`${tourWorld.origin}/dashboard/events/${eventId}`);
				const lockedBranding = page.locator('[data-slot="switch"]').filter({ hasText: "Hide Clipify branding" });
				await lockedBranding.locator('[data-slot="switch-control"]').click();
				await expect(lockedBranding.getByRole("switch")).not.toBeChecked();
				await lockedBranding.locator('[data-slot="switch-control"]').click();
				await expect(page.getByRole("dialog").filter({ hasText: "Make your award show your own" })).toBeVisible();
				await expect(lockedBranding.getByRole("switch")).not.toBeChecked();
			}
		});
