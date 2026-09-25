import { expect, test as playwrightTest, type Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import axe from "axe-core";
import { consentCategoryDetails, consentServices, necessaryConsentServices } from "../../../src/app/lib/consent/registry";
import { privacyRequestGuidance } from "../../../src/app/lib/legal/rights";
import { runComplianceGate, type InventoryDeclaration, type InventoryObservation } from "../../compliance/support/inventoryAudit";
import { classifyLegalChange, type LegalChange } from "../../../src/app/lib/legal/versioning";
import { termsSections } from "../../../src/app/lib/legal/terms";
import { validatePolicyRelease } from "../../../src/app/lib/legal/validation";
import { complianceScope } from "../../../src/app/lib/legal/scope";
import { documentProvenance } from "../../../src/app/lib/legal/provenance";

const { Given, When, Then } = createBdd();
const failedConsentRequests = new WeakMap<Page, string[]>();

const legalDestinations = [
	{ name: "Privacy Policy", path: "/legal/privacy" },
	{ name: "Cookie Policy", path: "/legal/cookies" },
	{ name: "Terms of Service", path: "/legal/terms" },
	{ name: "Imprint", path: "/imprint" },
	{ name: "Request Data Removal", path: "/legal/privacy-requests" },
] as const;

const reviewedAuditDeclarations: InventoryDeclaration[] = [
	{
		serviceId: "consent-storage",
		storageNames: [],
		storagePatterns: [],
		storageDeclarations: [
			{ kind: "cookie", name: "c15t" },
			{ kind: "localStorage", name: "c15t" },
		],
		origins: [],
	},
	{ serviceId: "clipify-application", storageNames: [], storagePatterns: [], origins: [], scriptOrigins: ["http://127.0.0.1:3107"] },
];

Given("a visitor is on a public Clipify page", async ({ page }) => {
	playwrightTest.slow();
	const response = await page.goto("/imprint");
	expect(response?.ok()).toBe(true);
});

When("they inspect the legal navigation", async ({ page }) => {
	await expect(page.getByRole("heading", { name: "Legal" })).toBeVisible();
});

Then("every required legal destination is hosted by Clipify and available", async ({ page }) => {
	const firstPartyOrigin = new URL(page.url()).origin;
	const requestedUrls: string[] = [];
	const recordRequest = (request: { url(): string }) => requestedUrls.push(request.url());
	page.on("request", recordRequest);

	try {
		for (const destination of legalDestinations) {
			const link = page.getByRole("link", { name: destination.name, exact: true }).first();
			await expect(link).toHaveAttribute("href", destination.path);
			await Promise.all([page.waitForURL((url) => url.pathname === destination.path), link.click()]);
			await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll("/", "\\/")}$`));
			await expect(page.getByRole("link", { name: "Clipify", exact: true }).first()).toBeVisible();
			await expect(page.getByRole("contentinfo")).toBeVisible();
		}
	} finally {
		page.off("request", recordRequest);
	}

	const requestedOrigins = [...new Set(requestedUrls.map((url) => new URL(url).origin))];
	expect(requestedUrls.some((url) => /goadopt\.io/i.test(url))).toBe(false);
	expect(requestedOrigins).toEqual([firstPartyOrigin]);
});

Given("a visitor opens the cookie policy", async ({ page }) => {
	const response = await page.goto("/legal/cookies");
	expect(response?.ok()).toBe(true);
});

When("they inspect the {string} service declaration", async ({ page }, serviceName: string) => {
	await expect(page.getByRole("heading", { name: serviceName, exact: true })).toBeVisible();
});

Then("its purpose, data, storage, recipient, retention, consent, and transfer information are shown", async ({ page }) => {
	const declaration = page.getByRole("article", { name: "Sentry Session Replay", exact: true });
	for (const label of ["Provider or recipient", "Data categories", "Storage", "Retention", "Consent status", "Hosting and transfers"]) {
		await expect(declaration.getByText(label, { exact: true })).toBeVisible();
	}
	await expect(declaration.getByText(/diagnose browser errors/i)).toBeVisible();
});

Given("a visitor opens the privacy policy at a {int} pixel viewport", async ({ page }, width: number) => {
	await page.setViewportSize({ width, height: 800 });
	const response = await page.goto("/legal/privacy");
	expect(response?.ok()).toBe(true);
});

When("they inspect its semantic and keyboard navigation", async ({ page }) => {
	await expect(page.getByRole("main")).toBeVisible();
	await expect(page.getByRole("article")).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Legal documents" })).toBeVisible();
});

Then("the legal document remains readable and every legal destination is keyboard reachable", async ({ page }) => {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	await page.addScriptTag({ content: axe.source });
	const seriousViolations = await page.evaluate(async () => {
		const axeApi = (window as typeof window & { axe: { run: (root: Document) => Promise<{ violations: { id: string; impact: string | null; nodes: { target: string[]; html: string; failureSummary?: string }[] }[] }> } }).axe;
		const result = await axeApi.run(document);
		return result.violations.filter(({ impact }) => impact === "serious" || impact === "critical").map(({ id, impact, nodes }) => ({ id, impact, nodes }));
	});
	expect(seriousViolations).toEqual([]);
	const legalLinks = page.getByRole("navigation", { name: "Legal documents" }).getByRole("link");
	await expect(legalLinks).toHaveCount(5);
	await legalLinks.first().focus();
	await expect(legalLinks.first()).toBeFocused();
	for (let index = 1; index < 5; index += 1) {
		await page.keyboard.press("Tab");
		await expect(legalLinks.nth(index)).toBeFocused();
	}
});

When("they inspect the complete consent inventory", async ({ page }) => {
	await expect(page.getByRole("region", { name: "Service and storage declarations" })).toBeVisible();
});

Then("every declared category and service is disclosed with its operating details", async ({ page }) => {
	for (const category of Object.values(consentCategoryDetails)) await expect(page.getByRole("heading", { name: category.title, exact: true })).toBeVisible();
	for (const service of [...necessaryConsentServices, ...consentServices]) {
		const declaration = page.getByRole("article", { name: service.name, exact: true });
		for (const value of [service.purpose, service.recipient, service.storage, service.retention, service.hostingRegions.join(", ")]) await expect(declaration.getByText(value, { exact: true })).toBeVisible();
	}
});

When("they activate cookie preferences from the legal document", async ({ page }) => {
	await page.getByRole("region", { name: "Service and storage declarations" }).getByRole("button", { name: "Cookie preferences", exact: true }).click();
});

Then("the existing privacy preferences dialog opens without leaving the cookie policy", async ({ page }) => {
	await expect(page).toHaveURL(/\/legal\/cookies$/);
	await expect(page.getByRole("dialog", { name: "Privacy preferences" })).toBeVisible();
});

Given("the consent backend is unavailable", async ({ page }) => {
	const failedRequests: string[] = [];
	failedConsentRequests.set(page, failedRequests);
	page.on("requestfailed", (request) => {
		if (request.url().includes("/api/c15t")) failedRequests.push(request.url());
	});
	await page.route("**/api/c15t/**", (route) => route.abort("failed"));
});

Then("the complete disclosures remain readable without claiming a saved preference", async ({ page }) => {
	await expect(page.getByRole("region", { name: "Service and storage declarations" })).toBeVisible();
	for (const category of Object.values(consentCategoryDetails)) await expect(page.getByRole("heading", { name: category.title, exact: true })).toBeVisible();
	const storedBefore = await page.evaluate(() => localStorage.getItem("c15t"));
	await page.getByRole("region", { name: "Service and storage declarations" }).getByRole("button", { name: "Cookie preferences", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Privacy preferences" })).toBeVisible();
	expect(failedConsentRequests.get(page)).not.toEqual([]);
	expect(await page.evaluate(() => localStorage.getItem("c15t"))).toBe(storedBefore);
	await expect(page.getByText(/preferences (were |are )?saved/i)).toHaveCount(0);
});

Given("a visitor opens the privacy-request page", async ({ page }) => {
	const response = await page.goto("/legal/privacy-requests");
	expect(response?.ok()).toBe(true);
});

When("they inspect the rights and response guidance", async ({ page }) => {
	await expect(page.getByRole("heading", { name: "Privacy Requests" })).toBeVisible();
});

Then("supported rights, verification, response stages, and complaint options are shown", async ({ page }) => {
	const article = page.getByRole("article");
	for (const value of [...privacyRequestGuidance.intentions, privacyRequestGuidance.verification, ...privacyRequestGuidance.processStages, ...privacyRequestGuidance.complaintRoutes]) {
		await expect(article).toContainText(value);
	}
});

When("they inspect the no-account contact route", async ({ page }) => {
	await expect(page.getByText(/no Clipify account is required/i)).toBeVisible();
});

Then("an accessible durable email route is available without signing in", async ({ page }) => {
	const contact = page.getByRole("link", { name: privacyRequestGuidance.contact.email, exact: true });
	await expect(contact).toHaveAttribute("href", `mailto:${privacyRequestGuidance.contact.email}`);
	await expect(page).toHaveURL(/\/legal\/privacy-requests$/);
});

When("they inspect applicability and lawful limits", async ({ page }) => {
	await expect(page.getByRole("heading", { name: "Applicability and lawful limits" })).toBeVisible();
});

Then("no right, timeline, or outcome is promised unconditionally", async ({ page }) => {
	const article = page.getByRole("article");
	for (const qualification of privacyRequestGuidance.qualifications) await expect(article).toContainText(qualification);
	await expect(article.getByText(/we will always|guaranteed deletion|unconditional/i)).toHaveCount(0);
});

Given("a reviewed browser inventory declaration", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("c15t", JSON.stringify({ consents: { necessary: true, functionality: false, measurement: false }, consentInfo: { time: Date.now() } })));
	await page.route("https://changed.example/audit.js", (route) => route.fulfill({ contentType: "application/javascript", body: "window.__undeclaredAuditScriptLoaded = true;" }));
	await page.goto("/legal/cookies");
	await expect(page.getByRole("heading", { name: "Cookie Policy" })).toBeVisible();
});

When("an undeclared storage key and external origin are observed", async ({ page }) => {
	await page.evaluate(async () => {
		localStorage.setItem("changed_key", "private-value-never-collected");
		await new Promise<void>((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://changed.example/audit.js";
			script.onload = () => resolve();
			script.onerror = () => reject(new Error("Injected audit script did not load"));
			document.body.append(script);
		});
	});
});

Then("the browser-backed audit reports the changes and fails the release gate", async ({ page }) => {
	const snapshot = await page.evaluate(() => ({
		cookies: document.cookie
			.split(";")
			.map((entry) => entry.split("=", 1)[0]?.trim())
			.filter((name): name is string => Boolean(name)),
		localStorage: Object.keys(localStorage),
		scripts: [...new Set([...document.scripts].flatMap((script) => (script.src ? [new URL(script.src, location.href).origin] : [])))],
		origins: [
			...new Set(
				performance
					.getEntriesByType("resource")
					.map((entry) => new URL(entry.name, location.href).origin)
					.filter((origin) => origin !== location.origin),
			),
		],
	}));
	const observations: InventoryObservation[] = [...snapshot.cookies.map((name) => ({ flowId: "public:default", kind: "cookie" as const, name })), ...snapshot.localStorage.map((name) => ({ flowId: "public:default", kind: "localStorage" as const, name })), ...snapshot.scripts.map((origin) => ({ flowId: "public:default", kind: "script" as const, origin })), ...snapshot.origins.map((origin) => ({ flowId: "public:default", kind: "origin" as const, origin }))];
	const result = runComplianceGate(observations, reviewedAuditDeclarations, { "public:default": ["localStorage", "script", "origin"] });
	expect(result.result).toBe("fail");
	expect(result.missingObservations).toEqual([]);
	expect(result.differences).toContainEqual({ flowId: "public:default", kind: "localStorage", observed: "changed_key", reason: "unknown" });
	expect(result.differences).toContainEqual({ flowId: "public:default", kind: "script", observed: "https://changed.example", reason: "unknown" });
	expect(result.differences).toContainEqual({ flowId: "public:default", kind: "origin", observed: "https://changed.example", reason: "unknown" });
	expect(JSON.stringify(result)).not.toContain("private-value-never-collected");
});

When("the reviewed {string} is classified", async ({}, change: string) => {
	expect(classifyLegalChange(change as LegalChange).classification).toBe("material");
});

Then("{string} requires a version review and a recorded consent or notice decision", async ({}, change: string) => {
	expect(classifyLegalChange(change as LegalChange)).toEqual({ classification: "material", requiresVersionChange: true, requiresConsentOrNoticeDecision: true });
});

Given("an approved local storage name contains a private value", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("chatwoot_available_agents_smoke", "private-evidence-value"));
});

Then("the policy keeps the declared inventory authoritative without exposing the private value", async ({ page }) => {
	await expect(page.getByRole("region", { name: "Service and storage declarations" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Activity visible on this device" })).toHaveCount(0);
	await expect(page.getByText("private-evidence-value", { exact: true })).toHaveCount(0);
});

Given("a visitor opens the terms of service", async ({ page }) => {
	const response = await page.goto("/legal/terms");
	expect(response?.ok()).toBe(true);
});

When("they inspect account, paid-plan, and self-hosted Runner terms", async ({ page }) => {
	for (const title of ["Accounts and security", "Paid plans and billing", "Self-hosted Runner"]) await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});

Then("the complete contractual topics are available before commitment", async ({ page }) => {
	const article = page.getByRole("article");
	for (const section of termsSections) await expect(article).toContainText(section.title);
});

const incompleteRelease = {
	documents: [{ id: "privacy", title: "", version: "1.0.0", effectiveDate: "2026-09-25", scope: "EU/EEA and German baseline" }],
	services: [{ id: "consent-storage", provider: "Clipify", purpose: "Remember privacy choices" }],
	references: [{ documentId: "privacy", serviceId: "consent-storage" }],
	operatorFactsConfirmed: true,
	auditResult: "pass" as const,
};

Given("a policy release with missing mandatory metadata", async ({}) => {
	expect(incompleteRelease.documents[0].title).toBe("");
});

When("the publication gate validates the release", async ({}) => {
	expect(validatePolicyRelease(incompleteRelease).valid).toBe(false);
});

Then("publication is rejected with an actionable metadata error", async ({}) => {
	expect(validatePolicyRelease(incompleteRelease).errors).toContain("documents.privacy.title is required");
});

Given("the reviewed legal scope and provenance", async ({}) => {
	expect(documentProvenance.length).toBeGreaterThan(0);
});

When("a visitor reviews the published document set", async ({ page }) => {
	const response = await page.goto("/legal/privacy");
	expect(response?.ok()).toBe(true);
});

Then("it is one English EU and German baseline set without a worldwide compliance promise", async ({ page }) => {
	expect(complianceScope.documentSets).toEqual([{ language: "en", regionalVariant: false }]);
	expect(complianceScope.worldwideComplianceGuaranteed).toBe(false);
	await expect(page.getByText(/one English document set|EU\/EEA and German legal baseline/i)).toHaveCount(0);
	await expect(page.getByText(/worldwide compliance (is|are) guaranteed/i)).toHaveCount(0);
});
