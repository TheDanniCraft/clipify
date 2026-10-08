/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US1-023 refresh rotation and immutable authority", () => {
	test.each(["valid", "narrow", "reuse", "concurrent", "expired", "widen", "wrong-client", "wrong-resource", "revoked-grant", "expired-grant"])("%s refresh cannot expand or transfer its grant", (mode) => {
		const result = flowProbe(`refresh:${mode}`);
		const allowed = ["valid", "narrow", "reuse", "concurrent"].includes(mode);
		expect(result.creatorSetPreserved).toBe(true);
		if (allowed) {
			expect(result.refreshStatus).toBe(200);
			expect(result.sameRefreshGrant).toBe(true);
			expect(result.refreshScopes).toBe(mode === "narrow" ? "creator:read" : "creator:read overlay:read playlist:read offline_access");
		} else {
			expect(result.refreshStatus).toBeGreaterThanOrEqual(400);
			expect(result.sameRefreshGrant).toBe(false);
		}
		if (mode === "revoked-grant" || mode === "expired-grant") {
			expect(result.refreshStatus).toBe(400);
			expect(result.refreshError).toBe("invalid_grant");
		}
		if (mode === "reuse" || mode === "concurrent") expect(result.refreshReplayStatus).toBe(400);
		if (mode === "concurrent") {
			expect(result.refreshWaiters).toBe(2);
			expect(result.refreshRaceStatuses.sort()).toEqual([200, 400]);
		}
	});
});
