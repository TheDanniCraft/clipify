/** @jest-environment node */
import { consentTargetProbe as probe } from "../../support/mcp/consent-target-client";
describe("TDD-US1-033 offline-only consent still verifies selected creator access", () => {
	test("an existing foreign creator cannot be selected just because no operation scope was requested", () => {
		expect(probe("foreign")).toEqual({ status: 403, error: "access_denied", issuedCode: false, grants: [] });
	});
	test("offline-only consent for a currently accessible creator preserves the narrow scope", () => {
		expect(probe("owned")).toMatchObject({ status: 200, issuedCode: true, grants: [{ active: true, scopes: ["offline_access"] }] });
	});
});
