import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";
import { openEventSection } from "../support/event-editor-navigation";

for (const provider of ["drive", "youtube"] as const)
	test(`Starting ${provider} authorization does not crash the event editor`, async ({ page, request, tourWorld }) => {
		await seedCreatorLibrary({ page, request, tourWorld });
		await page.goto(`${tourWorld.origin}/dashboard/events`);
		await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
		await page.getByRole("button", { name: "Create event", exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard\/events\/[0-9a-f-]{36}$/);
		const eventId = new URL(page.url()).pathname.split("/").at(-1)!;
		await page.getByRole("textbox", { name: "Event title", exact: true }).fill("Connection test draft");
		if (provider === "youtube") {
			await openEventSection(page, "Categories");
			await page.getByRole("button", { name: "Edit Best clip", exact: true }).click();
			await page.getByRole("button", { name: "Submission type" }).click();
			await page.getByRole("option", { name: "YouTube video", exact: true }).click();
			await page.getByRole("button", { name: "Apply category", exact: true }).click();
		}
		await openEventSection(page, "Connections");
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.exposeFunction("recordConnectionErrorScreen", () => errors.push("Clipify error screen appeared"));
		await page.evaluate(() => {
			new MutationObserver(() => {
				if (document.body.textContent?.includes("We could not load the app")) (window as unknown as { recordConnectionErrorScreen: () => void }).recordConnectionErrorScreen();
			}).observe(document.body, { childList: true, subtree: true });
		});
		await page.route("https://accounts.google.com/**", async (route) => {
			await route.fulfill({ contentType: "text/html", body: "<h1>Isolated Google consent</h1>" });
		});
		const connect = page.getByRole("button", { name: provider === "drive" ? "Connect Google Drive" : "Connect YouTube", exact: true });
		await page.route("**/api/auth/link-social", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Isolated unavailable provider" }) }));
		await connect.click();
		await expect(page.getByText("Google could not be connected. Please try again.", { exact: true })).toBeVisible();
		await expect(connect).toBeEnabled();
		expect((await tourWorld.fixture.pool.query("SELECT configuration->>'title' AS title FROM award_events WHERE id=$1", [eventId])).rows[0].title).toBe("Connection test draft");
		expect(errors).toEqual([]);
		await expect(page.getByText("Event saved.", { exact: true })).toHaveCount(0);
		await page.unroute("**/api/auth/link-social");
		const linkRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/auth/link-social");
		await connect.click();
		const link = await linkRequest;
		expect(link.postDataJSON()).toMatchObject({ provider: provider === "drive" ? "google-drive" : "google-events-youtube", scopes: [provider === "drive" ? "https://www.googleapis.com/auth/drive.file" : "https://www.googleapis.com/auth/youtube.readonly"] });
		await expect(page.getByRole("heading", { name: "Isolated Google consent", exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	});
