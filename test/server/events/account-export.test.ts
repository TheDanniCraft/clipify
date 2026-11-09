/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { user } from "@/db/auth-schema";
import { usersTable, awardEventsTable, awardCandidatesTable, awardSubmissionsTable, awardVotesTable, eventConnectionsTable, awardAssetsTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
import { encryptString } from "@/app/lib/encryption";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
import { collectAwardAccountData } from "@/server/events/account-export";
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("exports owned event content and only the actor's private participation without exposing another creator's storage", async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(user).values([
		{ id: "actor", name: "Actor", email: "actor@example.invalid" },
		{ id: "other", name: "Other", email: "other@example.invalid" },
	]);
	await fixture.db.insert(usersTable).values(["own", "foreign"].map((id) => ({ id, username: id, email: `${id}@example.invalid`, avatar: "", role: Role.User, plan: Plan.Free })));
	for (const ownerId of ["own", "foreign"]) {
		const configuration = createAwardConfiguration(`${ownerId} awards`, "UTC");
		const [event] = await fixture.db.insert(awardEventsTable).values({ ownerId, configuration, presenterDigest: "private-hash" }).returning();
		const [candidate] = await fixture.db
			.insert(awardCandidatesTable)
			.values({ eventId: event.id, categoryId: configuration.categories[0].id, canonicalKey: "clip:fixture", content: { kind: "text", title: `${ownerId} candidate`, description: "", reference: "" } })
			.returning();
		const authUserId = ownerId === "foreign" ? "actor" : "other";
		await fixture.db.insert(awardSubmissionsTable).values({ eventId: event.id, categoryId: configuration.categories[0].id, candidateId: candidate.id, authUserId, original: { kind: "text", title: `${authUserId} proposal`, description: "", reference: "" } });
		await fixture.db.insert(awardVotesTable).values({ eventId: event.id, categoryId: configuration.categories[0].id, candidateId: candidate.id, authUserId });
		const [connection] = await fixture.db
			.insert(eventConnectionsTable)
			.values({ ownerId, provider: "s3", identityId: ownerId, identityName: ownerId, encryptedConfiguration: encryptString(JSON.stringify({ secretAccessKey: `${ownerId}-secret` })) })
			.returning();
		await fixture.db.insert(awardAssetsTable).values({ eventId: event.id, categoryId: configuration.categories[0].id, authUserId, connectionId: connection.id, providerKey: `${ownerId}-private-storage-key`, mime: "image/png", size: 16, title: `${ownerId} image` });
	}
	const result = await collectAwardAccountData({ creatorId: "own", authUserId: "actor" });
	expect(result.events.map((e) => e.configuration.title)).toEqual(["own awards"]);
	expect(result.submissions.map((s) => s.authUserId)).toEqual(["actor"]);
	expect(result.votes.map((v) => v.authUserId)).toEqual(["actor"]);
	expect(result.assets.map((a) => a.title)).toEqual(["own image"]);
	expect(result.personalUploads.map((a) => a.title)).toEqual(["foreign image"]);
	expect(result.personalUploads[0]).not.toHaveProperty("providerKey");
	expect(result.personalUploads[0]).not.toHaveProperty("connectionId");
	expect(result.storageCredentials[0].value).toContain("own-secret");
	expect(JSON.stringify(result)).not.toMatch(/foreign-secret|foreign-private-storage-key|other proposal/);
});
