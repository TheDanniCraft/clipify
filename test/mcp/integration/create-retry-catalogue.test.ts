/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
let catalogue: any;
beforeAll(() => {
	catalogue = flowProbe("catalogue:create-retries");
});
for (const kind of ["overlay", "playlist"]) {
	test.each(["lost-response", "concurrent", "conflict", "expired", "rollback", "deleted", "removed-member", "before-expiry", "expiry-boundary", "role-change", "plan-change", "suspended", "revoked-grant", "expired-grant"])(`${kind} public create %s preserves retained intent and current authority`, (mode) => {
		const row = catalogue.outcomes.find((value: any) => value.kind === kind && value.mode === mode);
		expect(row.safe).toBe(true);
		expect(row.retained).toBe(true);
		const count = kind === "overlay" ? "overlays" : "playlists";
		if (mode === "rollback") {
			expect(row.firstError).toBe("SERVICE_UNAVAILABLE");
			expect(row.firstState).toEqual(row.before);
			expect(row.secondId).toEqual(expect.any(String));
		} else {
			expect(row.firstError).toBeNull();
			expect(row.initialId).toEqual(expect.any(String));
		}
		if (mode === "revoked-grant" || mode === "expired-grant") {
			expect(row.secondStatus).toBe(401);
			expect(row.secondId).toBeNull();
		} else if (["conflict", "deleted", "removed-member", "role-change", "plan-change", "suspended"].includes(mode)) {
			expect(row.secondError).toBe(mode === "conflict" ? "RETRY_CONFLICT" : mode === "deleted" ? "RESOURCE_UNAVAILABLE" : "ACCESS_DENIED");
			expect(row.secondId).toBeNull();
		} else {
			expect(row.secondError).toBeNull();
			if (mode === "expired" || mode === "expiry-boundary") expect(row.secondId).not.toBe(row.initialId);
			else if (mode !== "rollback") expect(row.secondId).toBe(row.initialId);
		}
		expect(row.after[count] - row.before[count]).toBe(mode === "expired" || mode === "expiry-boundary" ? 2 : mode === "deleted" ? 0 : 1);
		expect(row.after.retries - row.before.retries).toBe(1);
	});
}

for (const kind of ["overlay", "playlist"]) {
	test.each(["missing", "empty", "oversized"])(`${kind} rejects %s retry key without partial state`, (mode) => {
		expect(catalogue.invalidKeys.find((row: any) => row.kind === kind && row.mode === mode)).toMatchObject({ error: "INVALID_INPUT", safe: true, unchanged: true });
	});
}
