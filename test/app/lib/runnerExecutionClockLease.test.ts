/** @jest-environment node */
test("TDD-US1-CON004 default execution lease expires immediately after a suspend exceeding its signed TTL", () => {
	const { generateKeyPairSync, randomUUID, sign } = require("node:crypto");
	const os = require("node:os");
	const monotonic = 100;
	let uptime = 1000;
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance");
	const uptimeSpy = jest.spyOn(os, "uptime").mockImplementation(() => uptime / 1000);
	Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => monotonic } });
	try {
		jest.isolateModules(() => {
			const { FreeExecutionLease } = require("../../../packages/runner/src/protocol");
			const { privateKey, publicKey } = generateKeyPairSync("ed25519");
			const identity = { ownerId: "creator", runnerId: randomUUID(), sessionId: randomUUID(), generation: randomUUID(), targetHash: "a".repeat(64), configurationRevision: 1, sourceRevision: 1, sourceId: randomUUID(), admissionId: randomUUID(), leaseId: randomUUID() };
			const guard = new FreeExecutionLease(identity, { fixture: publicKey.export({ type: "spki", format: "pem" }).toString() });
			const claims = { ...identity, issuer: "clipify.us", kind: "execution", policy: "free_lease", requestId: guard.beginRenewal(), issuedAt: 1000000, expiresAt: 1300000 };
			const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
			expect(guard.accept({ keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") })).toBe(true);
			uptime += 300000;
			expect(guard.state).toBe("draining");
		});
	} finally {
		uptimeSpy.mockRestore();
		if (descriptor) Object.defineProperty(globalThis, "performance", descriptor);
	}
});
