import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { connectedAppGrantsTable as grants, usersTable } from "@/db/schema";
import { oauthClient } from "@/db/auth-schema";
import { requireConnectedAppAdmin } from "./oauth-policy";
import { connectedAppFailure } from "./http";
import { ConnectedAppError } from "./grants";

export async function listApplicationConnections(request: Request) {
	try {
		try {
			await requireConnectedAppAdmin(request.headers);
		} catch {
			throw new ConnectedAppError("ACCESS_DENIED");
		}
		const value = new URL(request.url).searchParams.get("page") ?? "1";
		if (!/^[1-9]\d{0,5}$/.test(value)) throw new ConnectedAppError("INVALID_INPUT", 400);
		const page = Number(value);
		const rows = await db
			.select({ id: grants.id, name: oauthClient.name, clientId: grants.clientId, creatorId: grants.creatorId, username: usersTable.username, operations: grants.operations, expiresAt: grants.expiresAt, revokedAt: grants.revokedAt, disabled: oauthClient.disabled, createdAt: grants.createdAt })
			.from(grants)
			.innerJoin(oauthClient, eq(oauthClient.clientId, grants.clientId))
			.innerJoin(usersTable, eq(usersTable.id, grants.creatorId))
			.orderBy(desc(grants.createdAt), desc(grants.id))
			.limit(26)
			.offset((page - 1) * 25);
		return Response.json({ ok: true, data: { items: rows.slice(0, 25), page, hasNext: rows.length > 25 } }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return connectedAppFailure(error);
	}
}
