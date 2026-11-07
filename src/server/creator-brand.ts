import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userContentStatesTable } from "@/db/schema";
import { creatorBrandSchema } from "@lib/overlayMetadata";
export const CREATOR_BRAND_KEY = "creator-brand:v1";
/** Call only after resolving the owning creator's access or runtime capability. */
export async function readCreatorBrand(creatorId: string) {
	const [row] = await db
		.select({ state: userContentStatesTable.state })
		.from(userContentStatesTable)
		.where(and(eq(userContentStatesTable.userId, creatorId), eq(userContentStatesTable.contentKey, CREATOR_BRAND_KEY)))
		.limit(1)
		.execute();
	if (!row) return { brand: null, revision: 0 };
	const stored = JSON.parse(row.state);
	if (!Number.isSafeInteger(stored.revision) || stored.revision < 1) throw new Error("Invalid brand revision");
	return { brand: creatorBrandSchema.parse(stored.brand), revision: stored.revision as number };
}
