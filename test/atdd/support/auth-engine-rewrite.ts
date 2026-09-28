import { test as base } from "playwright-bdd";
import { expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { ControlledClock, DeterministicMailAdapter, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite";

const fixtureHeaders = { Authorization: "Bearer clipify-playwright-auth-fixture" };

export type AuthFixture = {
	cookie: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: "Lax" };
	fixture: { authUserId: string; creatorId: string; creatorOrganizationId: string; agencyOrganizationId: string; overlayId: string; overlaySecret: string };
};

export type AuthFixtureOptions = {
	activeContext?: "creator" | "agency";
	actorRole?: "user" | "admin";
	deletionState?: "none" | "suspended";
	agencyLinkStatus?: "proposed" | "accepted";
};

export async function createAuthenticatedFixture(request: APIRequestContext, context: BrowserContext, options: AuthFixtureOptions = {}) {
	const response = await request.post("/api/test/auth-fixture", { headers: fixtureHeaders, data: options });
	expect(response.ok(), await response.text()).toBe(true);
	const fixture = (await response.json()) as AuthFixture;
	await context.addCookies([fixture.cookie]);
	return fixture;
}

interface AuthWorldFixtures {
	authWorld: {
		clock: ControlledClock;
		mail: DeterministicMailAdapter;
		nextToken: () => string;
		values: Map<string, unknown>;
	};
}

export const test = base.extend<AuthWorldFixtures>({
	authWorld: async ({}, provide) => {
		await provide({
			clock: new ControlledClock(),
			mail: new DeterministicMailAdapter(),
			nextToken: createDeterministicTokenGenerator("atdd"),
			values: new Map(),
		});
	},
});

export { expect };
