export type BetterAuthDatabaseSession = {
	id: string;
	userId: string;
	expiresAt: Date;
};

export type DashboardSessionDecision = { authenticated: true; sessionId: string; authUserId: string } | { authenticated: false; reason: "better-auth-session-required" | "session-expired" };

const PURPOSE_TOKEN_ISSUERS = new Set(["clipify-controller", "clipify-checkout", "clipify-bot-oauth", "clipify-admin-view"]);

export function classifyDashboardSession(input: { betterAuthSession: BetterAuthDatabaseSession | null; now?: Date }): DashboardSessionDecision {
	if (!input.betterAuthSession) return { authenticated: false, reason: "better-auth-session-required" };
	const expiresAt = input.betterAuthSession.expiresAt.getTime();
	if (!Number.isFinite(expiresAt) || expiresAt <= (input.now ?? new Date()).getTime()) return { authenticated: false, reason: "session-expired" };
	return { authenticated: true, sessionId: input.betterAuthSession.id, authUserId: input.betterAuthSession.userId };
}

export function classifyTokenPurpose(issuer: string | undefined): "purpose-token" | "dashboard-forbidden" {
	return issuer && PURPOSE_TOKEN_ISSUERS.has(issuer) ? "purpose-token" : "dashboard-forbidden";
}

export function creatorSignInRecoveryPath(returnUrl: string): string {
	return `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}
