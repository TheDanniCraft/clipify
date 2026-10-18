/** @jest-environment node */
import { deriveRunnerCapabilities } from "@/server/runner/capabilities";
import { randomUUID, generateKeyPairSync, sign } from "node:crypto";
import * as executionProtocol from "../../../packages/runner/src/protocol";

const { ProExecutionPermit } = executionProtocol;

function ownerSnapshotFixture() {
	const keys = generateKeyPairSync("ed25519"),
		issuedAt = 1000000;
	const identity = { ownerId: "owner", runnerId: randomUUID(), requestId: randomUUID(), configurationRevision: 1 };
	const capabilities = deriveRunnerCapabilities({ proAccess: true, runnerAccess: false, validUntil: new Date(issuedAt + 60000) }, new Date(issuedAt));
	const claims = { ...identity, issuer: "clipify.us", kind: "benefits", issuedAt, expiresAt: issuedAt + 60000, capabilities };
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const bundle = { keyId: "test-key", payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString("base64url") };
	const trusted = { "test-key": keys.publicKey.export({ type: "spki", format: "pem" }).toString() };
	const encode = (overrides: Record<string, unknown>) => {
		const updated = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url");
		return { keyId: "test-key", payload: updated, signature: sign(null, Buffer.from(updated), keys.privateKey).toString("base64url") };
	};
	return { identity, capabilities, claims, payload, bundle, trusted, issuedAt, encode };
}

test("TDD-US5-CON015: signed owner benefit snapshots bind the owner, device, request and known validity", () => {
	const verify = Reflect.get(executionProtocol, "verifyRunnerBenefitSnapshot");
	expect(verify).toEqual(expect.any(Function));
	if (typeof verify !== "function") return;
	const { identity, capabilities, claims, bundle, trusted, issuedAt } = ownerSnapshotFixture();
	expect(verify(bundle, trusted, identity, issuedAt + 59999)).toMatchObject({ ...identity, capabilities: { runnerPro: true, attributionRequired: false } });
	for (const foreign of [{ ownerId: "operator" }, { runnerId: randomUUID() }, { requestId: randomUUID() }, { configurationRevision: 2 }]) expect(verify(bundle, trusted, { ...identity, ...foreign }, issuedAt)).toBeNull();
	expect(verify(bundle, trusted, identity, issuedAt + 60000)).toBeNull();
	const tampered = Buffer.from(JSON.stringify({ ...claims, capabilities: { ...capabilities, runnerPro: false } })).toString("base64url");
	expect(verify({ ...bundle, payload: tampered }, trusted, identity, issuedAt)).toBeNull();
});

test("TDD-US5-CON015 U276: cached owner benefits expire on elapsed time despite PC wall-clock rollback", () => {
	const Guard = Reflect.get(executionProtocol, "RunnerBenefitSnapshotGuard");
	expect(Guard).toEqual(expect.any(Function));
	if (typeof Guard !== "function") return;
	const { identity, bundle, trusted } = ownerSnapshotFixture();
	let monotonic = 100;
	const options = { ownerId: identity.ownerId, runnerId: identity.runnerId, keys: trusted, clock: () => monotonic };
	const guard = new Guard(options);
	expect(guard.runnerPro).toBe(false);
	expect(guard.accept(bundle, { requestId: identity.requestId, sentAt: 100 })).toBe(true);
	monotonic = 60099;
	expect(guard.runnerPro).toBe(true);
	const originalNow = Date.now;
	Date.now = () => 0;
	try {
		monotonic = 60100;
		expect(guard.runnerPro).toBe(false);
		expect(guard.capabilities).toBeNull();
		const delayed = new Guard(options);
		expect(delayed.accept(bundle, { requestId: identity.requestId, sentAt: 100 })).toBe(false);
		expect(delayed.runnerPro).toBe(false);
	} finally {
		Date.now = originalNow;
	}
});

function scheduledPermitFixture() {
	const keys = generateKeyPairSync("ed25519");
	const issuedAt = Date.parse("2026-10-20T12:00:00.000Z");
	const identity = { ownerId: "owner", runnerId: randomUUID(), sessionId: randomUUID(), generation: randomUUID(), targetHash: "captured-targets", configurationRevision: 1, sourceRevision: 1, sourceId: randomUUID(), admissionId: randomUUID(), leaseId: randomUUID(), scheduledEnd: issuedAt + 120000 };
	const requestId = randomUUID();
	const claims = { ...identity, requestId, issuer: "clipify.us", kind: "execution", policy: "pro_broadcast", issuedAt, expiresAt: issuedAt + 60000 };
	const signed = (overrides: Record<string, unknown> = {}) => {
		const payload = Buffer.from(JSON.stringify({ ...claims, ...overrides })).toString("base64url");
		return { keyId: "test-key", payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString("base64url") };
	};
	return { identity, requestId, issuedAt, signed, keys: { "test-key": keys.publicKey.export({ type: "spki", format: "pem" }).toString() } };
}

test("TDD-US5-CON015 U275: the polling cache learns identity only from a verified profile and never rebinds it", () => {
	const Cache = Reflect.get(executionProtocol, "RunnerBenefitSnapshotCache");
	expect(Cache).toEqual(expect.any(Function));
	if (typeof Cache !== "function") return;
	const fixture = ownerSnapshotFixture();
	const request = { requestId: fixture.identity.requestId, sentAt: 0 };
	const bootstrap = new Cache({ keys: fixture.trusted, clock: () => 0 });
	expect(bootstrap.accept({ ...fixture.bundle, signature: "invalid" }, request)).toBe(false);
	expect(bootstrap.scope).toBeNull();
	expect(bootstrap.runnerPro).toBe(false);
	expect(bootstrap.accept(fixture.bundle, request)).toBe(true);
	expect(bootstrap.scope).toEqual({ ownerId: fixture.identity.ownerId, runnerId: fixture.identity.runnerId });
	expect(bootstrap.runnerPro).toBe(true);
	const foreign = fixture.encode({ runnerId: randomUUID(), ownerId: "operator" });
	expect(bootstrap.accept(foreign, request)).toBe(false);
	expect(bootstrap.runnerPro).toBe(false);
	expect(bootstrap.scope).toEqual({ ownerId: fixture.identity.ownerId, runnerId: fixture.identity.runnerId });
	const pinned = new Cache({ runnerId: randomUUID(), keys: fixture.trusted, clock: () => 0 });
	expect(pinned.accept(fixture.bundle, request)).toBe(false);
	expect(pinned.scope).toBeNull();
});

test.each(["revision", "issuance", "same-time"])("TDD-US5-CON015 U276: stale signed %s cannot restore paid authorization after baseline policy", (stale) => {
	const Guard = Reflect.get(executionProtocol, "RunnerBenefitSnapshotGuard");
	expect(Guard).toEqual(expect.any(Function));
	if (typeof Guard !== "function") return;
	const fixture = ownerSnapshotFixture();
	let monotonic = 0;
	const guard = new Guard({ ownerId: fixture.identity.ownerId, runnerId: fixture.identity.runnerId, keys: fixture.trusted, clock: () => monotonic });
	const firstTime = fixture.issuedAt + (stale === "revision" ? 0 : 10000);
	const firstRevision = stale === "revision" ? 2 : 1;
	const baseline = deriveRunnerCapabilities({ proAccess: false, runnerAccess: false }, new Date(firstTime));
	expect(guard.accept(fixture.encode({ issuedAt: firstTime, configurationRevision: firstRevision, capabilities: baseline }), { requestId: fixture.identity.requestId, sentAt: 0 })).toBe(true);
	expect(guard.runnerPro).toBe(false);
	monotonic = 1000;
	const requestId = randomUUID(),
		issuedAt = stale === "same-time" ? firstTime : fixture.issuedAt + (stale === "issuance" ? 5000 : 1000);
	const oldPaid = fixture.encode({ requestId, issuedAt, configurationRevision: 1, capabilities: { ...fixture.capabilities, evaluatedAt: new Date(issuedAt).toISOString() } });
	expect(guard.accept(oldPaid, { requestId, sentAt: monotonic })).toBe(false);
	expect(guard.runnerPro).toBe(false);
});

test("TDD-US5-CON015 U276: refreshing the same known policy end cannot extend its elapsed deadline", () => {
	const Guard = Reflect.get(executionProtocol, "RunnerBenefitSnapshotGuard");
	expect(Guard).toEqual(expect.any(Function));
	if (typeof Guard !== "function") return;
	const fixture = ownerSnapshotFixture();
	let monotonic = 0;
	const guard = new Guard({ ownerId: fixture.identity.ownerId, runnerId: fixture.identity.runnerId, keys: fixture.trusted, clock: () => monotonic });
	expect(guard.accept(fixture.bundle, { requestId: fixture.identity.requestId, sentAt: 0 })).toBe(true);
	monotonic = 30000;
	const requestId = randomUUID(),
		issuedAt = fixture.issuedAt + 10000;
	const refreshed = fixture.encode({ requestId, issuedAt, capabilities: { ...fixture.capabilities, evaluatedAt: new Date(issuedAt).toISOString() } });
	expect(guard.accept(refreshed, { requestId, sentAt: monotonic })).toBe(true);
	monotonic = 60000;
	expect(guard.runnerPro).toBe(false);
});

test("TDD-US5-CON015 U277: accepted paid execution preserves its captured scheduled end after benefits expire", () => {
	const fixture = scheduledPermitFixture();
	let monotonic = 0;
	const permit = new ProExecutionPermit(fixture.identity, fixture.keys, () => monotonic);
	permit.beginRenewal({ requestId: fixture.requestId, sentAt: 0 });
	expect(permit.accept(fixture.signed())).toBe(true);
	monotonic = 119999;
	expect(permit.state).toBe("active");
	monotonic = 120000;
	expect(permit.state).toBe("draining");
	expect(permit.deadlineMonotonic).toBe(120000);
});

test("TDD-US5-CON015 U277: a server clock rollback during renewal cannot extend a captured local end", () => {
	const fixture = scheduledPermitFixture();
	let monotonic = 0;
	const permit = new ProExecutionPermit(fixture.identity, fixture.keys, () => monotonic);
	permit.beginRenewal({ requestId: fixture.requestId, sentAt: 0 });
	expect(permit.accept(fixture.signed())).toBe(true);
	monotonic = 60000;
	const requestId = randomUUID();
	permit.beginRenewal({ requestId, sentAt: monotonic });
	expect(permit.accept(fixture.signed({ requestId, issuedAt: fixture.issuedAt + 10000, expiresAt: fixture.issuedAt + 70000 }))).toBe(true);
	monotonic = 120000;
	expect(permit.state).toBe("draining");
	expect(permit.deadlineMonotonic).toBe(120000);
});

describe("TDD-US5-CON015 U276: known paid validity is a boundary for new paid starts", () => {
	const end = new Date("2026-10-20T12:00:00.000Z");
	test.each(["pro", "legacy"] as const)("%s benefits expire exactly at the known deadline", (source) => {
		const benefits = { proAccess: source === "pro", runnerAccess: source === "legacy", validUntil: end };
		expect(deriveRunnerCapabilities(benefits, new Date(end.getTime() - 1))).toMatchObject({ runnerPro: true, scheduling: true });
		for (const now of [end, new Date(end.getTime() + 1)]) {
			expect(deriveRunnerCapabilities(benefits, now)).toMatchObject({ basicAccess: true, runnerPro: false, scheduling: false, customStandby: false, attributionRequired: true, maxTargets: 1, maxActiveBroadcasts: 1, source: "free" });
		}
		expect(benefits.validUntil).toBe(end);
	});
});

type OwnerFixture = ReturnType<typeof ownerSnapshotFixture>;
const invalidOwnerDocuments: [string, (fixture: OwnerFixture) => Record<string, unknown>][] = [
	["another issuer", () => ({ issuer: "foreign.example" })],
	["an execution document", () => ({ kind: "execution" })],
	["an absent owner", () => ({ ownerId: null })],
	["an invalid device ID", () => ({ runnerId: "not-a-device" })],
	["an absent request ID", () => ({ requestId: null })],
	["an invalid configuration revision", () => ({ configurationRevision: 0 })],
	["a future issuance", (f) => ({ issuedAt: f.issuedAt + 1 })],
	["a negative issuance", () => ({ issuedAt: -1 })],
	["a fractional expiry", (f) => ({ expiresAt: f.issuedAt + 0.5 })],
	["an excessive refresh horizon", (f) => ({ expiresAt: f.issuedAt + 604800001 })],
	["an absent policy", () => ({ capabilities: null })],
	["an array policy", () => ({ capabilities: [] })],
	["an inconsistent target limit", (f) => ({ capabilities: { ...f.capabilities, maxTargets: 1 } })],
	["an absent paid flag", (f) => ({ capabilities: { ...f.capabilities, runnerPro: null } })],
	["an invalid capability revision", (f) => ({ capabilities: { ...f.capabilities, capabilityRevision: "invalid" } })],
	["an inconsistent evaluation timestamp", (f) => ({ capabilities: { ...f.capabilities, evaluatedAt: new Date(f.issuedAt + 1).toISOString() } })],
	["an unknown entitlement source", (f) => ({ capabilities: { ...f.capabilities, source: "unknown" } })],
	["paid access with a Free source", (f) => ({ capabilities: { ...f.capabilities, source: "free" } })],
	["an invalid known deadline", (f) => ({ capabilities: { ...f.capabilities, validUntil: "invalid-date" } })],
	["a refresh beyond known paid validity", (f) => ({ expiresAt: f.claims.expiresAt + 1 })],
];

test.each(invalidOwnerDocuments)("TDD-US5-CON015: signed owner policy rejects %s", (_name, changes) => {
	const f = ownerSnapshotFixture();
	expect(executionProtocol.verifyRunnerBenefitSnapshot(f.bundle, f.trusted, f.identity, f.issuedAt)).not.toBeNull();
	expect(executionProtocol.verifyRunnerBenefitSnapshot(f.encode(changes(f)), f.trusted, f.identity, f.issuedAt)).toBeNull();
});

test("TDD-US5-CON015: invalid local clock or request timing cannot retain cached paid authorization", () => {
	const f = ownerSnapshotFixture();
	let now = 0;
	let clockFailed = false;
	const clock = () => {
		if (clockFailed) throw new Error("Local elapsed clock unavailable");
		return now;
	};
	const guard = new executionProtocol.RunnerBenefitSnapshotGuard({ ...f.identity, keys: f.trusted, clock });
	const request = { requestId: f.identity.requestId, sentAt: 0 };
	expect(guard.accept(f.bundle, request)).toBe(true);
	now = Number.NaN;
	expect(guard.runnerPro).toBe(false);
	now = 0;
	expect(guard.accept(f.bundle, request)).toBe(true);
	clockFailed = true;
	expect(guard.capabilities).toBeNull();
	clockFailed = false;
	expect(guard.runnerPro).toBe(false);
	clockFailed = true;
	expect(guard.accept(f.bundle, request)).toBe(false);
	clockFailed = false;
	for (const sentAt of [-1, Number.NaN, 1]) {
		expect(guard.accept(f.bundle, request)).toBe(true);
		expect(guard.accept(f.bundle, { ...request, sentAt })).toBe(false);
		expect(guard.runnerPro).toBe(false);
	}
});

test("TDD-US5-CON015: invalid trusted public-key configuration returns no policy or learned identity", () => {
	const f = ownerSnapshotFixture();
	const keys = { "test-key": "invalid public key" };
	expect(executionProtocol.verifyRunnerBenefitSnapshot(f.bundle, keys, f.identity, f.issuedAt)).toBeNull();
	const cache = new executionProtocol.RunnerBenefitSnapshotCache({ keys, clock: () => 0 });
	expect(cache.accept(f.bundle, { requestId: f.identity.requestId, sentAt: 0 })).toBe(false);
	expect(cache.scope).toBeNull();
	expect(cache.capabilities).toBeNull();
	expect(cache.runnerPro).toBe(false);
});

test("TDD-US5-CON015 U276: healthy refresh extends snapshot freshness without extending the independent known paid end", () => {
	const f = ownerSnapshotFixture();
	let elapsed = 0;
	const guard = new executionProtocol.RunnerBenefitSnapshotGuard({ ...f.identity, keys: f.trusted, clock: () => elapsed });
	const refresh = (issuedOffset: number, expiresOffset: number) => guard.accept(f.encode({ issuedAt: f.issuedAt + issuedOffset, expiresAt: f.issuedAt + expiresOffset, capabilities: { ...f.capabilities, evaluatedAt: new Date(f.issuedAt + issuedOffset).toISOString() } }), { requestId: f.identity.requestId, sentAt: elapsed });
	expect(refresh(0, 20000)).toBe(true);
	elapsed = 10000;
	expect(refresh(10000, 30000)).toBe(true);
	elapsed = 20000;
	expect(guard.runnerPro).toBe(true);
	elapsed = 30000;
	expect(guard.runnerPro).toBe(false);
	elapsed = 40000;
	expect(refresh(40000, 60000)).toBe(true);
	elapsed = 59999;
	expect(guard.runnerPro).toBe(true);
	elapsed = 60000;
	expect(guard.runnerPro).toBe(false);
});
