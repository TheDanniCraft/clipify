/** @jest-environment node */
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { FreeExecutionLease } from "../../../packages/runner/src/protocol";

function leaseFixture() {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const identity = { ownerId: "creator", runnerId: randomUUID(), sessionId: randomUUID(), generation: randomUUID(), targetHash: "bound-target", configurationRevision: 2, sourceRevision: 1, sourceId: randomUUID(), admissionId: randomUUID(), leaseId: randomUUID() };
	return {
		identity,
		keys: { fixture: publicKey.export({ type: "spki", format: "pem" }).toString() },
		encode: (requestId: string) => {
			const payload = Buffer.from(JSON.stringify({ ...identity, issuer: "clipify.us", kind: "execution", policy: "free_lease", requestId, issuedAt: 1000000, expiresAt: 1300000 })).toString("base64url");
			return { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
		},
	};
}
test("TDD-US1-DEC001: first assignment adopts its original request nonce and monotonic send time", () => {
	const fixture = leaseFixture(),
		request = { requestId: randomUUID(), sentAt: 1000 };
	let monotonic = 1500;
	const guard = new FreeExecutionLease(fixture.identity, fixture.keys, () => monotonic);
	guard.beginRenewal(request);
	expect(guard.accept(fixture.encode(request.requestId))).toBe(true);
	expect(guard.deadlineMonotonic).toBe(301000);
	monotonic = 300999;
	expect(guard.state).toBe("active");
	monotonic = 301000;
	expect(guard.state).toBe("draining");
});

test.each([
	{ requestId: "invalid", sentAt: 1000 },
	{ requestId: randomUUID(), sentAt: -1 },
	{ requestId: randomUUID(), sentAt: 1001 },
	{ requestId: randomUUID(), sentAt: NaN },
	{ requestId: randomUUID(), sentAt: Infinity },
])("TDD-US1-DEC001: invalid request context cannot establish a lease ($sentAt, $requestId)", (request) => {
	const fixture = leaseFixture(),
		guard = new FreeExecutionLease(fixture.identity, fixture.keys, () => 1000);
	expect(guard.beginRenewal(request)).toBeNull();
	expect(guard.accept(fixture.encode(request.requestId))).toBe(false);
	expect(guard.state).toBe("renewal_required");
});

test("TDD-US1-CON004: effective targets use a canonical credential-digest hash independent of target order", async () => {
	const protocol = (await import("../../../packages/runner/src/protocol")) as typeof import("../../../packages/runner/src/protocol") & { hashExecutionTargets?: (targets: ReadonlyArray<{ id: string; rtmpUrl: string; streamKey: string | null }>) => string };
	const targets = [
		{ id: "b", rtmpUrl: "rtmp://second/live", streamKey: "fixture-key" },
		{ id: "a", rtmpUrl: "rtmp://first/live", streamKey: null },
	];
	const expected = "3e0a6ae4d2b9e41ece4afb7b13d023ad9b42e8d377fe7a16d6d77bb733129548";
	expect(protocol.hashExecutionTargets?.(targets)).toBe(expected);
	expect(protocol.hashExecutionTargets?.([...targets].reverse())).toBe(expected);
});

test.each([
	{ name: "null body", body: null },
	{ name: "primitive body", body: false },
	{ name: "non-string payload", body: { payload: 17 } },
	{ name: "JSON null payload", body: { payload: Buffer.from("null").toString("base64url") } },
	{ name: "malformed payload", body: { payload: "not-json" } },
])("TDD-US1-CON004 malformed lease response ($name) consumes its nonce without activating output", ({ body }) => {
	const fixture = leaseFixture(),
		request = { requestId: randomUUID(), sentAt: 1000 };
	const guard = new FreeExecutionLease(fixture.identity, fixture.keys, () => 1000);
	guard.beginRenewal(request);
	expect(guard.accept(body)).toBe(false);
	expect(guard.state).toBe("renewal_required");
	expect(guard.deadlineMonotonic).toBeNull();
	expect(guard.accept(fixture.encode(request.requestId))).toBe(false);
});

test("TDD-US1-CON004 a response cannot authorize output after its elapsed clock moves behind the request", () => {
	const fixture = leaseFixture(),
		request = { requestId: randomUUID(), sentAt: 1000 };
	let clock = 1000;
	const guard = new FreeExecutionLease(fixture.identity, fixture.keys, () => clock);
	guard.beginRenewal(request);
	clock = 999;
	expect(guard.accept(fixture.encode(request.requestId))).toBe(false);
	expect(guard.deadlineMonotonic).toBeNull();
	expect(guard.state).toBe("renewal_required");
});
