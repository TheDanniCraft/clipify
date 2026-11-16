/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
test("identity login verifies PKCE, signed ID token and scoped UserInfo without a creator grant", () => {
	expect(runMcpProbe("identity-login-probe", [])).toEqual({ signedIdentity: true, userInfo: true, pkce: true, publicIdentityRegistrationDenied: true, noMcpGrant: true, foreignCallbackDenied: true });
});
