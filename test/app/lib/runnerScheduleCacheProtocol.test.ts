/** @jest-environment node */
import { verifyScheduleCacheManifest, verifyExecutionBundle, ProExecutionPermit, hashScheduledExecutionPayload } from "../../../packages/runner/src/protocol";
import { scheduleAuthorizationFixture } from "../../../packages/runner/test/support/schedule-fixture";

const invalidClaims: [string, Record<string, unknown>][] = [
	["foreign issuer", { issuer: "foreign.example" }],
	["different purpose", { kind: "execution" }],
	["unknown version", { version: 2 }],
	["foreign device", { runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
	["foreign owner", { ownerId: "foreign" }],
	["empty owner", { ownerId: "" }],
	["oversized owner", { ownerId: "a".repeat(257) }],
	["different nonce", { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
	["future issuance", { issuedAt: 1000001 }],
	["negative issuance", { issuedAt: -1 }],
	["fractional issuance", { issuedAt: 1000000.5 }],
	["expired authority", { expiresAt: 1000000 }],
	["beyond seven days", { expiresAt: 605800001 }],
	["zero revision", { configurationRevision: 0 }],
	["fractional revision", { configurationRevision: 1.5 }],
	["missing policy", { capabilities: null }],
	["non-boolean paid policy", { capabilities: { runnerPro: "true", scheduling: true, validUntil: null } }],
	["conflicting scheduling policy", { capabilities: { runnerPro: true, scheduling: false, validUntil: null } }],
	["unreadable paid boundary", { capabilities: { runnerPro: true, scheduling: true, validUntil: "invalid" } }],
	["authority past paid boundary", { capabilities: { runnerPro: true, scheduling: true, validUntil: new Date(1000001).toISOString() } }],
	["missing entries", { entries: null }],
	["oversized entry inventory", { entries: Array(1025).fill(null) }],
	["non-object entry", { entries: [null] }],
	["Free start authority", { capabilities: { runnerPro: false, scheduling: false, validUntil: null } }],
];
test.each(invalidClaims)("TDD-US3-FR012 root protocol baseline: signed %s does not grant device cache authority", (_reason, patch) => {
	const fixture = scheduleAuthorizationFixture(),
		requestId = "11111111-1111-4111-8111-111111111111";
	const response = fixture.response(requestId),
		claims = JSON.parse(Buffer.from(response.scheduleCache.bundle.payload, "base64url").toString("utf8")) as Record<string, unknown>;
	expect(verifyScheduleCacheManifest(fixture.signed({ ...claims, ...patch }), fixture.keys, { ownerId: fixture.ownerId, runnerId: fixture.runnerId, requestId }, 1000000)).toBeNull();
});

test.each([
	["duplicate admission", "duplicate"],
	["invalid admission", "admissionId"],
	["empty occurrence", "occurrenceId"],
	["oversized occurrence", "longOccurrence"],
	["invalid authorization digest", "authorizationHash"],
])("TDD-US3-FR012 root protocol baseline: %s cannot enter the signed inventory", (_reason, variant) => {
	const fixture = scheduleAuthorizationFixture(),
		requestId = "11111111-1111-4111-8111-111111111111";
	const response = fixture.response(requestId),
		claims = JSON.parse(Buffer.from(response.scheduleCache.bundle.payload, "base64url").toString("utf8")) as Record<string, unknown>;
	const original = (claims.entries as Record<string, unknown>[])[0];
	claims.entries = variant === "duplicate" ? [original, original] : [{ ...original, ...(variant === "longOccurrence" ? { occurrenceId: "a".repeat(1025) } : { [variant]: "" }) }];
	expect(verifyScheduleCacheManifest(fixture.signed(claims), fixture.keys, { runnerId: fixture.runnerId, requestId }, 1000000)).toBeNull();
});

test("TDD-US3-FR012 root protocol baseline: a verified Free refresh may carry an empty inventory without authorizing starts", () => {
	const fixture = scheduleAuthorizationFixture(),
		requestId = "11111111-1111-4111-8111-111111111111";
	const response = fixture.response(requestId),
		claims = JSON.parse(Buffer.from(response.scheduleCache.bundle.payload, "base64url").toString("utf8")) as Record<string, unknown>;
	const signed = fixture.signed({ ...claims, capabilities: { runnerPro: false, scheduling: false, validUntil: null }, entries: [] });
	expect(verifyScheduleCacheManifest(signed, fixture.keys, { ownerId: fixture.ownerId, runnerId: fixture.runnerId, requestId }, 1000000)?.entries).toEqual([]);
});

function boundAuthorization() {
	const fixture = scheduleAuthorizationFixture(),
		requestId = "11111111-1111-4111-8111-111111111111";
	const job = fixture.response(requestId).scheduleCache.entries[0].job;
	const claims = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8")) as Record<string, unknown>;
	const expected = {
		ownerId: fixture.ownerId,
		runnerId: fixture.runnerId,
		sessionId: job.id,
		admissionId: job.admissionId,
		generation: job.executionGeneration,
		leaseId: String(claims.leaseId),
		requestId,
		sourceId: job.overlayId,
		sourceRevision: job.sourceRevision,
		configurationRevision: job.configurationRevision,
		targetHash: job.targetHash,
		cacheAuthorization: true as const,
		occurrenceId: job.occurrenceId,
		scheduledStart: job.scheduledStart,
		scheduledEnd: job.scheduledEnd,
		executionPayloadHash: hashScheduledExecutionPayload(job),
	};
	return { ...fixture, job, expected, claims, requestId };
}

test.each([
	["missing cache opt-in", { cacheAuthorization: undefined }],
	["empty occurrence", { occurrenceId: "" }],
	["changed occurrence", { occurrenceId: "another-occurrence" }],
	["missing original start", { scheduledStart: undefined }],
	["changed original start", { scheduledStart: 1010001 }],
	["negative original start", { scheduledStart: -1 }],
	["changed original end", { scheduledEnd: 1020001 }],
	["missing private digest", { executionPayloadHash: undefined }],
	["malformed private digest", { executionPayloadHash: "invalid" }],
	["changed private digest", { executionPayloadHash: "c".repeat(64) }],
	["wrong policy", { policy: "free_lease" }],
	["excess validity", { expiresAt: 605800001 }],
] as const)("TDD-US3-FR012 root authorization baseline: signed %s cannot substitute a captured execution", (_reason, patch) => {
	const fixture = boundAuthorization();
	expect(verifyExecutionBundle(fixture.signed({ ...fixture.claims, ...patch }), fixture.keys, fixture.expected, 1000000)).toBeNull();
});

test("TDD-US3-FR012 root authorization baseline: purpose binding and restored monotonic start/end remain enforced by the application compilation", () => {
	const fixture = boundAuthorization();
	expect(verifyExecutionBundle(fixture.job.lease, fixture.keys, fixture.expected, 1000000)).toEqual(fixture.claims);
	const { cacheAuthorization, ...manual } = fixture.expected;
	expect(cacheAuthorization).toBe(true);
	expect(verifyExecutionBundle(fixture.job.lease, fixture.keys, manual, 1000000)).toBeNull();
	let elapsed = 0;
	const guard = new ProExecutionPermit(fixture.expected, fixture.keys, () => elapsed);
	const request = { requestId: fixture.requestId, sentAt: -15000 };
	expect(guard.beginRenewal(request)).toBe(request.requestId);
	expect(guard.accept(fixture.job.lease)).toBe(true);
	expect(guard.deadlineMonotonic).toBe(5000);
	elapsed = 5000;
	expect(guard.state).toBe("draining");
});
