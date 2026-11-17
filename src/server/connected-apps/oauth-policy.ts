import "server-only";
import { and, eq } from "drizzle-orm";
import { creatorIdentityLinksTable } from "@/db/schema";
import { Role } from "@/app/lib/types";

export const CONNECTED_APP_SCOPE = "creator:read";
export const connectedAppResource = (origin: string) => `${new URL(origin).origin}/api/connected-apps`;

export async function requireConnectedAppAdmin(headers: Headers) {
	const { getAuthActorContext } = await import("@/auth/session");
	const actor = await getAuthActorContext(headers);
	if (!actor || actor.accountStatus !== "active" || actor.user.disabled || actor.user.role !== Role.Admin) throw new Error("ACCESS_DENIED");
	const { db } = await import("@/db/client");
	const [identity] = await db
		.select({ creatorId: creatorIdentityLinksTable.creatorId })
		.from(creatorIdentityLinksTable)
		.where(and(eq(creatorIdentityLinksTable.authUserId, actor.authUserId), eq(creatorIdentityLinksTable.creatorId, actor.user.id)))
		.limit(1);
	if (!identity || identity.creatorId !== actor.user.id) throw new Error("ACCESS_DENIED");
	return actor;
}
