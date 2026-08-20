"use server";

import { validateAuth } from "@actions/auth";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { isDashboardContentKey } from "@lib/dashboardContent";

export async function dismissDashboardContent(contentKey: string) {
	const user = await validateAuth(true);
	if (!user || !isDashboardContentKey(contentKey)) return { ok: false as const };

	await db
		.insert(userContentStatesTable)
		.values({ userId: user.id, contentKey, state: "dismissed", stateUntil: null, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: [userContentStatesTable.userId, userContentStatesTable.contentKey],
			set: { state: "dismissed", stateUntil: null, updatedAt: new Date() },
		})
		.execute();

	return { ok: true as const };
}
