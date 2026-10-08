/** @jest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pricing server/client boundary", () => {
	it("keeps billing and metadata on the server without importing client-only HeroUI", () => {
		const page = readFileSync(resolve("src/app/pricing/page.tsx"), "utf8");
		expect(page).not.toMatch(/from ["']@heroui\/react["']/);
		expect(page).not.toMatch(/^["']use client["']/);
		expect(page).toContain("export const metadata");
		expect(page).toContain("resolveBillingCatalog()");
	});
});

describe("member card server/client boundary", () => {
	it("does not import the client-only HeroUI barrel into the server page", () => {
		const page = readFileSync(resolve("src/app/dashboard/member-card/page.tsx"), "utf8");
		expect(page).not.toMatch(/from ["']@heroui\/react["']/);
		expect(page).toContain("await validateAuth()");
		expect(page).toContain("await getMemberProfile(user.id)");
	});
});
