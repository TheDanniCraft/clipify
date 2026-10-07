import "server-only";
import type { TrustedCreatorPrincipal } from "./authorize-operation";
type Envelope = { session: { id: string; userId: string; createdAt: Date | string; activeOrganizationId?: string | null } };
/** Identity comes exclusively from Better Auth's verified current session. */
export async function getVerifiedSessionPrincipal(requestHeaders?: Headers): Promise<(TrustedCreatorPrincipal & { kind: "session" }) | null> {
	const { getAuthSession } = await import("./session");
	const envelope = (await getAuthSession(requestHeaders)) as Envelope | null;
	if (!envelope?.session) return null;
	const authenticatedAt = new Date(envelope.session.createdAt);
	if (!Number.isFinite(authenticatedAt.getTime())) return null;
	return { kind: "session", authUserId: envelope.session.userId, sessionId: envelope.session.id, authenticatedAt, organizationId: envelope.session.activeOrganizationId ?? null };
}
