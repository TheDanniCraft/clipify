/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockSelect = jest.fn(),
	mockTransaction = jest.fn();
jest.mock("@/db/client", () => ({ db: { select: () => mockSelect(), transaction: (callback: unknown) => mockTransaction(callback) } }));
import { acknowledgeRevokedExecution } from "@/server/runner/terminal";
import { createHash, randomUUID } from "node:crypto";

const token = "fixture-retired-token";
const receipt = { admissionId: randomUUID(), executionGeneration: randomUUID(), allOutputsClosed: true as const };
const candidate = { id: receipt.admissionId, ownerId: "owner", sessionId: randomUUID(), executionGeneration: receipt.executionGeneration, revokedAt: new Date(1), terminalCredentialHash: createHash("sha256").update(token).digest("hex"), state: "draining" };
function selection(value: unknown[]) {
	const builder = { from: () => builder, where: () => builder, limit: () => builder, for: async () => value, then: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(value).then(resolve, reject) };
	return builder;
}
function fixture(initial: unknown[], current: unknown[], otherPhysical: unknown[] = []) {
	const rows = [[{ id: candidate.ownerId }], current, otherPhysical];
	const set = jest.fn();
	const tx = {
		select: () => selection(rows.shift() ?? []),
		update: jest.fn(() => ({
			set: (value: unknown) => {
				set(value);
				return { where: async () => undefined };
			},
		})),
	};
	mockSelect.mockReturnValue(selection(initial));
	mockTransaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx));
	return { set, tx };
}
beforeEach(() => jest.clearAllMocks());

test.each([null, "invalid-hash"])("TDD-US1-CON003: malformed persisted terminal hash %s confers no authority", async (terminalCredentialHash) => {
	const { set } = fixture([{ ...candidate, terminalCredentialHash }], []);
	await expect(acknowledgeRevokedExecution(token, receipt)).rejects.toThrow("INVALID_TERMINAL_CREDENTIAL");
	expect(mockTransaction).not.toHaveBeenCalled();
	expect(set).not.toHaveBeenCalled();
});

test.each(["removed", "revocation", "generation", "credential"])("TDD-US1-CON003: %s changing before the owner lock cannot acknowledge closure", async (kind) => {
	const changed = kind === "removed" ? [] : [{ ...candidate, ...(kind === "revocation" ? { revokedAt: null } : kind === "generation" ? { executionGeneration: randomUUID() } : { terminalCredentialHash: "a".repeat(64) }) }];
	const { set } = fixture([candidate], changed);
	await expect(acknowledgeRevokedExecution(token, receipt)).rejects.toThrow("INVALID_TERMINAL_CREDENTIAL");
	expect(mockTransaction).toHaveBeenCalledTimes(1);
	expect(set).not.toHaveBeenCalled();
});

test.each(["stopped", "failed_before_output"])("TDD-US1-CON003: replay for exact terminal state %s never mutates a session", async (state) => {
	const { set } = fixture([candidate], [{ ...candidate, state }]);
	expect(await acknowledgeRevokedExecution(token, receipt)).toEqual({ accepted: true });
	expect(set).not.toHaveBeenCalled();
});

test("TDD-US1-CON003: a deleted session's retained tombstone acknowledges only its own admission", async () => {
	const { set, tx } = fixture([candidate], [{ ...candidate, sessionId: null }]);
	expect(await acknowledgeRevokedExecution(token, receipt)).toEqual({ accepted: true });
	expect(tx.update).toHaveBeenCalledTimes(1);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "stopped", terminalReason: "all_outputs_closed" }));
});

test("TDD-US3-FR012: a revoked unused cached authorization closes without marking another physical broadcast stopped", async () => {
	const { set } = fixture([{ ...candidate, state: "authorized" }], [{ ...candidate, state: "authorized" }], [{ id: randomUUID() }]);
	expect(await acknowledgeRevokedExecution(token, receipt)).toEqual({ accepted: true });
	expect(set).toHaveBeenCalledTimes(1);
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "stopped", terminalReason: "all_outputs_closed" }));
});

test("TDD-US3-EC009: a revoked device's matching closed receipt persists playback timeout", async () => {
	const { set } = fixture([candidate], [candidate]);
	expect(await acknowledgeRevokedExecution(token, { ...receipt, ...{ playbackOutcome: "playback_timeout" as const } })).toEqual({ accepted: true });
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "stopped", terminalReason: "playback_timeout" }));
	expect(set).toHaveBeenCalledWith(expect.objectContaining({ actualState: "stopped", lastError: "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit." }));
});
