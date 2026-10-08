/** @jest-environment node */
import { providerProbe } from "../../support/mcp/probe";
import { clientFixture } from "../../support/mcp/fixtures";
describe("MCP provider HTTP discovery and registration", () => {
	test("TDD-US1-001 publishes consistent issuer/resource metadata", () => {
		const as = providerProbe("metadata");
		expect(as.status).toBe(200);
		expect(as.body.issuer).toBe("http://127.0.0.1:3107/api/auth");
		expect(as.body.registration_endpoint).toBe("http://127.0.0.1:3107/api/auth/oauth2/register");
		expect(as.body.code_challenge_methods_supported).toContain("S256");
		const resource = providerProbe("resource");
		expect(resource.status).toBe(200);
		expect(resource.body.resource).toBe("http://127.0.0.1:3107/mcp");
		expect(resource.body.authorization_servers).toEqual([as.body.issuer]);
	});
	test("TDD-US1-002 public custom client registers without cookies or a secret", () => {
		const result = providerProbe("register", clientFixture.build());
		expect(result.status).toBe(201);
		expect(result.body.client_id).toEqual(expect.any(String));
		expect(result.body.token_endpoint_auth_method).toBe("none");
		expect(result.body.access_token).toBeUndefined();
	});
	test.each([{ redirect_uris: ["javascript:alert(1)"] }, { redirect_uris: ["https://*.example.invalid/callback"] }, { grant_types: ["client_credentials"] }, { scope: "runner-credential:read" }, { redirect_uris: ["https://user:pass@example.invalid/callback"] }])("TDD-US1-003 rejects invalid registration %j", (patch) => {
		const result = providerProbe("register", { ...clientFixture.build(), ...patch });
		expect(result.status).toBeGreaterThanOrEqual(400);
		expect(result.body?.client_id).toBeUndefined();
	});
});

import { flowProbe } from "../../support/mcp/probe";
describe("OAuth consent and issuance binding", () => {
	test("TDD-US1-004 logged-out authorization reaches the real consent/login bridge with signed state", () => {
		expect(flowProbe("logged-out")).toMatchObject({ loginPath: "/auth/mcp/consent", signedState: true, clientPreserved: true });
	});
	test("TDD-US1-004 TDD-US1-006 exact approved creator grant is audience bound", () => {
		const result = flowProbe("approve");
		expect(result.tokenStatus).toBe(200);
		expect(result.hasGrant).toBe(true);
		expect(result.approvedCreators).toEqual(["fixture-creator"]);
		expect(result.audience).toContain("http://127.0.0.1:3107/mcp");
		expect(result.issuer).toBe("http://127.0.0.1:3107/api/auth");
	});
	test("TDD-US1-005 denial remains possible after deselecting every scope", () => {
		expect(flowProbe("deny-empty")).toMatchObject({ denied: true });
	});
	test("TDD-US1-005 denial issues no authority", () => {
		expect(flowProbe("deny")).toMatchObject({ denied: true });
	});
	test.each([
		["missing-pkce", "007"],
		["bad-pkce", "008"],
		["changed-callback", "012"],
	])("TDD-US1-%s rejects %s", (mode) => {
		const result = flowProbe(mode);
		expect(result.tokenStatus).toBeGreaterThanOrEqual(400);
		expect(result.hasGrant).toBe(false);
	});
	test("TDD-US1-009 rejects code reuse", () => {
		expect(flowProbe("reuse-code").replayStatus).toBeGreaterThanOrEqual(400);
	});
	test("TDD-US1-026 grants only selected creators and narrowed scopes", () => {
		const result = flowProbe("narrow");
		expect(result.tokenStatus).toBe(200);
		expect(result.hasGrant).toBe(true);
		expect(result.scopes).toBe("creator:read");
		expect(result.approvedCreators).toEqual(["fixture-creator"]);
	});
	test("TDD-US1-029 rejects changed signed authorization state", () => {
		expect(flowProbe("csrf").consentStatus).toBeGreaterThanOrEqual(400);
	});
	test("TDD-US1-026 rejects inaccessible creator selection", () => {
		expect(flowProbe("inaccessible").consentStatus).toBeGreaterThanOrEqual(400);
	});
});

test.each(["wrong-subject", "wrong-client", "wrong-generation", "unknown-grant", "wrong-audience"])("TDD-US1-029 exact binding rejects %s", (mode) => {
	expect(flowProbe(mode).rejectedBinding).toBe(true);
});

describe("TDD-US1-018/019 refresh authority", () => {
	test("valid refresh keeps the immutable creator grant and resource", () => {
		expect(flowProbe("refresh:valid")).toMatchObject({ refreshStatus: 200, sameRefreshGrant: true, refreshScopes: "creator:read overlay:read playlist:read offline_access" });
	});
	test("refresh may narrow the scopes", () => {
		expect(flowProbe("refresh:narrow")).toMatchObject({ refreshStatus: 200, sameRefreshGrant: true, refreshScopes: "creator:read" });
	});
	test("TDD-US1-023 refresh rotation rejects reuse with the provider retry window disabled", () => {
		expect(flowProbe("refresh:reuse")).toMatchObject({ refreshStatus: 200, refreshReplayStatus: 400, sameRefreshGrant: true });
	});
	test.each(["widen", "expired", "wrong-client", "wrong-resource"])("refresh rejects %s authority", (mode) => {
		const result = flowProbe(`refresh:${mode}`);
		expect(result.refreshStatus).toBeGreaterThanOrEqual(400);
		expect(result.sameRefreshGrant).toBe(false);
	});
});

describe("TDD-US1-020 connections", () => {
	test("revoking one real client denies its access and refresh while a second remains usable", () => {
		expect(flowProbe("connections")).toMatchObject({ connectionCount: 2, revokeStatus: 200, revokedAccess: true, revokedRefresh: true, secondUsable: true, safeConnections: true });
	});
});

describe("TDD-US1-010/021 authorization-code lifetime", () => {
	test("TDD-US1-011 an unregistered callback never receives authorization", () => {
		const result = flowProbe("unregistered-callback");
		expect(result.tokenStatus).toBeGreaterThanOrEqual(400);
		expect(result.hasGrant).toBe(false);
	});
	test("an expired authorization code issues no tokens", () => {
		const result = flowProbe("expired-code");
		expect(result.tokenStatus).toBeGreaterThanOrEqual(400);
		expect(result.hasGrant).toBe(false);
	});
	test("simultaneous real database code exchanges issue tokens once", () => {
		const result = flowProbe("concurrent-code");
		expect(result.codeRaceStatuses.sort()).toEqual([200, 400]);
		expect(result.hasGrant).toBe(true);
	});
});
