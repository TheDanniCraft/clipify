import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

const { Given, When, Then } = createBdd();

Given("the Clipify application is running", async ({ request }) => {
	const response = await request.get("/login");
	expect(response.ok()).toBe(true);
});

When("I open the public login page", async ({ page }) => {
	await page.goto("/login");
});

Then("I can start Twitch login", async ({ page }) => {
	await expect(page.getByRole("link", { name: "Login with Twitch" })).toBeVisible();
});
