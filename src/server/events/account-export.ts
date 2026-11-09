import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { awardEventsTable as events, awardCandidatesTable as candidates, awardSubmissionsTable as submissions, awardVotesTable as votes, awardAssetsTable as assets, eventConnectionsTable as connections, eventConnectionIntentsTable as intents } from "@/db/schema";
import { decryptString } from "@lib/encryption";
/** The creator owns event content; private receipts and ballots belong only to their submitting actor. */
export async function collectAwardAccountData(input: { creatorId: string; authUserId: string }) {
	const owned = await db.select().from(events).where(eq(events.ownerId, input.creatorId));
	const ids = owned.map((e) => e.id);
	const [nominees, receipts, ballots, ownedAssets, personalUploads, storage, connectionIntents] = await Promise.all([
		ids.length ? db.select().from(candidates).where(inArray(candidates.eventId, ids)) : [],
		db.select().from(submissions).where(eq(submissions.authUserId, input.authUserId)),
		db.select().from(votes).where(eq(votes.authUserId, input.authUserId)),
		ids.length ? db.select().from(assets).where(inArray(assets.eventId, ids)) : [],
		db.select({ id: assets.id, eventId: assets.eventId, categoryId: assets.categoryId, mime: assets.mime, size: assets.size, title: assets.title, description: assets.description, state: assets.state, createdAt: assets.createdAt, updatedAt: assets.updatedAt }).from(assets).where(eq(assets.authUserId, input.authUserId)),
		db.select().from(connections).where(eq(connections.ownerId, input.creatorId)),
		db.select().from(intents).where(eq(intents.authUserId, input.authUserId)),
	]);
	return {
		events: owned,
		candidates: nominees,
		submissions: receipts,
		votes: ballots,
		assets: ownedAssets.map(({ authUserId, ...asset }) => {
			void authUserId;
			return asset;
		}),
		personalUploads,
		connections: storage,
		connectionIntents,
		storageCredentials: storage.filter((c) => c.provider === "s3" && c.encryptedConfiguration).map((c) => ({ connectionId: c.id, storedEncryptedValue: c.encryptedConfiguration, value: decryptString(c.encryptedConfiguration!) })),
	};
}
