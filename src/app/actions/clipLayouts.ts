"use server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { authorizeCreatorOperation } from "@/auth/authorize-operation";
import { clipLayoutSchema } from "@lib/clipLayout";
const contentKey = "clip-portrait-layout:v1";
export async function loadClipLayout(creatorId: string) {
	if (typeof creatorId !== "string" || !creatorId || creatorId.length > 200) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:read" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const [row] = await db
			.select({ state: userContentStatesTable.state })
			.from(userContentStatesTable)
			.where(and(eq(userContentStatesTable.userId, creatorId), eq(userContentStatesTable.contentKey, contentKey)))
			.execute();
		const layout = row ? clipLayoutSchema.safeParse(JSON.parse(row.state)) : null;
		return { ok: true as const, layout: layout?.success ? layout.data : null };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
export async function saveClipLayout(creatorId: string, input: unknown) {
	if (typeof creatorId !== "string" || !creatorId || creatorId.length > 200) return { ok: false as const, code: "INVALID_INPUT" };
	const layout = clipLayoutSchema.safeParse(input);
	if (!layout.success) return { ok: false as const, code: "INVALID_INPUT" };
	const grant = await authorizeCreatorOperation({ creatorId, resourceOwnerId: creatorId, permission: "creator:update" });
	if (!grant.allowed) return { ok: false as const, code: grant.code };
	try {
		const state = JSON.stringify(layout.data),
			updatedAt = new Date();
		await db
			.insert(userContentStatesTable)
			.values({ userId: creatorId, contentKey, state, updatedAt })
			.onConflictDoUpdate({ target: [userContentStatesTable.userId, userContentStatesTable.contentKey], set: { state, updatedAt } })
			.execute();
		return { ok: true as const };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" };
	}
}
