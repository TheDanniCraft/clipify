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
	test("URL-only automatic SDK discovery reaches signed consent with Write available", () => {
		expect(result.urlOnlyConsentWrite).toBe(true);
	});
	test("real transport counts each tool once, including protocol and domain denials", () => {
		expect(result.measuredCalls.calls).toMatchObject({ started_total: 11, completed_total: 11, success_total: 9, denied_total: 2, inFlight: 0 });
		expect(result.measuredCalls.tools.create_overlay).toMatchObject({ started_total: 2, success_total: 1, denied_total: 1 });
		expect(result.measuredCalls.reasons).toMatchObject({ INVALID_INPUT_total: 1, PLAN_LIMIT_REACHED_total: 1 });
	});
	test("capabilities still respond when the clip import status is temporarily unavailable", () => {
		expect(result.firstUse.unavailableInventory).toMatchObject({ operations: { create_overlay: { allowed: true } }, setup: { nextSteps: [{ reason: "status_unavailable", tool: "get_clip_crawler_status" }] } });
	});
	test("a fresh account gets actionable first-use guidance through the real MCP transport", () => {
		expect(result.firstUse.capabilities).toMatchObject({ usage: { overlays: 0, playlists: 0 }, setup: { dashboardPath: "/dashboard", nextSteps: [{ reason: "running", tool: "get_clip_crawler_status" }] } });
		expect(result.firstUse.emptyInventory.setup.nextSteps).toMatchObject([{ reason: "empty_collection", tool: null, message: expect.stringContaining("check the connected channel") }]);
		expect(result.firstUse.readyInventory.setup.nextSteps[0]).toMatchObject({ tool: "create_overlay", message: expect.stringContaining("Twitch clips are available") });
		expect(result.firstUse.overlays).toMatchObject({ items: [], guidance: { reason: "no_overlays", nextStep: { tool: "get_capabilities" } } });
		expect(result.firstUse.playlists).toMatchObject({ items: [], guidance: { reason: "no_playlists" } });
	});
	test("official SDK reads and mutates while backend Free limits remain enforced", () => {
		expect(result).toMatchObject({ toolCount: 76, readAllowed: true, createAllowed: true, editAllowed: true, count: 1, limitError: "PLAN_LIMIT_REACHED", stored: { name: "Edited by official SDK", configuration_revision: 2 }, secretFree: true });
	});
	test("native SDK discovers seven optional prompts and only focused editing tools", () => {
		expect(result).toMatchObject({ promptCount: 7, promptWorkflowValid: true, focusedDiscoveryValid: true, obsoleteToolDenied: true });
	});
	test("denial creates no authority and immediate revoke rejects the SDK, old bearer and refresh", () => {
		expect(result).toMatchObject({ deniedConsent: true, revocationStatus: 200, revokedSdkDenied: true, oldBearerStatus: 401, oldBearerChallenge: true, refreshStatus: 400 });
	});
});
