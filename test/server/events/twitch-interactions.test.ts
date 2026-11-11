/** @jest-environment node */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { usersTable, awardEventsTable, awardCandidatesTable, awardVotesTable } from "@/db/schema";
import { account } from "@/db/auth-schema";
import { Role, Plan } from "@/app/lib/types";
import { createAwardConfiguration } from "@/app/lib/eventDefaults";
let fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>;
jest.mock("@/db/client", () => ({
	get db() {
		return fixture.db;
	},
	dbPool: {},
}));
jest.mock("@/auth/config", () => ({ auth: { api: { getAccessToken: jest.fn(async () => ({ accessToken: "isolated-access-token" })) } } }));
jest.mock("@/server/provider-credentials", () => ({ withSerializedProviderCredential: jest.fn((_pool, _id, read) => read()) }));
jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (principal: { authUserId: string }) => {
		if (principal.authUserId !== "auth-host") throw new Error("ACCESS_DENIED");
		return { assertAuthorityCurrent() {} };
	}),
}));
jest.mock("@/server/runner/provider-api", () => ({ requestProviderJson: jest.fn() }));
import { requestProviderJson } from "@/server/runner/provider-api";
import { eventTwitchConnection, runEventInteraction } from "@/server/events/twitch-interactions";
let eventId: string, slideId: string, categoryId: string, winnerId: string;
let current: { id: string; status: string; outcomes?: { id: string; title: string }[]; choices?: { id: string; title: string }[] } | null;
const now = new Date("2026-02-04T00:00:00Z");
const secret = "s".repeat(43);
const principal = { kind: "session" as const, authUserId: "auth-host", sessionId: "session", authenticatedAt: now };
beforeEach(async () => {
	fixture = await createMcpPostgresFixture();
	await fixture.db.insert(usersTable).values({ id: "host", username: "host", email: "host@example.invalid", avatar: "", role: Role.User, plan: Plan.Free });
	await fixture.pool.query('INSERT INTO auth."user"(id,name,email) VALUES($1,$2,$3)', ["auth-host", "Host", "host-auth@example.invalid"]);
	await fixture.db.insert(account).values({ id: "twitch-account", accountId: "host", userId: "auth-host", providerId: "twitch", scope: "openid user:read:email channel:manage:polls channel:manage:predictions" });
	const configuration = createAwardConfiguration("Awards", "UTC");
	configuration.schedule = { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-02T00:00:00Z", votingEnd: "2026-02-03T00:00:00Z", timezone: "UTC", reviewRequired: true };
	categoryId = configuration.categories[0].id;
	slideId = randomUUID();
	configuration.slides = [{ id: slideId, type: "category", categoryId, title: "", text: "", statistics: [], interaction: { type: "prediction", wait: true, duration: 60 } }];
	const { presenterDigest } = await import("@/server/events/persistence");
	const [event] = await fixture.db
		.insert(awardEventsTable)
		.values({ ownerId: "host", configuration, presenterDigest: presenterDigest(secret), publishedAt: new Date("2025-12-01"), reviewReleased: true })
		.returning();
	eventId = event.id;
	for (let i = 0; i < 3; i++) {
		const [candidate] = await fixture.db
			.insert(awardCandidatesTable)
			.values({ eventId, categoryId, canonicalKey: `clip:nominee${i}`, nominated: true, content: { kind: "clip", reference: `nominee${i}`, title: "A long nominee name whose start is intentionally identical", description: "", creatorId: "host" } })
			.returning();
		if (i === 0) winnerId = candidate.id;
	}
	await fixture.db.insert(awardVotesTable).values({ eventId, categoryId, candidateId: winnerId, authUserId: "auth-host" });
	current = null;
	jest
		.mocked(requestProviderJson)
		.mockReset()
		.mockImplementation(async (_url, init = {}) => {
			const body = init.body ? JSON.parse(String(init.body)) : {};
			if (init.method === "POST") {
				const options = body.outcomes ?? body.choices;
				current = { id: "remote-interaction", status: "ACTIVE", [body.outcomes ? "outcomes" : "choices"]: options.map((option: { title: string }, index: number) => ({ ...option, id: `option-${index}` })) };
			}
			if (init.method === "PATCH" && current) current = { ...current, status: body.status };
			return { data: current ? [current] : [] };
		});
}, 30000);
afterEach(async () => {
	await fixture?.close();
}, 30000);

it("requests feature access on the existing Twitch link and rejects other users", async () => {
	const result = await eventTwitchConnection(principal, "host", "poll", eventId);
	expect(result).toMatchObject({ ok: true, poll: true, canAuthorize: true, link: { provider: "twitch" } });
	if (result.ok && "link" in result) expect(result.link?.scopes).toContain("channel:manage:polls");
	expect(await eventTwitchConnection(principal, "host", "other" as never, eventId)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await eventTwitchConnection({ ...principal, authUserId: "other" }, "host", "poll", eventId)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
});

it("reuses the same prediction across concurrent starts and preserves distinct nominee options", async () => {
	const starts = await Promise.all([runEventInteraction(eventId, secret, slideId, "start", now), runEventInteraction(eventId, secret, slideId, "start", now)]);
	expect(starts).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
	const posts = jest.mocked(requestProviderJson).mock.calls.filter(([, init]) => init?.method === "POST");
	expect(posts).toHaveLength(1);
	const payload = JSON.parse(String(posts[0][1]!.body));
	expect(new Set(payload.outcomes.map((choice: { title: string }) => choice.title)).size).toBe(3);
	expect(payload.outcomes.every((choice: { title: string }) => Array.from(choice.title).length <= 25)).toBe(true);
});

it("waits for the entry window before resolving the actual event winner", async () => {
	expect(await runEventInteraction(eventId, secret, slideId, "start", now)).toMatchObject({ ok: true, state: { status: "ACTIVE" } });
	expect(await runEventInteraction(eventId, secret, slideId, "resolve", now)).toMatchObject({ ok: true, state: { status: "ACTIVE" } });
	const result = await runEventInteraction(eventId, secret, slideId, "resolve", new Date(now.getTime() + 61000));
	expect(result).toMatchObject({ ok: true, state: { status: "RESOLVED" } });
	const resolved = jest
		.mocked(requestProviderJson)
		.mock.calls.map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : null))
		.find((body) => body?.status === "RESOLVED");
	if (!result.ok || !result.state) throw new Error("Missing resolved state");
	expect(resolved.winning_outcome_id).toBe(result.state.outcomes[winnerId]);
});

it("rejects an oversized poll without silently omitting nominees", async () => {
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.slides[0].interaction!.type = "poll";
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	for (let i = 3; i < 6; i++) await fixture.db.insert(awardCandidatesTable).values({ eventId, categoryId, canonicalKey: `clip:nominee${i}`, nominated: true, content: { kind: "clip", reference: `nominee${i}`, title: `Nominee ${i}`, description: "", creatorId: "host" } });
	expect(await runEventInteraction(eventId, secret, slideId, "start", now)).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
	expect(requestProviderJson).not.toHaveBeenCalled();
});

it("denies read-only preview credentials and lets the host skip a provider outage", async () => {
	expect(await runEventInteraction(eventId, "preview-token", slideId, "start", now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(requestProviderJson).not.toHaveBeenCalled();
	jest.mocked(requestProviderJson).mockRejectedValue(new Error("unavailable"));
	expect(await runEventInteraction(eventId, secret, slideId, "start", now)).toMatchObject({ ok: false });
	expect(await runEventInteraction(eventId, secret, slideId, "skip", now)).toMatchObject({ ok: true, state: { status: "SKIPPED" } });
	expect(await runEventInteraction(eventId, secret, slideId, "start", now)).toMatchObject({ ok: true, state: { status: "SKIPPED" } });
});

it("warns the host when a running prediction could not be canceled", async () => {
	await runEventInteraction(eventId, secret, slideId, "start", now);
	jest.mocked(requestProviderJson).mockRejectedValue(new Error("unavailable"));
	expect(await runEventInteraction(eventId, secret, slideId, "skip", now)).toMatchObject({ ok: true, state: { status: "SKIPPED", manualCheck: true } });
});
it("refunds a prediction when the award has a shared winner", async () => {
	const candidates = await fixture.db.select().from(awardCandidatesTable);
	await fixture.db.insert(awardVotesTable).values({ eventId, categoryId, candidateId: candidates.find((c) => c.id !== winnerId)!.id, authUserId: "auth-host" });
	await runEventInteraction(eventId, secret, slideId, "start", now);
	expect(await runEventInteraction(eventId, secret, slideId, "resolve", new Date(now.getTime() + 61000))).toMatchObject({ ok: true, state: { status: "CANCELED" } });
});

it("can skip the previous interaction after the slide interaction type changes", async () => {
	await runEventInteraction(eventId, secret, slideId, "start", now);
	const [event] = await fixture.db.select().from(awardEventsTable);
	event.configuration.slides[0].interaction!.type = "poll";
	await fixture.db.update(awardEventsTable).set({ configuration: event.configuration }).where(eq(awardEventsTable.id, eventId));
	expect(await runEventInteraction(eventId, secret, slideId, "skip", now)).toMatchObject({ ok: true, state: { status: "SKIPPED", manualCheck: false } });
	expect(current?.status).toBe("CANCELED");
});
