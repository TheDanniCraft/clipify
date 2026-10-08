/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe.each(["legacy", "auto"])("independent official SDK %s transport", (mode) => {
	let result: any;
	beforeAll(() => {
		result = runMcpProbe("sdk-client-probe", [mode], 60000);
	});
	test("TDD-US1-025 independent official SDK uses discovered native DCR, PKCE and resource binding", () => {
		expect(result).toMatchObject({ metadataValid: true, registrationStatus: 201, issuerBound: true, audienceBound: true, clientVersion: "2.3.0", registrationPath: "native-dynamic-registration" });
		expect(result.protocols).toContain(mode === "auto" ? "2026-07-28" : "2025-11-25");
	});
	test("official SDK reads and mutates while backend Free limits remain enforced", () => {
		expect(result).toMatchObject({ toolCount: 66, readAllowed: true, createAllowed: true, editAllowed: true, count: 1, limitError: "PLAN_LIMIT_REACHED", stored: { name: "Edited by official SDK", configuration_revision: 2 }, secretFree: true });
	});
	test("native SDK discovers six optional prompts and only focused editing tools", () => {
		expect(result).toMatchObject({ promptCount: 6, promptWorkflowValid: true, focusedDiscoveryValid: true, obsoleteToolDenied: true });
	});
	test("denial creates no authority and immediate revoke rejects the SDK, old bearer and refresh", () => {
		expect(result).toMatchObject({ deniedConsent: true, revocationStatus: 200, revokedSdkDenied: true, oldBearerStatus: 401, oldBearerChallenge: true, refreshStatus: 400 });
	});
});
