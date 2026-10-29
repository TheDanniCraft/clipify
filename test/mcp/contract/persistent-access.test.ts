/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test.each(["default", "post"])("a %s authorization omitting offline_access can approve persistent access without a fixed grant expiry", (mode) => {
	const result = flowProbe(`persistent:${mode}`);
	expect(result).toMatchObject({ tokenStatus: 200, hasRefreshToken: true, grantExpiresAt: null });
	expect(result.signedScopes.split(" ")).toContain("offline_access");
});

test("declining persistent access issues only an access token", () => {
	expect(flowProbe("persistent:decline")).toMatchObject({ tokenStatus: 200, hasRefreshToken: false, scopes: "creator:read" });
});

test("a client that cannot request offline_access retains its allowed operation scopes", () => {
	const result = flowProbe("persistent:restricted");
	expect(result).toMatchObject({ tokenStatus: 200, hasRefreshToken: false });
	expect(result.signedScopes.split(" ")).not.toContain("offline_access");
});

test("rotation keeps an active connection beyond its original 30 days but expires after inactivity", () => {
	expect(flowProbe("persistent:rolling")).toMatchObject({ firstRefreshStatus: 200, secondRefreshStatus: 200, rotated: true, authenticatedAfterOriginalDeadline: true, idleExpiryStatus: 400, idleExpiryError: "invalid_grant" });
});
