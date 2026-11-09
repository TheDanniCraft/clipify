/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import { drizzle } from "drizzle-orm/pglite";
import type { PGlite as Database } from "@electric-sql/pglite";
let client: ReturnType<typeof drizzle>;
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({
	get db() {
		return client;
	},
}));
jest.mock("@/server/resources/mutation", () => ({
	authorizeLockedMutation: jest.fn(async (principal: { authUserId: string }, ownerId: string) => {
		if (principal.authUserId !== ownerId) throw new Error("ACCESS_DENIED");
		return { creator: { id: ownerId }, assertAuthorityCurrent() {} };
	}),
}));
jest.mock("@/app/lib/entitlements", () => ({ resolveUserEntitlements: jest.fn(async () => ({ proAccess: false, partner: false })) }));
import { createAwardEvent, updateAwardEvent, readAwardEvent } from "@/server/events/persistence";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: Database;
const principal: TrustedCreatorPrincipal = { kind: "session", authUserId: "host", authenticatedAt: new Date(), sessionId: "session" };
const config = {
	title: "Babbler Awards",
	description: "",
	visibility: "unlisted",
	schedule: { submissionsStart: "2026-01-01T00:00:00Z", submissionsEnd: "2026-02-01T00:00:00Z", votingStart: "2026-02-08T00:00:00Z", votingEnd: "2026-02-15T00:00:00Z", timezone: "UTC", reviewRequired: true },
	votesPerCategory: 1,
	tiePolicy: "shared",
	resultDetail: "votes",
	whiteLabel: false,
	categories: [{ id: "8c317b25-5083-4cae-b939-0487a7fa8ff6", title: "Fail", group: "", source: "clip", selection: "audience", submissionLimit: 1, nomineeLimit: 6, rules: {}, options: [] }],
	slides: [],
};
beforeAll(async () => {
	database = new PGlite();
	client = drizzle(database);
	await database.exec(`CREATE TABLE users (id varchar PRIMARY KEY); INSERT INTO users VALUES ('host');
 CREATE TABLE award_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id varchar NOT NULL REFERENCES users(id), configuration jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, published_at timestamptz, results_published_at timestamptz, review_released boolean NOT NULL DEFAULT false, presenter_digest varchar NOT NULL, frozen_at timestamptz, frozen_results jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE award_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES award_events(id) ON DELETE CASCADE, category_id uuid NOT NULL, canonical_key varchar NOT NULL, content jsonb NOT NULL, nominated boolean NOT NULL DEFAULT false, parent_id uuid REFERENCES award_candidates(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,category_id,canonical_key));
 CREATE TABLE award_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES award_events(id) ON DELETE CASCADE, category_id uuid NOT NULL, candidate_id uuid NOT NULL REFERENCES award_candidates(id), auth_user_id varchar NOT NULL, original jsonb NOT NULL, withdrawn_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE award_votes (event_id uuid NOT NULL REFERENCES award_events(id) ON DELETE CASCADE, category_id uuid NOT NULL, candidate_id uuid NOT NULL REFERENCES award_candidates(id), auth_user_id varchar NOT NULL, PRIMARY KEY(category_id,candidate_id,auth_user_id));
`);
}, 30000);
afterAll(async () => {
	await database?.close();
});
beforeEach(async () => {
	await database.exec("TRUNCATE award_votes, award_submissions, award_candidates, award_events CASCADE");
});
it("persists a validated event and returns the presenter secret only at creation", async () => {
	const created = await createAwardEvent(principal, "host", config);
	expect(created.ok).toBe(true);
	if (!created.ok) throw new Error("creation failed");
	expect(created.presenterSecret).toHaveLength(43);
	const read = await readAwardEvent(principal, "host", created.event.id);
	expect(read.ok).toBe(true);
	if (read.ok) {
		expect(read.event.configuration.title).toBe(config.title);
		expect(read.event).not.toHaveProperty("presenterDigest");
	}
	const rows = await database.query<{ presenter_digest: string }>("SELECT presenter_digest FROM award_events");
	expect(rows.rows[0].presenter_digest).not.toBe(created.presenterSecret);
});
it("rejects foreign creator authority without inserting", async () => {
	expect(await createAwardEvent({ ...principal, authUserId: "other" }, "host", config)).toMatchObject({ ok: false, code: "ACCESS_DENIED" });
	expect((await database.query("SELECT * FROM award_events")).rows).toHaveLength(0);
});
it("rejects malformed input before writes", async () => expect(await createAwardEvent(principal, "host", { ...config, title: "" })).toMatchObject({ ok: false, code: "INVALID_INPUT" }));
it("rejects stale saves and retains the successful draft", async () => {
	const created = await createAwardEvent(principal, "host", config);
	if (!created.ok) throw new Error("creation failed");
	expect(await updateAwardEvent(principal, "host", created.event.id, 1, { ...config, title: "New title" })).toMatchObject({ ok: true, event: { revision: 2 } });
	expect(await updateAwardEvent(principal, "host", created.event.id, 1, { ...config, title: "Stale" })).toMatchObject({ ok: false, code: "CONFLICT" });
	expect(await readAwardEvent(principal, "host", created.event.id)).toMatchObject({ ok: true, event: { configuration: { title: "New title" } } });
});

import { publishAwardEvent, publishAwardResults, rotateAwardPresenterSecret } from "@/server/events/lifecycle";
it("publishes announcement but never results until voting has ended", async () => {
	const created = await createAwardEvent(principal, "host", config);
	if (!created.ok) throw new Error("creation failed");
	expect(await publishAwardEvent(principal, "host", created.event.id, 1, new Date("2025-12-01"))).toMatchObject({ ok: true, event: { revision: 2 } });
	expect(await updateAwardEvent(principal, "host", created.event.id, 2, config)).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
	expect(await publishAwardResults(principal, "host", created.event.id, new Date(config.schedule.votingStart))).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
	expect(await publishAwardResults(principal, "host", created.event.id, new Date(config.schedule.votingEnd))).toMatchObject({ ok: true });
	expect(await publishAwardResults(principal, "host", created.event.id, new Date(config.schedule.votingEnd))).toMatchObject({ ok: true });
});
it("rotates presenter capability without disclosing its digest", async () => {
	const created = await createAwardEvent(principal, "host", config);
	if (!created.ok) throw new Error("creation failed");
	const rotated = await rotateAwardPresenterSecret(principal, "host", created.event.id);
	expect(rotated).toMatchObject({ ok: true, presenterSecret: expect.any(String) });
	if (rotated.ok) expect(rotated.presenterSecret).not.toBe(created.presenterSecret);
});

import { submitAwardCandidate, withdrawAwardSubmission, ownAwardSubmissions } from "@/server/events/submissions";
const candidate = { kind: "text", reference: "", title: "hahaha die Lampe", description: "Stromausfall" };
it("enforces personal quota, retains originals and releases quota on withdrawal", async () => {
	const event = await createAwardEvent(principal, "host", { ...config, categories: [{ ...config.categories[0], source: "text" }] });
	if (!event.ok) throw new Error("creation failed");
	await publishAwardEvent(principal, "host", event.event.id, 1, new Date("2025-12-01"));
	const now = new Date("2026-01-15");
	const categoryId = config.categories[0].id;
	const first = await submitAwardCandidate("viewer", event.event.id, categoryId, candidate, now);
	expect(first).toMatchObject({ ok: true });
	expect(await submitAwardCandidate("viewer", event.event.id, categoryId, { ...candidate, title: "Besserer Vorschlag" }, now)).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
	if (!first.ok) throw new Error("submit failed");
	expect(await withdrawAwardSubmission("other", event.event.id, first.submission.id, now)).toMatchObject({ ok: false, code: "NOT_FOUND" });
	expect(await ownAwardSubmissions("viewer", event.event.id)).toMatchObject({ ok: true, submissions: [{ original: { title: candidate.title } }] });
	expect(await withdrawAwardSubmission("viewer", event.event.id, first.submission.id, now)).toMatchObject({ ok: true });
	expect(await submitAwardCandidate("viewer", event.event.id, categoryId, { ...candidate, title: "Besserer Vorschlag" }, now)).toMatchObject({ ok: true });
	expect(await submitAwardCandidate("viewer", event.event.id, categoryId, candidate, new Date(config.schedule.submissionsEnd))).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
});
it("rejects fabricated source type for a category", async () => {
	const event = await createAwardEvent(principal, "host", config);
	if (!event.ok) throw new Error("creation failed");
	await publishAwardEvent(principal, "host", event.event.id, 1, new Date("2025-12-01"));
	expect(await submitAwardCandidate("viewer", event.event.id, config.categories[0].id, candidate, new Date("2026-01-15"))).toMatchObject({ ok: false, code: "INVALID_INPUT" });
});

import { groupAwardCandidates, nominateAwardCandidates, releaseAwardReview } from "@/server/events/review";
import { saveAwardVotes } from "@/server/events/voting";
it("groups originals into one nominee and enforces global voting limits and server close", async () => {
	const event = await createAwardEvent(principal, "host", { ...config, categories: [{ ...config.categories[0], source: "text", submissionLimit: null }] });
	if (!event.ok) throw new Error("creation failed");
	await publishAwardEvent(principal, "host", event.event.id, 1, new Date("2025-12-01"));
	const first = await submitAwardCandidate("a", event.event.id, config.categories[0].id, candidate, new Date("2026-01-15"));
	const second = await submitAwardCandidate("b", event.event.id, config.categories[0].id, { ...candidate, title: "Lampe explodiert" }, new Date("2026-01-15"));
	if (!first.ok || !second.ok) throw new Error("submit failed");
	const grouped = await groupAwardCandidates(principal, "host", event.event.id, config.categories[0].id, [first.submission.candidateId, second.submission.candidateId], "Lampe raucht ab", new Date("2026-02-02"));
	expect(grouped).toMatchObject({ ok: true });
	if (!grouped.ok) throw new Error("group failed");
	expect(await nominateAwardCandidates(principal, "host", event.event.id, config.categories[0].id, [first.submission.candidateId], new Date("2026-02-02"))).toMatchObject({ ok: false, code: "INVALID_INPUT" });
	expect(await nominateAwardCandidates(principal, "host", event.event.id, config.categories[0].id, [grouped.candidate.id], new Date("2026-02-02"))).toMatchObject({ ok: true });
	expect(await ownAwardSubmissions("a", event.event.id)).toMatchObject({ ok: true, submissions: [{ original: { title: candidate.title } }] });
	expect(await releaseAwardReview(principal, "host", event.event.id, new Date("2026-02-03"))).toMatchObject({ ok: true });
	expect(await saveAwardVotes("a", event.event.id, config.categories[0].id, [grouped.candidate.id], new Date(config.schedule.votingStart))).toMatchObject({ ok: true });
	expect(await saveAwardVotes("a", event.event.id, config.categories[0].id, [grouped.candidate.id, first.submission.candidateId], new Date(config.schedule.votingStart))).toMatchObject({ ok: false, code: "LIMIT_REACHED" });
	expect(await saveAwardVotes("a", event.event.id, config.categories[0].id, [], new Date(config.schedule.votingStart))).toMatchObject({ ok: true });
	expect(await saveAwardVotes("a", event.event.id, config.categories[0].id, [grouped.candidate.id], new Date(config.schedule.votingEnd))).toMatchObject({ ok: false, code: "PHASE_CLOSED" });
});
