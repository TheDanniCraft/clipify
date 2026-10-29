import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { createAuthenticatedFixture } from "../atdd/support/auth-engine-rewrite";
import { registerBrowserClient } from "../support/mcp/browser-registration";

for (const persistent of [true, false]) {
	test(`MCP connection ${persistent ? "accepts" : "declines"} persistent access without client scope configuration`, async ({ page, context, request }, info) => {
		test.setTimeout(120000);
		const owner = await createAuthenticatedFixture(request, context);
		const origin = "http://127.0.0.1:3107";
		try {
			const registration = await registerBrowserClient(request, origin, { client_name: "Persistent access test", application_type: "native", redirect_uris: ["http://127.0.0.1:49999/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] });
			expect(registration.status()).toBe(201);
			const client = await registration.json();
			const verifier = "persistent-browser-verifier-at-least-43-characters-12345";
			const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope: "creator:read", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${origin}/mcp`, state: "persistent-browser-state" });
			await page.route("http://127.0.0.1:49999/callback**", (route) => route.fulfill({ contentType: "text/html", body: "Connected" }));
			await page.goto(`${origin}/api/auth/oauth2/authorize?${query}`);
			await expect(page.getByRole("heading", { name: "Connect Persistent access test", exact: true })).toBeVisible();
			await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reject optional", exact: true }).click()]);
			await expect(page.getByRole("heading", { name: "Connect Persistent access test", exact: true })).toBeVisible();
			await page.getByRole("button", { name: owner.fixture.username, exact: true }).click();
			await page.getByRole("button", { name: "Review", exact: true }).click();
			const offline = page.getByRole("checkbox", { name: "Stay connected between sessions" });
			await expect(offline).toBeChecked();
			await offline.focus();
			await expect(offline).toBeFocused();
			await offline.press("Space");
			await expect(offline).not.toBeChecked();
			if (persistent) {
				await offline.press("Space");
				await expect(offline).toBeChecked();
				for (const theme of ["dark", "light"]) {
					await page.evaluate((value) => {
						document.documentElement.classList.remove("dark", "light");
						document.documentElement.classList.add(value);
						document.documentElement.style.colorScheme = value;
					}, theme);
					for (const width of [1280, 390]) {
						await page.setViewportSize({ width, height: 960 });
						await expect(offline).toBeVisible();
						await page.screenshot({ path: info.outputPath(`persistent-${theme}-${width}.png`), fullPage: true });
					}
				}
			}
			await page.getByRole("button", { name: "Authorize", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Authorization successful", exact: true })).toBeVisible();
			await page.getByRole("link", { name: "Continue to Persistent access test", exact: true }).click();
			await page.waitForURL("http://127.0.0.1:49999/callback**");
			const callback = new URL(page.url());
			expect(callback.searchParams.get("state")).toBe("persistent-browser-state");
			const response = await request.post(`${origin}/api/auth/oauth2/token`, { form: { grant_type: "authorization_code", client_id: client.client_id, redirect_uri: client.redirect_uris[0], code: callback.searchParams.get("code")!, code_verifier: verifier, resource: `${origin}/mcp` } });
			expect(response.status()).toBe(200);
			const tokens = await response.json();
			expect(typeof tokens.refresh_token === "string").toBe(persistent);
		} finally {
			const cleanup = await request.delete("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { authUserId: owner.fixture.authUserId, creatorId: owner.fixture.creatorId, organizationIds: [owner.fixture.creatorOrganizationId, owner.fixture.agencyOrganizationId] } });
			expect(cleanup.status()).toBe(204);
		}
	});
}
