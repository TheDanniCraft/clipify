/** @jest-environment node */
import { classifyDashboardSession, classifyTokenPurpose, creatorSignInRecoveryPath } from "@/auth/session-boundary";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("TDD-US1-003 Better Auth dashboard-session boundary", () => {
	it.each([
		["valid legacy JWT", "header.payload.signature"],
		["expired legacy JWT", "expired.header.signature"],
		["malformed legacy JWT", "not-a-jwt"],
		["empty legacy JWT", ""],
	] as const)("rejects a %s without parsing it", (_label, legacyDashboardCookie) => {
		expect(classifyDashboardSession({ legacyDashboardCookie, betterAuthSession: null, now })).toEqual({ authenticated: false, reason: "better-auth-session-required" });
	});

	it("accepts a live Better Auth database session", () => {
		expect(
			classifyDashboardSession({
				legacyDashboardCookie: "legacy-token-must-be-ignored",
				betterAuthSession: { id: "session-1", userId: "auth-user-1", expiresAt: new Date("2026-09-28T13:00:00.000Z") },
				now,
			}),
		).toEqual({ authenticated: true, sessionId: "session-1", authUserId: "auth-user-1" });
	});

	it.each([
		["revoked", null],
		["expired", { id: "session-expired", userId: "auth-user-1", expiresAt: new Date("2026-09-28T11:59:59.999Z") }],
	] as const)("rejects a %s Better Auth session", (_state, betterAuthSession) => {
		expect(classifyDashboardSession({ legacyDashboardCookie: undefined, betterAuthSession, now }).authenticated).toBe(false);
	});

	it("provides a recoverable Twitch sign-in path", () => {
		expect(creatorSignInRecoveryPath("/dashboard/overlay/overlay-1")).toBe("/login?returnUrl=%2Fdashboard%2Foverlay%2Foverlay-1");
	});

	it.each(["clipify-controller", "clipify-checkout", "clipify-bot-oauth", "clipify-admin-view"])("keeps the %s purpose token outside dashboard authentication", (issuer) => {
		expect(classifyTokenPurpose(issuer)).toBe("purpose-token");
	});

	it.each(["clipify", undefined, "unknown"])("does not accept issuer %s as a purpose token", (issuer) => {
		expect(classifyTokenPurpose(issuer)).toBe("dashboard-forbidden");
	});
});
