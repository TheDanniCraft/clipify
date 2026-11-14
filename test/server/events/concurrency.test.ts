/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { user } from "@/db/auth-schema";
import { usersTable, awardEventsTable, awardCandidatesTable, awardSubmissionsTable, awardVotesTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
import { submitAwardCandidate } from "@/server/events/submissions";
import { saveAwardVotes } from "@/server/events/voting";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
let configuration: ReturnType<typeof createAwardConfiguration>, eventId: string;
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	await fixture.db.insert(user).values(["viewer", "other"].map((id) => ({ id, name: id, email: `${id}@example.invalid` })));
	configuration = createAwardConfiguration("Awards", "UTC");
	configuration.categories[0].source = "text";
	configuration.schedule.submissionsStart = new Date(Date.now() - 3600000).toISOString();
	configuration.schedule.reviewRequired = false;
	const [event] = await fixture.db
		.insert(awardEventsTable)
		.values({ ownerId: "host", configuration, presenterDigest: "a".repeat(64), publishedAt: new Date() })
		.returning();
	eventId = event.id;
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("serializes simultaneous submissions so a one-proposal quota cannot be bypassed", async () => {
	const outcomes = await Promise.all(Array.from({ length: 5 }, (_, index) => submitAwardCandidate("viewer", eventId, configuration.categories[0].id, { kind: "text", title: `Proposal ${index}`, description: "", reference: "" })));
	expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
	expect(outcomes.filter((result) => !result.ok && result.code === "LIMIT_REACHED")).toHaveLength(4);
	expect(await fixture.db.select().from(awardSubmissionsTable)).toHaveLength(1);
});
it("deduplicates a canonical clip across concurrent viewers while retaining both original receipts", async () => {
	configuration.categories[0].source = "clip";
	await fixture.db.update(awardEventsTable).set({ configuration });
	const content = { kind: "clip", reference: "SameClip", title: "Lamp", description: "", creatorId: "host" };
	const outcomes = await Promise.all(["viewer", "other"].map((actor) => submitAwardCandidate(actor, eventId, configuration.categories[0].id, content)));
	expect(outcomes.every((result) => result.ok)).toBe(true);
	expect(await fixture.db.select().from(awardCandidatesTable)).toHaveLength(1);
	expect(await fixture.db.select().from(awardSubmissionsTable)).toHaveLength(2);
});
it("keeps concurrent ballot replacements atomic and repeated clicks duplicate-free", async () => {
	const now = Date.now();
	configuration.schedule = { ...configuration.schedule, submissionsStart: new Date(now - 14400000).toISOString(), submissionsEnd: new Date(now - 10800000).toISOString(), votingStart: new Date(now - 7200000).toISOString(), votingEnd: new Date(now + 3600000).toISOString() };
	await fixture.db.update(awardEventsTable).set({ configuration });
	const candidates = await fixture.db
		.insert(awardCandidatesTable)
		.values(["one", "two"].map((key) => ({ eventId, categoryId: configuration.categories[0].id, canonicalKey: key, content: { kind: "text" as const, title: key, description: "", reference: "" }, nominated: true })))
		.returning();
	const results = await Promise.all([candidates[0].id, candidates[1].id, candidates[1].id].map((id) => saveAwardVotes("viewer", eventId, configuration.categories[0].id, [id])));
	expect(results.every((result) => result.ok)).toBe(true);
	expect(await fixture.db.select().from(awardVotesTable)).toHaveLength(1);
});

it("rejects stale-page submissions after the host account is disabled", async () => {
	await fixture.db.update(usersTable).set({ disabled: true });
	expect(await submitAwardCandidate("viewer", eventId, configuration.categories[0].id, { kind: "text", title: "Too late", description: "", reference: "" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(await fixture.db.select().from(awardSubmissionsTable)).toHaveLength(0);
});

it("rejects source searches after the host account is disabled", async () => {
	await fixture.db.update(usersTable).set({ disabled: true });
	const { searchEventSources } = await import("@/server/events/sources");
	await expect(searchEventSources(eventId, configuration.categories[0].id, "anything")).rejects.toThrow("NOT_FOUND");
});
