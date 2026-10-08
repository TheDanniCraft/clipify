import { createBdd } from "playwright-bdd";
import { expect, type APIResponse } from "@playwright/test";
const { When, Then } = createBdd();
let result: APIResponse;
When("an unsigned app supplies a forged OAuth consent signature", async ({ request }) => {
	const query = new URLSearchParams({ client_id: "untrusted-client", scope: "creator:read", sig: "forged", exp: "1", redirect_uri: "https://client.example.invalid/callback" });
	result = await request.get(`/auth/mcp/consent?${query}`, { maxRedirects: 0 });
});
Then("Clipify shows an invalid authorization request before login or consent", async () => {
	expect(result.status()).toBe(200);
	expect(await result.text()).toContain('role="alert"');
	expect(await result.text()).toContain("Invalid authorization request");
	expect(result.headers().location).toBeUndefined();
});
