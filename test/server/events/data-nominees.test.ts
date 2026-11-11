/** @jest-environment node */
import { eq } from "drizzle-orm";
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { usersTable, awardEventsTable, awardCandidatesTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
jest.mock("@/server/resources/mutation", () => ({ authorizeLockedMutation: jest.fn(async () => ({ assertAuthorityCurrent() {} })) }));
import { nominateAwardCandidates } from "@/server/events/review";
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("reserves the winner's place while allowing low-view team choices and unlimited nominees", async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.categories[0] = { ...configuration.categories[0], selection: "data", presenterMode: "nominees", dataNomineeSource: "team", nomineeLimit: 5 };
	configuration.schedule = { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-02T00:00:00Z", votingEnd: "2026-02-03T00:00:00Z", timezone: "UTC", reviewRequired: true };
	const [event] = await fixture.db
		.insert(awardEventsTable)
		.values({ ownerId: "host", configuration, presenterDigest: "fixture", publishedAt: new Date("2025-12-01") })
		.returning();
	const rows = await fixture.db
		.insert(awardCandidatesTable)
		.values(Array.from({ length: 5 }, (_, i) => ({ eventId: event.id, categoryId: configuration.categories[0].id, canonicalKey: `clip:low${i}`, content: { kind: "clip" as const, reference: `low${i}`, title: "Two views", description: "", creatorId: "host", views: 2 } })))
		.returning();
	const principal = { kind: "session" as const, authUserId: "host", sessionId: "session", authenticatedAt: new Date() },
		now = new Date("2026-02-01T12:00:00Z");
	expect(
		await nominateAwardCandidates(
			principal,
			"host",
			event.id,
			configuration.categories[0].id,
			rows.slice(0, 4).map(({ id }) => id),
			now,
		),
	).toMatchObject({ ok: true });
	expect(
		await nominateAwardCandidates(
			principal,
			"host",
			event.id,
			configuration.categories[0].id,
			rows.map(({ id }) => id),
			now,
		),
	).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
	configuration.categories[0].nomineeLimit = null;
	await fixture.db.update(awardEventsTable).set({ configuration }).where(eq(awardEventsTable.id, event.id));
	expect(
		await nominateAwardCandidates(
			principal,
			"host",
			event.id,
			configuration.categories[0].id,
			rows.map(({ id }) => id),
			now,
		),
	).toMatchObject({ ok: true });
});
