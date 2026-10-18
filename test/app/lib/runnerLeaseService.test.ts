/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockTransaction = jest.fn();
jest.mock("@/db/client", () => ({ db: { transaction: (callback: unknown) => mockTransaction(callback) } }));
jest.mock("@/app/lib/encryption", () => ({ decryptString: jest.fn() }));
jest.mock("@/server/runner/benefits", () => ({ resolveRunnerBenefits: jest.fn(async () => ({ proAccess: true })) }));
import { issueFreeExecutionLease, acknowledgeFreeExecutions, issueRunnerBenefitSnapshot, readRunnerOutputStates } from "@/server/runner/lease";
import { decryptString } from "@/app/lib/encryption";
import { resolveRunnerBenefits } from "@/server/runner/benefits";
import { db } from "@/db/client";
import { generateKeyPairSync, randomUUID } from "node:crypto";

const actor = { id: randomUUID(), ownerId: "fixture-owner", token: "fixture-token" };
const session = { id: randomUUID(), runnerId: actor.id, ownerId: actor.ownerId, overlayId: randomUUID(), desiredState: "running", configurationRevision: 2, rtmpUrl: "rtmp://example.invalid/live", encryptedStreamKey: null };
const admission = { id: randomUUID(), state: "reserved", ownerId: actor.ownerId, runnerId: actor.id, sessionId: session.id, executionGeneration: randomUUID(), configurationRevision: 2, benefitsAtStart: { runnerPro: false }, leaseId: null, leaseExpiresAt: null, dispatchedAt: null, revokedAt: null };
const overlay = { id: session.overlayId, ownerId: actor.ownerId, status: "active", configurationRevision: 1 };
function transaction(rows: unknown[][]) {
	const set = jest.fn();
	const tx = {
		select: jest.fn(() => {
			const result = rows.shift() ?? [];
			const builder = { from: () => builder, where: () => builder, orderBy: () => builder, limit: () => builder, for: async () => result };
			return builder;
		}),
		update: jest.fn(() => ({
			set: (value: unknown) => {
				set(value);
				return { where: async () => undefined };
			},
		})),
	};
	mockTransaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx));
	return { tx, set };
}
let previousKey: string | undefined;
beforeEach(() => {
	jest.clearAllMocks();
	previousKey = process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	jest.spyOn(Date, "now").mockReturnValue(1000000);
});
afterEach(() => {
	jest.restoreAllMocks();
	if (previousKey === undefined) delete process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	else process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = previousKey;
});

test("TDD-US2-FR008: active acknowledgments persist only the captured destination states", async () => {
	const leaseId = randomUUID();
	const targetIds = [randomUUID(), randomUUID()];
	const outputs = targetIds.map((id, index) => ({ id, state: index ? ("streaming" as const) : ("retrying" as const) }));
	const active = { ...admission, state: "starting", targetIdsSnapshot: targetIds, protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active]]);
	const acknowledgments = await acknowledgeFreeExecutions(actor, [{ admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "active", outputs }]);
	expect(acknowledgments).toHaveLength(1);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ outputStates: outputs }));
	expect(JSON.stringify(set.mock.calls)).not.toMatch(/rtmp|streamKey|private/);
});

test.each([false, true])("TDD-US2-FR008: a partial report preserves another target's known state or leaves it connecting (known=%s)", async (known) => {
	const leaseId = randomUUID(),
		targetId = randomUUID(),
		peerId = randomUUID();
	const active = { ...admission, state: "active", targetIdsSnapshot: [targetId, peerId], outputStates: known ? [{ id: peerId, state: "streaming" }] : [], protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const outputs = [{ id: targetId, state: "retrying" as const }];
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active]]);
	expect(await acknowledgeFreeExecutions(actor, [{ admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "active", outputs }])).toHaveLength(1);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ outputStates: [...outputs, { id: peerId, state: known ? "streaming" : "connecting" }] }));
});

test.each(["foreign", "duplicate", "empty", "invalid_state"])("TDD-US2-FR008: %s destination observations cannot mutate an admission", async (kind) => {
	const leaseId = randomUUID(),
		targetId = randomUUID();
	const active = { ...admission, state: "starting", targetIdsSnapshot: [targetId], protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const output = { id: kind === "foreign" ? randomUUID() : targetId, state: kind === "invalid_state" ? "raw-private-error" : "streaming" };
	const outputs = kind === "empty" ? [] : kind === "duplicate" ? [output, output] : [output];
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active]]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "active", outputs } as Parameters<typeof acknowledgeFreeExecutions>[1][number];
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toEqual([]);
	expect(set).not.toHaveBeenCalled();
});

test.each(["missing", "oversize", "invalid", "algorithm"])("TDD-US1-DEC001: %s signing configuration cannot dispatch and never echoes key material", async (kind) => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [admission], [overlay]]);
	const value = kind === "missing" ? undefined : kind === "oversize" ? "private-fixture".repeat(2000) : kind === "invalid" ? "private-fixture-key" : generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	if (value === undefined) delete process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	else process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = value;
	await expect(issueFreeExecutionLease(actor, session.id, randomUUID())).rejects.toThrow(/^Runner signing key unavailable$/);
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US1-DEC001: a protected stream key that cannot be decrypted never issues a lease", async () => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [{ ...session, encryptedStreamKey: "protected-fixture" }], [admission], [overlay]]);
	(decryptString as jest.Mock).mockReturnValue(null);
	expect(await issueFreeExecutionLease(actor, session.id, randomUUID())).toBeNull();
	expect(set).not.toHaveBeenCalled();
});

test.each([
	{ name: "removed session", rows: [[{ id: actor.ownerId }], [actor], []] },
	{ name: "concurrent Stop", rows: [[{ id: actor.ownerId }], [actor], [{ ...session, desiredState: "stopped" }]] },
	{ name: "revoked admission", rows: [[{ id: actor.ownerId }], [actor], [session], [{ ...admission, revokedAt: new Date(1) }]] },
	{ name: "archived source", rows: [[{ id: actor.ownerId }], [actor], [session], [admission], [{ ...overlay, status: "archived" }]] },
])("TDD-US1-DEC001: $name observed inside the owner lock cannot dispatch output", async ({ rows }) => {
	const { set } = transaction(rows);
	expect(await issueFreeExecutionLease(actor, session.id, randomUUID())).toBeNull();
	expect(set).not.toHaveBeenCalled();
	expect(decryptString).not.toHaveBeenCalled();
});

test("TDD-US1-DEC001: token rotation inside the owner lock rejects a pending acknowledgement", async () => {
	const { tx, set } = transaction([[{ id: actor.ownerId }], [{ ...actor, token: "rotated" }]]);
	expect(await acknowledgeFreeExecutions(actor, [])).toEqual([]);
	expect(tx.select).toHaveBeenCalledTimes(2);
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US1-DEC001: an acknowledgement for a removed session cannot mutate admissions", async () => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], []]);
	expect(await acknowledgeFreeExecutions(actor, [{ admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId: randomUUID(), configurationRevision: 2, state: "active" }])).toEqual([]);
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US1-DEC001: batched receipts are ordered and an old terminal replay cannot stop the active execution", async () => {
	const ids = [randomUUID(), randomUUID()].sort();
	const leaseId = randomUUID();
	const old = { ...admission, id: ids[0], leaseId, state: "stopped", protocolSupportsLease: true, dispatchedAt: new Date(1), leaseExpiresAt: new Date(1300000) };
	const active = { ...old, id: ids[1], state: "active", startedAt: new Date(2) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [old], [session], [active]]);
	const base = { sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2 };
	expect(
		await acknowledgeFreeExecutions(actor, [
			{ ...base, admissionId: ids[1], state: "active" },
			{ ...base, admissionId: ids[0], state: "stopped", allOutputsClosed: true },
		]),
	).toEqual([
		{ admissionId: ids[0], executionGeneration: admission.executionGeneration, state: "stopped" },
		{ admissionId: ids[1], executionGeneration: admission.executionGeneration, state: "active" },
	]);
	expect(set).toHaveBeenCalledTimes(2);
	expect(set).toHaveBeenCalledWith({ actualState: "running" });
	expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ actualState: "stopped" }));
});

test.each([
	{ name: "unreadable", decoded: null },
	{ name: "invalid JSON", decoded: "{" },
	{ name: "unknown version", decoded: JSON.stringify({ version: 2, destinations: [{}] }) },
	{ name: "missing target list", decoded: JSON.stringify({ version: 1 }) },
	{ name: "empty target set", decoded: JSON.stringify({ version: 1, destinations: [] }) },
])("TDD-US2-FR006: $name captured targets cannot dispatch or renew an execution", async ({ decoded }) => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [{ ...admission, encryptedTargetsSnapshot: "protected-snapshot" }], [overlay]]);
	(decryptString as jest.Mock).mockReturnValue(decoded);
	expect(await issueFreeExecutionLease(actor, session.id, randomUUID())).toBeNull();
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US2-FR006: a paid captured target set receives a signature over its original destinations", async () => {
	const targets = [
		{ id: randomUUID(), rtmpUrl: "rtmp://127.0.0.1/first", streamKey: "private-first-key" },
		{ id: randomUUID(), rtmpUrl: "rtmp://127.0.0.1/second", streamKey: "private-second-key" },
	];
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [{ ...admission, benefitsAtStart: { runnerPro: true }, encryptedTargetsSnapshot: "protected-snapshot" }], [overlay]]);
	(decryptString as jest.Mock).mockReturnValue(JSON.stringify({ version: 1, destinations: targets }));
	const requestId = randomUUID();
	const result = await issueFreeExecutionLease(actor, session.id, requestId);
	const { hashExecutionTargets, verifyExecutionBundle } = await import("../../../packages/runner/src/protocol");
	expect(result?.destinations).toEqual(targets);
	expect(result?.targetHash).toBe(hashExecutionTargets(targets));
	if (!result?.lease) throw new Error("Expected a signed paid permit for this active fixture");
	expect(verifyExecutionBundle(result.lease, { [result.lease.keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, { ownerId: actor.ownerId, runnerId: actor.id, sessionId: session.id, generation: admission.executionGeneration, configurationRevision: 2, sourceRevision: 1, sourceId: overlay.id, admissionId: admission.id, leaseId: set.mock.calls[0][0].leaseId, requestId, targetHash: hashExecutionTargets(targets) }, 1000000)?.policy).toBe("pro_broadcast");
	expect(JSON.stringify(set.mock.calls)).not.toMatch(/private-first-key|private-second-key/);
});

// Retained security characterization: an internal caller cannot claim closure without proof.
test("TDD-US1-DEC001: a terminal acknowledgment without all-output closure preserves the occupied admission", async () => {
	const leaseId = randomUUID();
	const active = { ...admission, state: "active", protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active]]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "stopped", allOutputsClosed: false } as unknown as Parameters<typeof acknowledgeFreeExecutions>[1][number];
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toEqual([]);
	expect(set).not.toHaveBeenCalled();
});

test.each(["removed owner", "removed device", "rotated device token"])("TDD-US3-FR012 trusted issuance baseline: %s cannot receive capabilities or execution permission", async (variant) => {
	const { privateKey } = generateKeyPairSync("ed25519");
	process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
	for (const issue of [() => issueRunnerBenefitSnapshot(actor, randomUUID()), () => issueFreeExecutionLease(actor, session.id, randomUUID())]) {
		const rows = variant === "removed owner" ? [[]] : [[{ id: actor.ownerId }], variant === "removed device" ? [] : [{ ...actor, token: "new-private-token" }]];
		const { set, tx } = transaction(rows);
		expect(await issue()).toBeNull();
		expect(set).not.toHaveBeenCalled();
		expect(tx.select).toHaveBeenCalledTimes(variant === "removed owner" ? 1 : 2);
	}
});

test.each([{ sourceIdAtStart: 123, sourceRevisionAtStart: 1 }, { sourceIdAtStart: randomUUID(), sourceRevisionAtStart: 0 }, { sourceIdAtStart: randomUUID(), sourceRevisionAtStart: 1.5 }, { sourceIdAtStart: randomUUID() }])("TDD-US3-FR012 capture baseline: malformed persisted source binding %j cannot issue new permission", (binding) => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [{ ...admission, benefitsAtStart: { runnerPro: false, ...binding } }]]);
	return expect(issueFreeExecutionLease(actor, session.id, randomUUID()))
		.resolves.toBeNull()
		.then(() => {
			expect(set).not.toHaveBeenCalled();
		});
});

test("TDD-US3-FR012 paid deadline baseline: unreadable captured validity cannot mint another permit", async () => {
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [{ ...admission, benefitsAtStart: { runnerPro: true, validUntil: "invalid" } }]]);
	expect(await issueFreeExecutionLease(actor, session.id, randomUUID())).toBeNull();
	expect(set).not.toHaveBeenCalled();
});

test.each([false, true])("TDD-US3-FR012 revocation baseline: dispatched=%s preserves only authority already issued", async (dispatched) => {
	(resolveRunnerBenefits as jest.Mock).mockResolvedValueOnce({ proAccess: false });
	const captured = { ...admission, state: dispatched ? "starting" : "reserved", dispatchedAt: dispatched ? new Date(1) : null, benefitsAtStart: { runnerPro: true } };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [captured]]);
	const result = await issueFreeExecutionLease(actor, session.id, randomUUID());
	if (dispatched) {
		expect(result).toMatchObject({ permissionPending: true });
		expect(set).not.toHaveBeenCalled();
	} else {
		expect(result).toBeNull();
		expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "failed_before_output", terminalReason: "benefits_revoked_before_dispatch" }));
		expect(set).toHaveBeenCalledWith(expect.objectContaining({ desiredState: "stopped" }));
	}
});

test("TDD-US3-FR012 cached receipt baseline: a separate physical execution prevents activation of pending cached authority", async () => {
	const leaseId = randomUUID();
	const cached = { ...admission, state: "authorized", leaseId, protocolSupportsLease: true, dispatchedAt: new Date(1), leaseExpiresAt: new Date(1300000), scheduledEnd: new Date(1020000), benefitsAtStart: { runnerPro: true, cacheAuthorization: true, scheduledStart: 999000 } };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [{ ...session, desiredState: "stopped", controlMode: "scheduled" }], [cached], [{ id: randomUUID() }]]);
	expect(await acknowledgeFreeExecutions(actor, [{ admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "active" }])).toEqual([]);
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US3-FR012 observations baseline: an empty owner-scoped session selection performs no database work", async () => {
	expect(await readRunnerOutputStates(db, actor.ownerId, [])).toEqual(new Map());
	expect(mockTransaction).not.toHaveBeenCalled();
});

test("TDD-US3-EC009: a matching closed execution persists its playback timeout for the dashboard", async () => {
	const leaseId = randomUUID();
	const active = { ...admission, state: "active", protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active], []]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "stopped" as const, allOutputsClosed: true as const, playbackOutcome: "playback_timeout" as const };
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toHaveLength(1);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "stopped", terminalReason: "playback_timeout" }));
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ actualState: "stopped", lastError: "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit." }));
});

test("TDD-US3-FR013: matching finishing telemetry retains occupied admission and shows Stop now until physical closure", async () => {
	const leaseId = randomUUID();
	const active = { ...admission, state: "active", protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [session], [active]]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "draining" as const };
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toEqual([{ admissionId: admission.id, executionGeneration: admission.executionGeneration, state: "draining" }]);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "draining" }));
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ actualState: "running", desiredState: "stopped", configurationRevision: 3 }));
	expect(set.mock.calls.some(([value]) => value.state === "stopped" || "stoppedAt" in value || "recoveredAt" in value)).toBe(false);
});

test("TDD-US3-FR013: a cached event may first report finishing after its original end without fabricating closure", async () => {
	const leaseId = randomUUID();
	const pending = { ...admission, state: "authorized", protocolSupportsLease: true, benefitsAtStart: { runnerPro: true, cacheAuthorization: true, scheduledStart: 990000 }, scheduledEnd: new Date(995000), dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [{ ...session, controlMode: "scheduled", mode: "24/7" }], [pending], []]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "draining" as const };
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toEqual([{ admissionId: admission.id, executionGeneration: admission.executionGeneration, state: "draining" }]);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "draining" }));
	expect(set.mock.calls.some(([value]) => value.state === "stopped" || "stoppedAt" in value)).toBe(false);
});

test.each(["not cached", "not Pro", "suppressed", "manual", "live fallback", "missing start", "fractional start", "future", "missing end", "past shutdown bound", "other physical", "already stopped"])("TDD-US3-FR013: %s cannot promote a pending authority through finishing telemetry", async (kind) => {
	const leaseId = randomUUID();
	const benefits: Record<string, unknown> = { runnerPro: true, cacheAuthorization: true, scheduledStart: 990000 };
	const pending = { ...admission, state: "authorized", protocolSupportsLease: true, benefitsAtStart: benefits, scheduledEnd: new Date(995000) as Date | null, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const configured = { ...session, controlMode: "scheduled", mode: "24/7" };
	if (kind === "not cached") benefits.cacheAuthorization = false;
	if (kind === "not Pro") benefits.runnerPro = false;
	if (kind === "suppressed") benefits.scheduleSuppressed = true;
	if (kind === "manual") configured.controlMode = "manual";
	if (kind === "live fallback") configured.mode = "failsafe";
	if (kind === "missing start") benefits.scheduledStart = undefined;
	if (kind === "fractional start") benefits.scheduledStart = 990000.5;
	if (kind === "future") {
		benefits.scheduledStart = 1000001;
		pending.scheduledEnd = new Date(1010000);
	}
	if (kind === "missing end") pending.scheduledEnd = null;
	if (kind === "past shutdown bound") {
		benefits.scheduledStart = 690000;
		pending.scheduledEnd = new Date(695000);
	}
	if (kind === "already stopped") pending.state = "stopped";
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [configured], [pending], kind === "other physical" ? [{ id: randomUUID() }] : []]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "draining" as const };
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toEqual([]);
	expect(set).not.toHaveBeenCalled();
});

test.each([true, false])("TDD-US3-EC009: a healthy matching new broadcast clears only a previous playback timeout (known=%s)", async (known) => {
	const leaseId = randomUUID();
	const active = { ...admission, state: "starting", protocolSupportsLease: true, dispatchedAt: new Date(1), leaseId, leaseExpiresAt: new Date(1300000) };
	const lastError = known ? "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit." : "another diagnostic";
	const { set } = transaction([[{ id: actor.ownerId }], [actor], [{ ...session, lastError }], [active]]);
	const acknowledgment = { admissionId: admission.id, sessionId: session.id, executionGeneration: admission.executionGeneration, leaseId, configurationRevision: 2, state: "active" as const };
	expect(await acknowledgeFreeExecutions(actor, [acknowledgment])).toHaveLength(1);
	const state = set.mock.calls.map(([value]) => value).find((value) => value.actualState === "running");
	if (known) expect(state).toHaveProperty("lastError", null);
	else expect(state).not.toHaveProperty("lastError");
});
