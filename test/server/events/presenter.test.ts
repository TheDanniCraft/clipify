/** @jest-environment node */
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { usersTable, awardEventsTable, awardCandidatesTable, awardVotesTable } from "@/db/schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (principal: { authUserId: string }) => {
		if (principal.authUserId !== "team-actor") throw new Error("ACCESS_DENIED");
		return { assertAuthorityCurrent() {} };
	}),
}));
import { readAwardPresenter } from "@/server/events/presenter";
const secret = "s".repeat(43),
	hash = (value: string) => createHash("sha256").update(value).digest("hex"),
	now = new Date("2026-02-04T00:00:00Z");
let eventId: string;
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	await fixture.db.insert(user).values({ id: "private-voter-id", name: "Viewer", email: "viewer@example.invalid" });
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.categories[0].source = "text";
	configuration.schedule = { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-02T00:00:00Z", votingEnd: "2026-02-03T00:00:00Z", timezone: "UTC", reviewRequired: false };
	const [event] = await fixture.db
		.insert(awardEventsTable)
		.values({ ownerId: "host", configuration, presenterDigest: hash(secret), publishedAt: new Date("2025-12-01") })
		.returning();
	eventId = event.id;
	const [candidate] = await fixture.db
		.insert(awardCandidatesTable)
		.values({ eventId, categoryId: configuration.categories[0].id, canonicalKey: "fixture", content: { kind: "text", title: "Lampe", description: "", reference: "" }, nominated: true })
		.returning();
	await fixture.db.insert(awardVotesTable).values({ eventId, categoryId: configuration.categories[0].id, candidateId: candidate.id, authUserId: "private-voter-id" });
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);
it("reveals completed results to the secret holder without returning credentials or voter identities", async () => {
	const result = await readAwardPresenter(eventId, secret, now);
	expect(result).toMatchObject({ ok: true, event: { phase: "closed", categories: [{ results: [{ votes: 1, winner: true }] }] }, statistics: { categories: 1, nominees: 1, voters: 1 } });
	expect(JSON.stringify(result)).not.toMatch(/private-voter-id|presenterDigest|secretAccessKey/);
	const before = await readAwardPresenter(eventId, secret, new Date("2026-02-02T12:00:00Z"));
	expect(before.ok).toBe(true);
	if (before.ok) expect(before.event.categories[0]).not.toHaveProperty("results");
});
it("rejects rotated capabilities and disabled creators", async () => {
	await fixture.db
		.update(awardEventsTable)
		.set({ presenterDigest: hash("n".repeat(43)) })
		.where(eq(awardEventsTable.id, eventId));
	expect(await readAwardPresenter(eventId, secret, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	await fixture.db.update(usersTable).set({ disabled: true }).where(eq(usersTable.id, "host"));
	expect(await readAwardPresenter(eventId, "n".repeat(43), now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
});

it("publishes from a valid presenter only after voting closes and keeps revoked links powerless", async () => {
	const { publishAwardPresenterResults } = await import("@/server/events/presenter");
	expect(await publishAwardPresenterResults(eventId, "x".repeat(43), now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(await publishAwardPresenterResults(eventId, secret, new Date("2026-02-02T12:00:00Z"))).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
	expect(await publishAwardPresenterResults(eventId, secret, now)).toEqual({ ok: true });
	const [event] = await fixture.db.select().from(awardEventsTable);
	expect(event.resultsPublishedAt?.toISOString()).toBe(now.toISOString());
});

it("gates chat by a valid capability and the host's enabled chat setting", async () => {
	const { pollAwardChat } = await import("@/server/events/chat");
	expect(await pollAwardChat(eventId, secret)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.presentation.showChat = true;
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	const { relayAwardChat } = await import("@/server/events/chat-buffer");
	expect(await pollAwardChat(eventId, secret)).toMatchObject({ ok: true, messages: [] });
	relayAwardChat({ broadcaster_user_id: "host", message_id: "chat", chatter_user_login: "viewer", chatter_user_name: "Viewer", color: "", message: { text: "hi", fragments: [{ type: "text", text: "hi" }] }, badges: [] });
	expect(await pollAwardChat(eventId, secret)).toMatchObject({ ok: true, messages: [{ text: "hi" }] });
	expect(await pollAwardChat(eventId, "x".repeat(43))).toMatchObject({ ok: false, code: "NOT_FOUND" });
});

it("requires a team tie decision among the tied leaders before public release", async () => {
	const { chooseAwardTieWinner, readAwardTieResults } = await import("@/server/events/ties");
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.tiePolicy = "team";
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	const categoryId = event.configuration.categories[0].id;
	const [second] = await fixture.db
		.insert(awardCandidatesTable)
		.values({ eventId, categoryId, canonicalKey: "second", content: { kind: "text", title: "Second", description: "", reference: "" }, nominated: true })
		.returning();
	await fixture.db.insert(awardVotesTable).values({ eventId, categoryId, candidateId: second.id, authUserId: "private-voter-id" });
	const { publishAwardPresenterResults } = await import("@/server/events/presenter");
	expect(await publishAwardPresenterResults(eventId, secret, now)).toMatchObject({ ok: false, code: "RESULTS_REQUIRED" });
	const principal = { kind: "session" as const, authUserId: "team-actor", sessionId: "test", authenticatedAt: now };
	expect(await chooseAwardTieWinner({ ...principal, authUserId: "outsider" }, "host", eventId, categoryId, second.id, now)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	expect(await chooseAwardTieWinner(principal, "host", eventId, categoryId, crypto.randomUUID(), now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await readAwardTieResults(principal, "host", eventId, now)).toMatchObject({ ok: true, categories: [{ title: event.configuration.categories[0].title, candidates: expect.any(Array) }] });
	expect(await chooseAwardTieWinner(principal, "host", eventId, categoryId, second.id, now)).toMatchObject({ ok: true });
	expect(await readAwardPresenter(eventId, secret, now)).toMatchObject({ ok: true, event: { categories: [{ results: expect.arrayContaining([{ id: second.id, votes: 1, percentage: 50, winner: true }]) }] } });
	expect(await publishAwardPresenterResults(eventId, secret, now)).toEqual({ ok: true });
	expect(await chooseAwardTieWinner(principal, "host", eventId, categoryId, second.id, now)).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
});

it("shares a read-only draft preview without publishing it or exposing grouped originals", async () => {
	const { createAwardPreview, readAwardPreview } = await import("@/server/events/preview");
	const { readPublicAwardEvent } = await import("@/server/events/public-read");
	await fixture.db.update(awardEventsTable).set({ publishedAt: null }).where(eq(awardEventsTable.id, eventId));
	const [parent] = await fixture.db.select().from(awardCandidatesTable);
	await fixture.db.insert(awardCandidatesTable).values({ eventId, categoryId: parent.categoryId, canonicalKey: "grouped-original", parentId: parent.id, content: { kind: "text", title: "Private original suggestion", description: "", reference: "" } });
	const principal = { kind: "session" as const, authUserId: "team-actor", sessionId: "session", authenticatedAt: now };
	expect(await createAwardPreview({ ...principal, authUserId: "outsider" }, "host", eventId, now)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	expect(await createAwardPreview(principal, "other-owner", eventId, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	const created = await createAwardPreview(principal, "host", eventId, now);
	if (!created.ok) throw new Error("preview failed");
	const view = await readAwardPreview(eventId, created.token, now);
	expect(view).toMatchObject({ ok: true, event: { title: "Awards", phase: "closed", categories: [{ candidates: [{ content: { title: "Lampe" } }] }] }, statistics: { voters: 1 } });
	expect(JSON.stringify(view)).not.toContain("Private original suggestion");
	expect(JSON.stringify(view)).not.toContain("private-voter-id");
	expect(await readPublicAwardEvent(eventId)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	const { publishAwardPresenterResults } = await import("@/server/events/presenter");
	expect(await publishAwardPresenterResults(eventId, created.token, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	const [stored] = await fixture.db.select().from(awardEventsTable);
	expect(stored.publishedAt).toBeNull();
	expect(stored.resultsPublishedAt).toBeNull();
	expect(stored.frozenAt).toBeNull();
	expect(await readAwardPreview(eventId, created.token, new Date(now.getTime() + 7 * 86400000))).toMatchObject({ ok: false, code: "NOT_FOUND" });
	await fixture.db
		.update(awardEventsTable)
		.set({ presenterDigest: hash("n".repeat(43)) })
		.where(eq(awardEventsTable.id, eventId));
	expect(await readAwardPreview(eventId, created.token, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
});

it("enriches chatter badges once per cached user and keeps messages when 7TV fails", async () => {
	const { pollAwardChat } = await import("@/server/events/chat");
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.presentation.showChat = true;
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	await pollAwardChat(eventId, secret);
	const { relayAwardChat } = await import("@/server/events/chat-buffer");
	const send = (id: string) => relayAwardChat({ broadcaster_user_id: "host", message_id: `${eventId}:${id}`, chatter_user_id: id, chatter_user_login: "viewer", chatter_user_name: "Viewer", color: "", message: { text: "Badge test", fragments: [{ type: "text", text: "Badge test" }] }, badges: [] });
	const request = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ data: { users: { userByConnection: { style: { activeBadge: { id: "founder", name: "Founder", images: [{ url: "https://cdn.7tv.app/badge/founder/2x.webp", scale: 2, mime: "image/webp" }] } } } } } }));
	try {
		send("123456789");
		const first = await pollAwardChat(eventId, secret);
		expect(first).toMatchObject({ ok: true, messages: expect.arrayContaining([expect.objectContaining({ userId: "123456789", sevenTvBadge: { id: "founder", name: "Founder", url: "https://cdn.7tv.app/badge/founder/2x.webp" } })]) });
		await pollAwardChat(eventId, secret);
		expect(request).toHaveBeenCalledTimes(1);
		request.mockRejectedValue(new Error("7TV temporarily unavailable"));
		send("987654321");
		expect(await pollAwardChat(eventId, secret)).toMatchObject({ ok: true, messages: expect.arrayContaining([expect.objectContaining({ userId: "987654321", text: "Badge test" })]) });
	} finally {
		request.mockRestore();
	}
});
