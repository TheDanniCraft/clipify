import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";

/** Independent synthetic authority for native protocol/cache boundary tests. */
export function scheduleAuthorizationFixture() {
	const pair = generateKeyPairSync("ed25519");
	const keyId = createHash("sha256")
		.update(pair.publicKey.export({ type: "spki", format: "der" }))
		.digest("hex")
		.slice(0, 16);
	const keys = { [keyId]: pair.publicKey.export({ type: "spki", format: "pem" }).toString() };
	const ownerId = "creator",
		runnerId = randomUUID(),
		sessionId = randomUUID(),
		admissionId = randomUUID(),
		generation = randomUUID(),
		leaseId = randomUUID(),
		overlayId = randomUUID();
	const overlaySecret = "private-scheduled-source-fixture",
		streamKey = "private-scheduled-target-fixture";
	const target = { id: randomUUID(), rtmpUrl: "rtmp://127.0.0.1:1951/live", streamKey };
	const targetHash = createHash("sha256")
		.update(JSON.stringify([{ id: target.id, rtmpUrl: target.rtmpUrl, credential: createHash("sha256").update(streamKey).digest("hex") }]))
		.digest("hex");
	const signed = (claims: object) => {
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		return { keyId, payload, signature: sign(null, Buffer.from(payload), pair.privateKey).toString("base64url") };
	};
	function response(requestId: string, issuedAt = 1000000, configurationRevision = 1) {
		const expiresAt = issuedAt + 604800000;
		const policy = { basicAccess: true, runnerPro: true, maxRegisteredDevices: null, maxActiveBroadcasts: null, maxTargets: null, scheduling: true, customStandby: true, attributionRequired: false, monthlyUsageLimit: null, validUntil: null, source: "pro", evaluatedAt: new Date(issuedAt).toISOString(), capabilityRevision: "a".repeat(64) };
		const executionPayloadHash = createHash("sha256")
			.update(JSON.stringify({ sourceId: overlayId, sourceCredential: createHash("sha256").update(overlaySecret).digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash }))
			.digest("hex");
		const claims = { issuer: "clipify.us", kind: "scheduled_execution", policy: "pro_broadcast", cacheAuthorization: true as const, ownerId, runnerId, sessionId, admissionId, generation, leaseId, requestId, configurationRevision, sourceId: overlayId, sourceRevision: 1, targetHash, executionPayloadHash, occurrenceId: '["event","original"]', scheduledStart: issuedAt + 10000, scheduledEnd: issuedAt + 20000, issuedAt, expiresAt };
		const lease = signed(claims);
		const job = { id: sessionId, ownerId, runnerId, admissionId, executionGeneration: generation, configurationRevision, sourceRevision: 1, overlayId, overlaySecret, rtmpUrl: target.rtmpUrl, streamKey, mode: "24/7" as const, fps: 15, resolution: "720p", targetHash, destinations: [target], desiredState: "running" as const, cacheAuthorization: true as const, occurrenceId: claims.occurrenceId, scheduledStart: claims.scheduledStart, scheduledEnd: claims.scheduledEnd, lease };
		return {
			jobs: [],
			benefitSnapshot: signed({ issuer: "clipify.us", kind: "benefits", ownerId, runnerId, requestId, configurationRevision, issuedAt, expiresAt, capabilities: policy }),
			scheduleCache: { bundle: signed({ issuer: "clipify.us", kind: "schedule_cache", version: 1, ownerId, runnerId, requestId, configurationRevision, issuedAt, expiresAt, capabilities: policy, entries: [{ admissionId, occurrenceId: claims.occurrenceId, authorizationHash: createHash("sha256").update(lease.payload).digest("hex") }] }), entries: [{ job }] },
		};
	}
	return { ownerId, runnerId, overlaySecret, streamKey, keys, response, signed };
}
