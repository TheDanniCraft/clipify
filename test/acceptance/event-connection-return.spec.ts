import { test, expect } from "../bdd/support/user-tour";
import { seedCreatorLibrary } from "../support/creator-library";

test("Event Google completion returns to the public editor origin behind a reverse proxy", async ({ page, request, tourWorld }) => {
	await seedCreatorLibrary({ page, request, tourWorld });
	const response = await page.request.get(`${tourWorld.origin}/dashboard/events/connect/youtube/complete?intent=expired`, { headers: { Host: "0.0.0.0:3000" }, maxRedirects: 0 });
	expect(response.status()).toBe(307);
	const destination = response.headers().location;
	expect(destination).toBe(`${tourWorld.origin}/dashboard/events?section=connections&provider=youtube&connection=retry`);
	await page.goto(destination);
	await expect(page.getByRole("heading", { name: "Events", exact: true }).first()).toBeVisible();
});
