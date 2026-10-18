import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { hashExecutionTargets, FreeExecutionLease } from "../protocol";
import { FreeExecutionController, type FreeExecutionJob } from "../execution-runtime";
import { ExecutionJournal } from "../execution-journal";

function fixture(policy = "pro_broadcast") {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const destinations = ["youtube", "twitch"].map((provider) => ({ id: randomUUID(), provider, rtmpUrl: `rtmp://127.0.0.1/${provider}`, streamKey: `private-${provider}` }));
	const ownerId = "creator",
		runnerId = randomUUID(),
		id = randomUUID(),
		admissionId = randomUUID(),
		leaseId = randomUUID(),
		generation = randomUUID(),
		overlayId = randomUUID();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const targetHash = hashExecutionTargets(destinations);
	const claims = { issuer: "clipify.us", kind: "execution", policy, ownerId, runnerId, sessionId: id, admissionId, leaseId, generation, sourceId: overlayId, configurationRevision: 2, sourceRevision: 1, targetHash, requestId: request.requestId, issuedAt: 1000000, expiresAt: 1300000 };
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const job = { id, ownerId, runnerId, admissionId, executionGeneration: generation, configurationRevision: 2, sourceRevision: 1, targetHash, overlayId, overlaySecret: "private-source", rtmpUrl: destinations[0].rtmpUrl, streamKey: destinations[0].streamKey, mode: "24/7" as const, fps: 30, resolution: "720p", desiredState: "running" as const, destinations, lease: { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") } };
	return { job, request, ownerId, runnerId, claims, keys: { fixture: publicKey.export({ type: "spki", format: "pem" }).toString() } };
}

test("TDD-US2-FR008: active heartbeat receipts carry the engine's safe destination states", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-output-observations-"));
	try {
		const f = fixture();
		const outputs = f.job.destinations.map((target, index) => ({ id: target.id, state: index ? ("streaming" as const) : ("retrying" as const) }));
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), outputStates: () => outputs.map((output) => ({ ...output, streamKey: "private-must-not-report" })) };
		const controller = new FreeExecutionController({ ...f, journal: new ExecutionJournal(directory), clock: () => 1500, createEngine: () => engine });
		expect(await controller.apply(f.job, f.request)).toBe(true);
		expect(controller.reports()).toMatchObject([{ state: "active", outputs }]);
		expect(JSON.stringify(controller.reports())).not.toContain("private-must-not-report");
		await controller.stop(f.job);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US2-FR006: signed Pro targets start one engine and retain paid execution until a normal stop", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-multistream-controller-"));
	try {
		const f = fixture();
		let now = 1500;
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn<typeof engine, [FreeExecutionJob]>(() => engine);
		const controller = new FreeExecutionController({ ...f, journal: new ExecutionJournal(directory), clock: () => now, createEngine });
		expect(await controller.apply(f.job, f.request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(createEngine.mock.calls[0][0].destinations).toEqual(f.job.destinations);
		now = 36001000;
		await controller.tick();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(controller.reports()).toMatchObject([{ state: "active" }]);
		expect(await controller.stop(f.job)).toBe(true);
		expect(engine.requestDrain).toHaveBeenCalledWith({ deadlineMonotonic: now + 300000 });
		expect(controller.reports()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["tampered", "free", "delayed"])("TDD-US2-FR006: %s multistream assignment never opens an output", async (variant) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-multistream-reject-"));
	try {
		const f = fixture(variant === "free" ? "free_lease" : "pro_broadcast");
		if (variant === "tampered") f.job.destinations[1].streamKey = "changed";
		const createEngine = jest.fn();
		const controller = new FreeExecutionController({ ...f, journal: new ExecutionJournal(directory), clock: () => (variant === "delayed" ? 301000 : 1500), createEngine });
		expect(await controller.apply(f.job, f.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US2-FR006: a paid permit cannot remove a Free guard's lease deadline", () => {
	const f = fixture();
	const guard = new FreeExecutionLease({ ...f.claims, admissionId: f.claims.admissionId, leaseId: f.claims.leaseId }, f.keys, () => 1500);
	expect(guard.beginRenewal(f.request)).toBe(f.request.requestId);
	expect(guard.accept(f.job.lease)).toBe(false);
	expect(guard.state).toBe("renewal_required");
});
