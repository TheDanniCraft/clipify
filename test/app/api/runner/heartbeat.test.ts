/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockFindRunner = jest.fn();
const mockFindSessions = jest.fn();
const mockFindOverlays = jest.fn();
const mockFindAdmissions = jest.fn();

const mockSet = jest.fn();
const mockWhere = jest.fn().mockResolvedValue(undefined);
const mockRateLimit = jest.fn();
const supported = { protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: "11111111-1111-4111-8111-111111111111" };
const builder = { set: mockSet, where: mockWhere };
mockSet.mockReturnValue(builder);
jest.mock("@/db/client", () => ({ db: { query: { runnerBroadcastAdmissionsTable: { findMany: (...args: unknown[]) => mockFindAdmissions(...args) }, runnersTable: { findFirst: (...args: unknown[]) => mockFindRunner(...args) }, streamSessionsTable: { findMany: (...args: unknown[]) => mockFindSessions(...args) }, overlaysTable: { findMany: (...args: unknown[]) => mockFindOverlays(...args) } }, update: () => builder } }));
jest.mock("@/server/runner/lease", () => ({ issueFreeExecutionLease: jest.fn(async () => null), acknowledgeFreeExecutions: jest.fn(async () => []), issueRunnerBenefitSnapshot: jest.fn(async () => null) }));
jest.mock("@actions/rateLimit", () => ({ tryRateLimit: (...args: unknown[]) => mockRateLimit(...args) }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
jest.mock("@lib/operationalHealth", () => ({ operationalCount: jest.fn(), operationalDuration: jest.fn() }));
jest.mock("@/app/lib/encryption", () => ({ decryptString: jest.fn() }));
import { decryptString } from "@/app/lib/encryption";
import { POST } from "@/app/api/runner/heartbeat/route";
import { captureUnexpectedError } from "@lib/sentryServer";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyExecutionBundle } from "@/server/runner/capabilities";
import { flowProbe } from "../../../support/mcp/probe";

describe("Runner heartbeat authentication and assigned state", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSet.mockReturnValue(builder);
		mockRateLimit.mockResolvedValue({ success: true });
		mockFindRunner.mockResolvedValue({ id: "device-one", ownerId: "owner-one", name: "Fixture device" });
		mockFindSessions.mockResolvedValue([]);
		mockFindOverlays.mockResolvedValue([]);
		mockFindAdmissions.mockResolvedValue([]);
	});
	it("TDD-US3-EC009: accepts finite playback outcomes in terminal reports before protocol negotiation", async () => {
		const { randomUUID } = await import("node:crypto");
		for (const playbackOutcome of ["playback_timeout", "clip_completed", "unexpected"]) {
			const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ protocolVersion: 1, executions: [{ admissionId: randomUUID(), sessionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 1, state: "stopped", allOutputsClosed: true, playbackOutcome }] }) }));
			expect(response.status).toBe(playbackOutcome === "unexpected" ? 400 : 426);
		}
	});

	it.each(["draining", "unexpected"])("TDD-US3-FR013: finite finishing state %s parses before protocol negotiation", async (state) => {
		const { randomUUID } = await import("node:crypto");
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ protocolVersion: 1, executions: [{ admissionId: randomUUID(), sessionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 1, state }] }) }));
		expect(response.status).toBe(state === "draining" ? 426 : 400);
	});

	it("U229: missing bearer authentication returns 401 before database mutation", async () => {
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", body: "{}" }));
		expect(response.status).toBe(401);
		expect(mockFindRunner).not.toHaveBeenCalled();
		expect(mockSet).not.toHaveBeenCalled();
	});

	it("U230: heartbeat ignores actual state for a session assigned to another device", async () => {
		mockFindSessions.mockResolvedValue([{ id: "owned-session", overlayId: "owned-overlay", desiredState: "stopped" }]);
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ ...supported, actualStates: { "foreign-session": "running" } }) }));
		expect(response.status).toBe(200);
		expect(mockSet).toHaveBeenCalledTimes(1);
		expect(mockSet).not.toHaveBeenCalledWith({ actualState: "running" });
	});

	it("U231 replacement: an old Free device must update before any new-policy output", async () => {
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: "{}" }));
		expect(response.status).toBe(426);
		expect(await response.json()).toMatchObject({ code: "update_required", jobs: [] });
		expect(mockFindSessions).not.toHaveBeenCalled();
	});

	it("TDD-US1-CON004 U240: an invalid device token returns 401 without changing runtime state", async () => {
		mockFindRunner.mockResolvedValue(null);
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer invalid-device-token" }, body: "{}" }));
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Invalid runner token" });
		expect(mockSet).not.toHaveBeenCalled();
	});

	it("TDD-US1-CON004 U241: an old client receives update-required before any new-policy output credentials", async () => {
		mockFindSessions.mockResolvedValue([{ id: "running-session", overlayId: "owned-overlay", desiredState: "running", encryptedStreamKey: "encrypted-fixture-key" }]);
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ version: "old-client", actualStates: { "running-session": "running" } }) }));
		expect(response.status).toBe(426);
		expect(await response.json()).toMatchObject({ code: "update_required", supportedProtocolVersion: 2, jobs: [] });
		expect(decryptString).not.toHaveBeenCalled();
		expect(mockSet).not.toHaveBeenCalledWith({ actualState: "running" });
	});

	it("TDD-US1-CON004 U241 capabilities: v2 clients missing any output safety capability must update", async () => {
		const required = ["admissions", "drain", "runner_presentation"];
		mockFindSessions.mockResolvedValue([{ id: "running-session", overlayId: "owned-overlay", desiredState: "running", encryptedStreamKey: "encrypted-fixture-key" }]);
		for (const missing of required) {
			const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ protocolVersion: 2, capabilities: required.filter((capability) => capability !== missing) }) }));
			expect(response.status).toBe(426);
			expect(await response.json()).toMatchObject({ code: "update_required", jobs: [] });
		}
		expect(decryptString).not.toHaveBeenCalled();
	});

	it("TDD-US1-CON004 U204: the real limiter returns 200 on heartbeat 12 in sixty seconds", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));
		try {
			const { consumeAppRateLimit } = jest.requireActual("@/server/rate-limit") as typeof import("@/server/rate-limit");
			mockRateLimit.mockImplementation((input: import("@/server/rate-limit").AppRateLimitInput) => consumeAppRateLimit({ ...input, key: `application:${input.key}` }));
			const statuses: number[] = [];
			let response: Response | undefined;
			for (let request = 0; request < 12; request++) {
				response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-U204-device" }, body: JSON.stringify(supported) }));
				statuses.push(response.status);
			}
			expect(statuses.slice(0, 12)).toEqual(Array(12).fill(200));
			expect(response?.status).toBe(200);
		} finally {
			jest.clearAllTimers();
			jest.useRealTimers();
		}
	});

	it("TDD-US1-CON004 U205: the real limiter returns 429 on heartbeat 13 in sixty seconds", async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));
		try {
			const { consumeAppRateLimit } = jest.requireActual("@/server/rate-limit") as typeof import("@/server/rate-limit");
			mockRateLimit.mockImplementation((input: import("@/server/rate-limit").AppRateLimitInput) => consumeAppRateLimit({ ...input, key: `application:${input.key}` }));
			const statuses: number[] = [];
			let response: Response | undefined;
			for (let request = 0; request < 13; request++) {
				response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-U205-device" }, body: JSON.stringify(supported) }));
				statuses.push(response.status);
			}
			expect(statuses.slice(0, 12)).toEqual(Array(12).fill(200));
			expect(response?.status).toBe(429);
			expect(response?.headers.get("Retry-After")).toBe("60");
		} finally {
			jest.clearAllTimers();
			jest.useRealTimers();
		}
	});

	it("TDD-US1-CON004 U140: a supported v2 device cannot change another session's actual state", async () => {
		mockFindSessions.mockResolvedValue([{ id: "owned-session", overlayId: "owned-overlay", desiredState: "running", encryptedStreamKey: null }]);
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ ...supported, actualStates: { "foreign-session": "running" } }) }));
		expect(response.status).toBe(200);
		expect(mockSet).toHaveBeenCalledTimes(1);
		expect(mockSet).not.toHaveBeenCalledWith({ actualState: "running" });
	});
	it("TDD-US1-CON004 U243: authenticated device receives only its own private assignments with no-store", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:heartbeat_isolation");
		expect(result).toEqual({ telemetry: { protocol: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], ack: 7 }, status: 200, noStore: true, onlyAssigned: true, foreignDataExposed: false, ownCredentials: true, foreignState: "stopped" });
	});

	it("TDD-US1-CON004 U242: execution verification admits an authentic permit and rejects a forged bundle", () => {
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		const now = Date.parse("2026-10-15T00:00:00Z");
		const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1 };
		const claims = { issuer: "clipify.us", kind: "execution", ...identity, issuedAt: now - 1000, expiresAt: now + 300000 };
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		const signature = sign(null, Buffer.from(payload), privateKey).toString("base64url");
		const bundle = { keyId: "fixture-key", payload, signature };
		const trusted = { "fixture-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
		const verify = verifyExecutionBundle;
		expect(verify(bundle, trusted, identity, now)).toEqual(claims);
		expect(verify({ ...bundle, payload: Buffer.from(JSON.stringify({ ...claims, generation: "forged-generation" })).toString("base64url") }, trusted, identity, now)).toBeNull();
		expect(verify({ ...bundle, payload: Buffer.from(JSON.stringify({ ...claims, expiresAt: now + 600000 })).toString("base64url") }, trusted, identity, now)).toBeNull();
	});

	it("TDD-US1-CON004 U242 identity: a valid signature cannot substitute another resource, generation or revision", () => {
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		const now = Date.parse("2026-10-15T00:00:00Z");
		const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1 };
		const claims = { issuer: "clipify.us", kind: "execution", ...identity, issuedAt: now - 1000, expiresAt: now + 300000 };
		const trusted = { "fixture-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
		const encode = (value: object) => {
			const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
			return { keyId: "fixture-key", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
		};
		expect(verifyExecutionBundle(encode(claims), trusted, identity, now)).toEqual(claims);
		for (const field of Object.keys(identity) as Array<keyof typeof identity>) {
			const replacement = typeof identity[field] === "number" ? 2 : "different-resource";
			expect({ field, result: verifyExecutionBundle(encode({ ...claims, [field]: replacement }), trusted, identity, now) }).toEqual({ field, result: null });
		}
	});

	it("TDD-US1-CON004 U242 validity: signed permits fail closed at expiry and for unknown keys or malformed claims", () => {
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		const now = Date.parse("2026-10-15T00:00:00Z");
		const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1 };
		const claims = { issuer: "clipify.us", kind: "execution", ...identity, issuedAt: now - 1000, expiresAt: now + 300000 };
		const trusted = { "fixture-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
		const encode = (value: unknown) => {
			const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
			return { keyId: "fixture-key", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
		};
		const valid = encode(claims);
		expect(verifyExecutionBundle(valid, { "fixture-key": "invalid-public-key" }, identity, now)).toBeNull();
		const malformedPayload = Buffer.from("{malformed-json").toString("base64url");
		expect(verifyExecutionBundle({ keyId: "fixture-key", payload: malformedPayload, signature: sign(null, Buffer.from(malformedPayload), privateKey).toString("base64url") }, trusted, identity, now)).toBeNull();
		expect(verifyExecutionBundle({ ...valid, payload: "A" }, trusted, identity, now)).toBeNull();
		expect(verifyExecutionBundle({ ...valid, payload: "A".repeat(65537) }, trusted, identity, now)).toBeNull();
		const clock = jest.spyOn(Date, "now").mockReturnValue(now);
		try {
			expect(verifyExecutionBundle(valid, trusted, identity)).toEqual(claims);
		} finally {
			clock.mockRestore();
		}

		expect(verifyExecutionBundle(valid, trusted, identity, now)).toEqual(claims);
		for (const invalid of [{ ...claims, expiresAt: now }, { ...claims, issuedAt: now + 1 }, { ...claims, issuedAt: "yesterday" }, { ...claims, expiresAt: "forever" }, { ...claims, expiresAt: claims.issuedAt }, { ...claims, issuer: "foreign" }, { ...claims, kind: "benefit" }, null, [], { ...claims, generation: "" }, { ...claims, configurationRevision: 1.5 }]) expect(verifyExecutionBundle(encode(invalid), trusted, identity, now)).toBeNull();
		for (const invalid of [null, {}, { ...valid, keyId: "unknown" }, { ...valid, signature: "invalid" }, { ...valid, payload: "%invalid%" }, { ...valid, payload: valid.payload + "=" }]) expect(verifyExecutionBundle(invalid, trusted, identity, now)).toBeNull();
	});

	it("TDD-US1-CON004 input: malformed or oversized heartbeat telemetry cannot mutate device or session state", async () => {
		for (const body of ["null", "[]", "{", JSON.stringify({ os: { unsafe: "object" } }), JSON.stringify({ protocolVersion: 2.5 }), JSON.stringify({ lastAcknowledgedConfigRevision: 2147483648 }), JSON.stringify({ capabilities: Array(33).fill("capability") })]) {
			mockSet.mockClear();
			const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body }));
			expect({ body, status: response.status }).toEqual({ body, status: 400 });
			expect(response.headers.get("Cache-Control")).toBe("no-store");
			expect(mockSet).not.toHaveBeenCalled();
		}
		mockSet.mockClear();
		const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ hostname: "x".repeat(65536) }) }));
		expect(response.status).toBe(413);
		expect(mockSet).not.toHaveBeenCalled();
	});
	it("TDD-US1-CON004 observations: unsigned state claims never change a session, even when assigned", async () => {
		mockFindSessions.mockResolvedValue([{ id: "owned-session", overlayId: "owned-overlay", desiredState: "stopped" }]);
		const request = (state: string) => new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: JSON.stringify({ ...supported, actualStates: { "owned-session": state, "foreign-session": "running" } }) });
		const valid = await POST(request("running"));
		expect(valid.status).toBe(200);
		expect(mockSet).toHaveBeenCalledTimes(1);
		expect(mockSet).not.toHaveBeenCalledWith({ actualState: "running" });
		mockSet.mockClear();
		const invalid = await POST(request("not-a-stream-state"));
		expect(invalid.status).toBe(200);
		expect(mockSet).toHaveBeenCalledTimes(1);
		expect(mockSet).not.toHaveBeenCalledWith(expect.objectContaining({ actualState: expect.anything() }));
	});

	it("TDD-US1-CON004 failure: database errors return a generic uncached response without partial mutations", async () => {
		const failure = new Error("fixture-database-unavailable");
		mockFindRunner.mockRejectedValueOnce(failure);
		const diagnostic = jest.spyOn(console, "error").mockImplementation(() => {});
		try {
			const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture-token" }, body: "{}" }));
			expect(response.status).toBe(500);
			expect(response.headers.get("Cache-Control")).toBe("no-store");
			expect(await response.json()).toEqual({ error: "Internal Server Error" });
			expect(mockSet).not.toHaveBeenCalled();
			expect(captureUnexpectedError).toHaveBeenCalledWith(failure, "runner-api", "heartbeat");
			expect(diagnostic).toHaveBeenCalledWith("Heartbeat Error:", failure);
		} finally {
			diagnostic.mockRestore();
		}
	});
});

// Supporting codec constraint; actual Free lease dispatch/runtime acceptance stays DEC001/DEC003-owned.
it("TDD-US1-CON004 Free lease binding: an authentic signature cannot substitute another admission", () => {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const now = Date.parse("2026-10-15T00:00:00Z");
	const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1, sourceId: "a8407c24-1776-4c85-bc2c-028cb82a03dc", admissionId: "dc4d8b82-a751-4828-8a66-d39338137a3f", leaseId: "c8754245-74d1-411f-884b-c53d05c303cd", requestId: "ca045d23-e67c-4fe1-917c-ab63e1148233" };
	const claims = { issuer: "clipify.us", kind: "execution", policy: "free_lease", ...identity, admissionId: "a8c9494a-d9d5-472c-afbe-ece2851f5dc5", issuedAt: now, expiresAt: now + 300000 };
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const bundle = { keyId: "fixture-free-key", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
	const trusted = { "fixture-free-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
	expect(verifyExecutionBundle(bundle, trusted, identity, now)).toBeNull();
});

it("TDD-US1-CON004 Free lease duration: an authentic permit cannot exceed 300 seconds", () => {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const now = Date.parse("2026-10-15T00:00:00Z");
	const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1, sourceId: "a8407c24-1776-4c85-bc2c-028cb82a03dc", admissionId: "dc4d8b82-a751-4828-8a66-d39338137a3f", leaseId: "c8754245-74d1-411f-884b-c53d05c303cd", requestId: "ca045d23-e67c-4fe1-917c-ab63e1148233" };
	const trusted = { "fixture-free-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
	const check = (duration: number) => {
		const claims = { issuer: "clipify.us", kind: "execution", policy: "free_lease", ...identity, issuedAt: now, expiresAt: now + duration };
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		const bundle = { keyId: "fixture-free-key", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
		return verifyExecutionBundle(bundle, trusted, identity, now);
	};
	expect(check(300000)).not.toBeNull();
	expect(check(300001)).toBeNull();
});

function freeCodecFixture() {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const now = Date.parse("2026-10-15T00:00:00Z");
	const identity = { ownerId: "owner-one", runnerId: "device-one", sessionId: "session-one", generation: "generation-one", targetHash: "target-one", configurationRevision: 1, sourceRevision: 1, sourceId: "a8407c24-1776-4c85-bc2c-028cb82a03dc", admissionId: "dc4d8b82-a751-4828-8a66-d39338137a3f", leaseId: "c8754245-74d1-411f-884b-c53d05c303cd", requestId: "ca045d23-e67c-4fe1-917c-ab63e1148233" };
	const trusted = { "fixture-free-key": publicKey.export({ type: "spki", format: "pem" }).toString() };
	const encode = (changes: Record<string, unknown> = {}) => {
		const claims = { issuer: "clipify.us", kind: "execution", policy: "free_lease", ...identity, issuedAt: now, expiresAt: now + 300000, ...changes };
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		return { keyId: "fixture-free-key", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
	};
	return { now, identity, trusted, encode };
}
it("TDD-US1-CON004 Free policy: a caller expecting a Free lease cannot accept a generic execution permit", () => {
	const f = freeCodecFixture();
	expect(verifyExecutionBundle(f.encode(), f.trusted, f.identity, f.now)).not.toBeNull();
	expect(verifyExecutionBundle(f.encode({ policy: undefined }), f.trusted, f.identity, f.now)).toBeNull();
});

it.each(["admissionId", "leaseId", "requestId", "sourceId"] as const)("TDD-US1-CON004 Free %s binding rejects signed wrong, missing and malformed identities", (field) => {
	const f = freeCodecFixture();
	for (const value of ["a8c9494a-d9d5-472c-afbe-ece2851f5dc5", undefined, "not-a-uuid", false]) {
		expect(verifyExecutionBundle(f.encode({ [field]: value }), f.trusted, f.identity, f.now)).toBeNull();
	}
});
it("TDD-US1-CON004 Free bindings cannot be omitted by the verifier caller", () => {
	const f = freeCodecFixture();
	const { admissionId, leaseId, requestId, ...generic } = f.identity;
	expect([admissionId, leaseId, requestId]).toHaveLength(3);
	expect(verifyExecutionBundle(f.encode(), f.trusted, generic, f.now)).toBeNull();
	expect(verifyExecutionBundle(f.encode(), f.trusted, { ...generic, admissionId }, f.now)).toBeNull();
	expect(verifyExecutionBundle(f.encode(), f.trusted, { ...generic, admissionId, leaseId }, f.now)).toBeNull();
});

it("TDD-US1-CON004 monotonic lease prerequisite: a fresh signed permit remains active until expiry minus 1ms", async () => {
	const protocol = await import("../../../../packages/runner/src/protocol");
	// Missing functionality is asserted explicitly, rather than an import/setup exception.
	const Guard = (protocol as unknown as { FreeExecutionLease?: new (...args: unknown[]) => { beginRenewal: () => string | null; accept: (bundle: unknown) => boolean; state: string } }).FreeExecutionLease;
	expect(typeof Guard).toBe("function");
	if (!Guard) return;
	const f = freeCodecFixture();
	let monotonic = 0;
	const guard = new Guard(f.identity, f.trusted, () => monotonic);
	const requestId = guard.beginRenewal();
	expect(typeof requestId).toBe("string");
	expect(guard.accept(f.encode({ requestId }))).toBe(true);
	monotonic = 299999;
	expect(guard.state).toBe("active");
});

it("TDD-US1-CON004 monotonic expiry: the exact deadline enters irreversible drain", async () => {
	const { FreeExecutionLease } = await import("../../../../packages/runner/src/protocol");
	const f = freeCodecFixture();
	let monotonic = 0;
	const guard = new FreeExecutionLease(f.identity, f.trusted, () => monotonic);
	expect(guard.state).toBe("renewal_required");
	const requestId = guard.beginRenewal();
	expect(guard.accept(f.encode({ requestId }))).toBe(true);
	monotonic = 300000;
	expect(guard.state).toBe("draining");
	expect(guard.beginRenewal()).toBeNull();
	expect(guard.accept(f.encode({ requestId, issuedAt: f.now + 300000, expiresAt: f.now + 600000 }))).toBe(false);
	monotonic = 0;
	expect(guard.state).toBe("draining");
});

it("TDD-US1-CON004 delayed initial lease: a response arriving at its deadline cannot revive that generation", async () => {
	const { FreeExecutionLease } = await import("../../../../packages/runner/src/protocol");
	const f = freeCodecFixture();
	let monotonic = 0;
	const guard = new FreeExecutionLease(f.identity, f.trusted, () => monotonic);
	const requestId = guard.beginRenewal();
	monotonic = 300000;
	expect(guard.accept(f.encode({ requestId }))).toBe(false);
	expect(guard.state).toBe("draining");
	expect(guard.beginRenewal()).toBeNull();
});

it("TDD-US1-CON004 replay prerequisite: consumed signed responses cannot extend the monotonic deadline", async () => {
	const { FreeExecutionLease } = await import("../../../../packages/runner/src/protocol");
	const f = freeCodecFixture();
	let monotonic = 0;
	const guard = new FreeExecutionLease(f.identity, f.trusted, () => monotonic);
	const requestId = guard.beginRenewal(),
		bundle = f.encode({ requestId });
	expect(guard.accept(bundle)).toBe(true);
	monotonic = 100000;
	expect(guard.accept(bundle)).toBe(false);
	const nextRequest = guard.beginRenewal();
	expect(nextRequest).not.toBe(requestId);
	expect(guard.accept(bundle)).toBe(false);
	monotonic = 299999;
	expect(guard.state).toBe("active");
	monotonic = 300000;
	expect(guard.state).toBe("draining");
});
it("TDD-US1-CON004 restart prerequisite: a new offline process has no accepted lease and rejects a previous process response", async () => {
	const { FreeExecutionLease } = await import("../../../../packages/runner/src/protocol");
	const f = freeCodecFixture(),
		first = new FreeExecutionLease(f.identity, f.trusted, () => 0);
	const previousRequest = first.beginRenewal(),
		bundle = f.encode({ requestId: previousRequest });
	expect(first.accept(bundle)).toBe(true);
	const restarted = new FreeExecutionLease(f.identity, f.trusted, () => 0);
	expect(restarted.state).toBe("renewal_required");
	expect(restarted.accept(bundle)).toBe(false);
	const freshRequest = restarted.beginRenewal();
	expect(freshRequest).not.toBe(previousRequest);
	expect(restarted.accept(bundle)).toBe(false);
	expect(restarted.state).toBe("renewal_required");
});

test("TDD-US1-FR004: heartbeat carries a generation-bound explicit emergency command without output secrets", async () => {
	jest.clearAllMocks();
	mockRateLimit.mockResolvedValue({ success: true });
	mockSet.mockReturnValue(builder);
	mockFindOverlays.mockResolvedValue([]);
	mockFindRunner.mockResolvedValue({ id: "device-one", ownerId: "owner-one" });
	mockFindSessions.mockResolvedValue([{ id: "session", overlayId: "overlay", desiredState: "stopped", configurationRevision: 3 }]);
	mockFindAdmissions.mockResolvedValue([{ id: "admission", sessionId: "session", executionGeneration: "generation", configurationRevision: 2, commandId: "command", stopMode: "immediate", state: "draining" }]);
	const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: "55555555-5555-4555-8555-555555555555" }) }));
	expect(response.status).toBe(200);
	expect((await response.json()).jobs[0]).toMatchObject({ admissionId: "admission", executionGeneration: "generation", commandId: "command", command: "stop_now", stopMode: "immediate", configurationRevision: 2, overlaySecret: "", streamKey: null });
});

test("TDD-US1-FR004: an old stopped snapshot cannot send a stop to a replacement active generation", async () => {
	jest.clearAllMocks();
	mockRateLimit.mockResolvedValue({ success: true });
	mockSet.mockReturnValue(builder);
	mockFindOverlays.mockResolvedValue([]);
	mockFindRunner.mockResolvedValue({ id: "device-one", ownerId: "owner-one" });
	mockFindSessions.mockResolvedValue([{ id: "session", overlayId: "overlay", desiredState: "stopped", configurationRevision: 3 }]);
	mockFindAdmissions.mockResolvedValue([{ id: "replacement", sessionId: "session", executionGeneration: "new-generation", configurationRevision: 4, commandId: "new-start", stopMode: "graceful", state: "active" }]);
	const response = await POST(new Request("http://localhost/api/runner/heartbeat", { method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify({ protocolVersion: 2, capabilities: ["admissions", "drain", "runner_presentation", "free_lease"], requestId: "55555555-5555-4555-8555-555555555555" }) }));
	expect(response.status).toBe(200);
	const job = (await response.json()).jobs[0];
	expect(job.executionGeneration).not.toBe("new-generation");
	expect(job.commandId).not.toBe("new-start");
});
