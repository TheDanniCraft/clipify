/** @jest-environment node */
import * as schema from "@/db/auth-schema";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("TDD-US1-030 provider schema", () => {
	test.each(["jwks", "oauthClient", "oauthAccessToken", "oauthRefreshToken", "oauthConsent", "oauthClientAssertion"])("exports provider model %s in auth schema", (name) => {
		const table = (schema as Record<string, any>)[name];
		expect(table).toBeDefined();
		expect(getTableConfig(table).schema).toBe("auth");
	});
	test.each(["user", "session", "account", "organization", "member", "organizationRole", "passkey"])("preserves %s", (name) => {
		expect(getTableConfig((schema as Record<string, any>)[name]).schema).toBe("auth");
	});
});
