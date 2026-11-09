/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { usersTable, awardEventsTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
jest.mock("@/server/resources/clip-discovery", () => ({ fetchClipDiscovery: jest.fn() }));
import { fetchClipDiscovery } from "@/server/resources/clip-discovery";
import { refreshAwardDataResults } from "@/server/events/freeze";
let eventId: string, categoryId: string;
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.schedule = { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-02T00:00:00Z", votingEnd: "2026-02-03T00:00:00Z", timezone: "UTC", reviewRequired: true };
	configuration.categories[0].selection = "data";
	categoryId = configuration.categories[0].id;
	const [event] = await fixture.db
		.insert(awardEventsTable)
		.values({ ownerId: "host", configuration, presenterDigest: "fixture", publishedAt: new Date("2025-12-01") })
		.returning();
	eventId = event.id;
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);
const clip = { id: "WinnerClip", broadcaster_id: "host", title: "Most viewed", duration: 30, created_at: "2026-01-10T00:00:00Z", view_count: 100, thumbnail_url: "https://clips-media-assets2.twitch.tv/winner.jpg" };
it("freezes the last pre-cutoff data snapshot and never substitutes later live counters", async () => {
	jest.mocked(fetchClipDiscovery).mockResolvedValue({ clips: [clip], complete: true } as never);
	await refreshAwardDataResults(new Date("2026-01-31T23:59:00Z"));
	const [observed] = await fixture.db.select().from(awardEventsTable);
	expect(observed.frozenAt).toBeNull();
	expect(observed.frozenResults?.[categoryId]).toMatchObject({ status: "ready", source: "clips", title: "Most viewed", value: 100 });
	const observedAt = Date.parse((observed.frozenResults?.[categoryId] as { asOf: string }).asOf);
	expect(observedAt).toBeGreaterThanOrEqual(Date.parse("2026-01-31T23:59:00Z"));
	expect(observedAt).toBeLessThan(Date.parse("2026-02-01T00:00:00Z"));
	jest.mocked(fetchClipDiscovery).mockClear();
	jest.mocked(fetchClipDiscovery).mockResolvedValue({ clips: [{ ...clip, view_count: 900 }], complete: true } as never);
	await refreshAwardDataResults(new Date("2026-02-01T00:01:00Z"));
	await refreshAwardDataResults(new Date("2026-02-02T00:00:00Z"));
	const [frozen] = await fixture.db.select().from(awardEventsTable);
	expect(frozen.frozenResults?.[categoryId]).toMatchObject({ value: 100 });
	expect(frozen.frozenAt?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
	expect(fetchClipDiscovery).not.toHaveBeenCalled();
});
it("records a missing snapshot rather than inventing historical results after a missed cutoff", async () => {
	jest.mocked(fetchClipDiscovery).mockClear();
	await refreshAwardDataResults(new Date("2026-02-01T00:01:00Z"));
	const [event] = await fixture.db.select().from(awardEventsTable);
	expect(event.frozenResults?.[categoryId]).toMatchObject({ status: "missing" });
	expect(fetchClipDiscovery).not.toHaveBeenCalled();
});
it("does not declare a most-viewed winner from an incomplete clip library", async () => {
	jest.mocked(fetchClipDiscovery).mockResolvedValue({ clips: [clip], complete: false } as never);
	await refreshAwardDataResults(new Date("2026-01-31T23:59:00Z"));
	const [event] = await fixture.db.select().from(awardEventsTable);
	expect(event.frozenResults?.[categoryId]).toMatchObject({ status: "missing" });
});

it("discards an observation whose work crosses the submission cutoff", async () => {
	jest.mocked(fetchClipDiscovery).mockImplementation(async () => {
		await new Promise((resolve) => setTimeout(resolve, 25));
		return { clips: [clip], complete: true } as never;
	});
	await refreshAwardDataResults(new Date("2026-01-31T23:59:59.999Z"));
	const [event] = await fixture.db.select().from(awardEventsTable);
	expect(event.frozenResults?.[categoryId]).toMatchObject({ status: "missing" });
	expect(event.frozenAt).not.toBeNull();
});

jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (principal: { authUserId: string }, ownerId: string) => {
		if (principal.authUserId !== ownerId) throw new Error("ACCESS_DENIED");
		return { assertAuthorityCurrent() {} };
	}),
}));
it("allows an authorized manual watchtime result without inventing a live historical counter", async () => {
	const { setAwardDataResult } = await import("@/server/events/freeze");
	const principal = { kind: "session" as const, authUserId: "host", sessionId: "session", authenticatedAt: new Date() };
	const now = new Date("2026-02-02T12:00:00Z");
	expect(await setAwardDataResult({ ...principal, authUserId: "viewer" }, "host", eventId, categoryId, { title: "Viewer One", value: 321 }, now)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	expect(await setAwardDataResult(principal, "host", eventId, categoryId, { title: "Viewer One", value: 321 }, now)).toMatchObject({ ok: true });
	const [event] = await fixture.db.select().from(awardEventsTable);
	expect(event.frozenResults?.[categoryId]).toMatchObject({ status: "ready", source: "manual", title: "Viewer One", value: 321, asOf: now.toISOString() });
});

it("requires every data award to have a real result before publishing the show archive", async () => {
	const { publishAwardResults } = await import("@/server/events/lifecycle");
	const { setAwardDataResult } = await import("@/server/events/freeze");
	const principal = { kind: "session" as const, authUserId: "host", sessionId: "session", authenticatedAt: new Date() },
		now = new Date("2026-02-04T00:00:00Z");
	expect(await publishAwardResults(principal, "host", eventId, now)).toMatchObject({ ok: false, code: "RESULTS_REQUIRED" });
	expect(await setAwardDataResult(principal, "host", eventId, categoryId, { title: "Confirmed winner", value: 100 }, now)).toMatchObject({ ok: true });
	expect(await publishAwardResults(principal, "host", eventId, now)).toMatchObject({ ok: true });
	expect(await setAwardDataResult(principal, "host", eventId, categoryId, { title: "Changed later", value: 900 }, now)).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
});
