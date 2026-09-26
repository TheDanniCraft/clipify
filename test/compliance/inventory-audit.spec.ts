import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import jwt from "jsonwebtoken";
import { CHATWOOT_BASE_URL, CHATWOOT_WEBSITE_TOKEN } from "../../src/app/lib/consent/chatwoot";
import { consentServices, necessaryConsentServices } from "../../src/app/lib/consent/registry";
import { runComplianceGate, type ExpectedObservationMatrix, type InventoryDeclaration, type InventoryObservation, type InventoryKind } from "./support/inventoryAudit";
import { writeInventoryEvidence } from "./support/evidenceWriter";

const baseURL = "http://127.0.0.1:3107";
const firstPartyOrigin = new URL(baseURL).origin;

const declarations: InventoryDeclaration[] = [...necessaryConsentServices, ...consentServices].map((service) => ({
	serviceId: service.id,
	storageNames: [],
	storagePatterns: [],
	storageDeclarations: "storageDeclarations" in service ? (service.storageDeclarations?.map((entry) => ({ kind: entry.type as InventoryKind, ...("name" in entry && entry.name ? { name: entry.name } : {}), ...("pattern" in entry && entry.pattern ? { pattern: entry.pattern } : {}) })) ?? []) : [],
	origins: [...service.networkOrigins],
	scriptOrigins: service.id === "chatwoot" || service.id === "cloudflare-turnstile" ? [...service.networkOrigins] : [],
}));

// Reviewed platform exceptions remain explicit, but are not optional c15t services.
declarations.push({ serviceId: "clipify-application", storageNames: [], storagePatterns: [], origins: [], scriptOrigins: [firstPartyOrigin] }, { serviceId: "plausible-cookieless", storageNames: [], storagePatterns: [], origins: ["https://analytics.thedannicraft.de"], scriptOrigins: ["https://analytics.thedannicraft.de"] });

const expectedMatrix: ExpectedObservationMatrix = {
	"public:default": ["script"],
	"authenticated:legal": ["cookie", "script"],
	"public:consent-enabled": ["cookie", "localStorage", "sessionStorage", "script", "origin"],
};

async function withBrowserContext<T>(browser: Browser, run: (context: BrowserContext) => Promise<T>): Promise<T> {
	const context = await browser.newContext();
	try {
		return await run(context);
	} finally {
		await context.close();
	}
}

function observeRequestedOrigins(page: Page) {
	const origins = new Set<string>();
	page.on("request", (request) => origins.add(new URL(request.url()).origin));
	return origins;
}

async function waitForDocumentReady(page: Page) {
	await expect.poll(() => page.evaluate(() => document.readyState)).toBe("complete");
}

async function collectInventory(page: Page, flowId: string, requestedOrigins: ReadonlySet<string>): Promise<InventoryObservation[]> {
	const snapshot = await page.evaluate(() => ({
		localStorage: Object.keys(localStorage),
		sessionStorage: Object.keys(sessionStorage),
		scripts: [...new Set([...document.scripts].flatMap((script) => (script.src ? [new URL(script.src, location.href).origin] : [])))],
	}));
	const cookies = await page.context().cookies();
	const origins = [...requestedOrigins].filter((origin) => origin !== firstPartyOrigin);

	return [...cookies.map(({ name }) => ({ flowId, kind: "cookie" as const, name })), ...snapshot.localStorage.map((name) => ({ flowId, kind: "localStorage" as const, name })), ...snapshot.sessionStorage.map((name) => ({ flowId, kind: "sessionStorage" as const, name })), ...snapshot.scripts.map((origin) => ({ flowId, kind: "script" as const, origin })), ...origins.map((origin) => ({ flowId, kind: "origin" as const, origin }))];
}

async function collectPublicFlow(browser: Browser) {
	return withBrowserContext(browser, async (context) => {
		const page = await context.newPage();
		const requestedOrigins = observeRequestedOrigins(page);
		await page.goto("/legal/cookies");
		await expect(page.getByRole("heading", { name: "Cookie Policy" })).toBeVisible();
		await waitForDocumentReady(page);
		return collectInventory(page, "public:default", requestedOrigins);
	});
}

async function collectAuthenticatedFlow(browser: Browser) {
	return withBrowserContext(browser, async (context) => {
		const token = jwt.sign({ id: "playwright-compliance", role: "user" }, "clipify-e2e-jwt-secret-not-for-production", { algorithm: "HS256", issuer: "clipify", expiresIn: "10m" });
		await context.addCookies([{ name: "token", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
		const page = await context.newPage();
		const requestedOrigins = observeRequestedOrigins(page);
		await page.goto("/legal/cookies");
		await expect(page.getByRole("heading", { name: "Cookie Policy" })).toBeVisible();
		await waitForDocumentReady(page);
		return collectInventory(page, "authenticated:legal", requestedOrigins);
	});
}

async function collectConsentEnabledFlow(browser: Browser) {
	return withBrowserContext(browser, async (context) => {
		const page = await context.newPage();
		const requestedOrigins = observeRequestedOrigins(page);
		await page.addInitScript(() => {
			localStorage.setItem("c15t", JSON.stringify({ consents: { necessary: true, functionality: true, measurement: true }, consentInfo: { time: Date.now() } }));
		});
		await page.route(`${CHATWOOT_BASE_URL}/packs/js/sdk.js`, (route) =>
			route.fulfill({
				contentType: "application/javascript",
				body: `window.chatwootSDK={run(){localStorage.setItem("chatwoot_available_agents_${CHATWOOT_WEBSITE_TOKEN}","[]");document.cookie="cw_conversation=compliance; Path=/; SameSite=Lax";window.$chatwoot={};window.dispatchEvent(new Event("chatwoot:ready"));}};`,
			}),
		);
		await page.goto("/legal/cookies");
		await expect(page.locator(`script[src="${CHATWOOT_BASE_URL}/packs/js/sdk.js"]`)).toHaveCount(1);
		await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `chatwoot_available_agents_${CHATWOOT_WEBSITE_TOKEN}`)).not.toBeNull();
		await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & { $chatwoot?: unknown }).$chatwoot))).toBe(true);
		await expect.poll(() => page.evaluate(() => sessionStorage.getItem("sentryReplaySession"))).not.toBeNull();
		await waitForDocumentReady(page);
		return collectInventory(page, "public:consent-enabled", requestedOrigins);
	});
}

test("the real browser inventory satisfies the release gate and injected drift blocks it", async ({ browser }, testInfo) => {
	const observations = [...(await collectPublicFlow(browser)), ...(await collectAuthenticatedFlow(browser)), ...(await collectConsentEnabledFlow(browser))];
	const result = runComplianceGate(observations, declarations, expectedMatrix);
	const evidencePath = testInfo.outputPath("compliance-inventory.json");
	await writeInventoryEvidence(evidencePath, result);
	await testInfo.attach("compliance-inventory", { path: evidencePath, contentType: "application/json" });

	expect(result.missingObservations).toEqual([]);
	expect(result.differences).toEqual([]);
	expect(result.result).toBe("pass");

	const withInjectedDrift = runComplianceGate([...observations, { flowId: "public:consent-enabled", kind: "localStorage", name: "undeclared_release_blocker" }], declarations, expectedMatrix);
	expect(withInjectedDrift.result).toBe("fail");
	expect(withInjectedDrift.differences).toContainEqual({ flowId: "public:consent-enabled", kind: "localStorage", observed: "undeclared_release_blocker", reason: "unknown" });
});
