/** @jest-environment node */
import { evaluateOverlayRuntimeAccess, preserveOverlayRuntimeReference } from "@/server/overlay-runtime";

const overlay = {
	id: "overlay_01JEXACT",
	ownerId: "creator_01JEXACT",
	secret: "ovl_live_X9n2sH8pQ4",
};

const sessionStates = ["valid", "revoked", "expired", "absent", "auth-outage"] as const;

describe("TDD-US1-002 dashboard-independent overlay continuity", () => {
	it.each(sessionStates)("keeps HTTP runtime available when the dashboard session is %s", (dashboardSessionState) => {
		const result = evaluateOverlayRuntimeAccess({ channel: "http", overlay, ownerSuspended: false });
		expect(result).toEqual({ allowed: true, overlay });
		expect(dashboardSessionState).toBeDefined();
	});

	it.each(sessionStates)("accepts the unchanged WebSocket secret when the dashboard session is %s", (dashboardSessionState) => {
		const result = evaluateOverlayRuntimeAccess({ channel: "websocket", overlay, presentedSecret: overlay.secret, ownerSuspended: false });
		expect(result).toEqual({ allowed: true, overlay });
		expect(dashboardSessionState).toBeDefined();
	});

	it.each([undefined, "", "wrong-secret"])("rejects an invalid WebSocket secret (%s)", (presentedSecret) => {
		expect(evaluateOverlayRuntimeAccess({ channel: "websocket", overlay, presentedSecret, ownerSuspended: false })).toEqual({ allowed: false, reason: "invalid-secret" });
	});

	it.each(["http", "websocket"] as const)("fails closed for a missing overlay on %s", (channel) => {
		expect(evaluateOverlayRuntimeAccess({ channel, overlay: null, presentedSecret: overlay.secret, ownerSuspended: false })).toEqual({ allowed: false, reason: "not-found" });
	});

	it.each(["http", "websocket"] as const)("distinguishes creator suspension from session expiry on %s", (channel) => {
		expect(evaluateOverlayRuntimeAccess({ channel, overlay, presentedSecret: overlay.secret, ownerSuspended: true })).toEqual({ allowed: false, reason: "owner-suspended", overlay, ownerDisabledReason: null });
	});

	it("preserves the browser-source URL and secret byte-for-byte", () => {
		const before = { url: `https://clipify.us/embed/${overlay.id}`, secret: overlay.secret };
		expect(preserveOverlayRuntimeReference(before)).toEqual(before);
		expect(preserveOverlayRuntimeReference(before).url).toBe(before.url);
		expect(preserveOverlayRuntimeReference(before).secret).toBe(before.secret);
	});
});
