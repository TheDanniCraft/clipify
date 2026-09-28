import "server-only";

import { headers } from "next/headers";
import { auth } from "./config";
import { db } from "@/db/client";
import { creatorAccountsTable, creatorIdentityLinksTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthenticatedUser } from "@types";
import { classifyDashboardSession } from "./session-boundary";

export async function getAuthSession(requestHeaders?: Headers) {
	return auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
}

export async function requireAuthSession(requestHeaders?: Headers) {
	const session = await getAuthSession(requestHeaders);
	if (!session) throw new Error("AUTHENTICATION_REQUIRED");
	return session;
}

export type ActorContext = {
	authUserId: string;
	sessionId: string;
	creatorId: string;
	activeOrganizationId: string | null;
	user: AuthenticatedUser;
};

type SessionEnvelope = {
	session: {
		id: string;
		userId: string;
		expiresAt: Date | string;
		activeOrganizationId?: string | null;
	};
};

/** Resolve Better Auth's revocable database session to Clipify's stable creator domain record. */
export async function getAuthActorContext(requestHeaders?: Headers): Promise<ActorContext | null> {
	const envelope = (await getAuthSession(requestHeaders)) as SessionEnvelope | null;
	if (!envelope?.session) return null;

	const decision = classifyDashboardSession({
		betterAuthSession: {
			id: envelope.session.id,
			userId: envelope.session.userId,
			expiresAt: envelope.session.expiresAt instanceof Date ? envelope.session.expiresAt : new Date(envelope.session.expiresAt),
		},
	});
	if (!decision.authenticated) return null;

	const activeOrganizationId = envelope.session.activeOrganizationId ?? null;
	let creatorId: string | undefined;
	if (activeOrganizationId) {
		const accounts = await db.select({ creatorId: creatorAccountsTable.creatorId }).from(creatorAccountsTable).where(eq(creatorAccountsTable.organizationId, activeOrganizationId)).limit(1).execute();
		creatorId = accounts[0]?.creatorId;
	}
	if (!creatorId) {
		const links = await db.select({ creatorId: creatorIdentityLinksTable.creatorId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.authUserId, decision.authUserId)).limit(1).execute();
		creatorId = links[0]?.creatorId;
	}
	if (!creatorId) return null;

	const users = await db.select().from(usersTable).where(eq(usersTable.id, creatorId)).limit(1).execute();
	const user = users[0];
	if (!user || user.disabled) return null;

	return {
		authUserId: decision.authUserId,
		sessionId: decision.sessionId,
		creatorId,
		activeOrganizationId,
		user,
	};
}
