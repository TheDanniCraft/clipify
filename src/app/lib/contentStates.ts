import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";

export async function getDismissedContentKeys(userId: string, contentKeys: string[]) {
	if (!contentKeys.length) return new Set<string>();
	const states = await db
		.select({ contentKey: userContentStatesTable.contentKey })
		.from(userContentStatesTable)
		.where(and(eq(userContentStatesTable.userId, userId), eq(userContentStatesTable.state, "dismissed"), inArray(userContentStatesTable.contentKey, contentKeys)))
		.execute();
	return new Set(states.map((state) => state.contentKey));
}
